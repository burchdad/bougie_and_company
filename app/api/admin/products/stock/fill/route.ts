import { ensureProductAdminTables, isAdminRequest } from "@/lib/admin-products";
import { getSql } from "@/lib/db";
import { createEposProductStock, getEposId, getEposNumber, updateEposProductStock } from "@/lib/epos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type StockRepairRow = {
  epos_product_id: string;
  name: string;
  total_stock: string | number | null;
  storefront_stock_override: string | number | null;
  epos_stock_id: string | null;
  stock_raw: Record<string, unknown> | null;
};

async function applyStorefrontStockOverride(productId: string, minimumStock: number) {
  const sql = getSql();

  await sql`
    INSERT INTO product_site_meta (epos_product_id, storefront_stock_override, updated_at)
    VALUES (${productId}, ${minimumStock}, NOW())
    ON CONFLICT (epos_product_id)
    DO UPDATE SET storefront_stock_override = EXCLUDED.storefront_stock_override, updated_at = NOW()
  `;
}

async function clearStorefrontStockOverride(productId: string) {
  const sql = getSql();

  await sql`
    UPDATE product_site_meta
    SET storefront_stock_override = NULL,
      updated_at = NOW()
    WHERE epos_product_id = ${productId}
  `;
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { minimumStock?: number; limit?: number };
  const minimumStock = Number.isFinite(Number(body.minimumStock)) ? Math.max(Number(body.minimumStock), 1) : 1;
  const limit = Number.isFinite(Number(body.limit)) ? Math.min(Math.max(Number(body.limit), 1), 500) : 300;

  await ensureProductAdminTables();
  const sql = getSql();

  const rows = (await sql`
    SELECT
      p.epos_product_id,
      p.name,
      COALESCE(SUM(s.current_stock), 0)::text AS total_stock,
      m.storefront_stock_override::text AS storefront_stock_override,
      stock_row.epos_stock_id,
      stock_row.raw AS stock_raw
    FROM epos_products p
    LEFT JOIN epos_product_stock s ON s.epos_product_id::text = p.epos_product_id
    LEFT JOIN product_site_meta m ON m.epos_product_id = p.epos_product_id
    LEFT JOIN LATERAL (
      SELECT epos_stock_id, raw
      FROM epos_product_stock
      WHERE epos_product_id::text = p.epos_product_id
      ORDER BY location_id ASC NULLS LAST, epos_stock_id ASC
      LIMIT 1
    ) stock_row ON TRUE
    WHERE p.is_deleted = FALSE
    GROUP BY p.epos_product_id, p.name, m.storefront_stock_override, stock_row.epos_stock_id, stock_row.raw
    HAVING GREATEST(COALESCE(SUM(s.current_stock), 0), COALESCE(m.storefront_stock_override, 0)) < ${minimumStock}
    ORDER BY p.name ASC
    LIMIT ${limit}
  `) as StockRepairRow[];

  const result = {
    checked: rows.length,
    updatedExisting: 0,
    createdStockRows: 0,
    storefrontOverrides: 0,
    failed: 0,
    failures: [] as Array<{ productId: string; name: string; message: string }>
  };

  for (const row of rows) {
    try {
      if (row.epos_stock_id) {
        const stock = await updateEposProductStock(String(row.epos_stock_id), row.stock_raw || {}, minimumStock);
        await sql`
          UPDATE epos_product_stock
          SET current_stock = ${minimumStock},
            raw = ${JSON.stringify(stock)}::jsonb,
            synced_at = NOW()
          WHERE epos_stock_id = ${String(row.epos_stock_id)}
        `;
        await clearStorefrontStockOverride(String(row.epos_product_id));
        result.updatedExisting += 1;
        continue;
      }

      const stock = await createEposProductStock({ productId: String(row.epos_product_id), currentStock: minimumStock });
      const stockId = getEposId(stock);

      if (!stockId) {
        throw new Error("Epos created stock but did not return a stock ID.");
      }

      await sql`
        INSERT INTO epos_product_stock (epos_stock_id, epos_product_id, location_id, current_stock, raw, synced_at)
        VALUES (
          ${stockId},
          ${Number(row.epos_product_id)},
          ${getEposNumber(stock, ["LocationId", "locationId"])},
          ${minimumStock},
          ${JSON.stringify(stock)}::jsonb,
          NOW()
        )
        ON CONFLICT (epos_stock_id)
        DO UPDATE SET current_stock = EXCLUDED.current_stock, raw = EXCLUDED.raw, synced_at = NOW()
      `;
      await clearStorefrontStockOverride(String(row.epos_product_id));
      result.createdStockRows += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown stock update error.";
      result.failed += 1;
      result.failures.push({ productId: String(row.epos_product_id), name: row.name, message });
      console.error(`Stock repair failed for ${row.epos_product_id}: ${message}`);

      try {
        await applyStorefrontStockOverride(String(row.epos_product_id), minimumStock);
        result.storefrontOverrides += 1;
      } catch (overrideError) {
        const overrideMessage = overrideError instanceof Error ? overrideError.message : "Unknown storefront override error.";
        result.failures.push({ productId: String(row.epos_product_id), name: row.name, message: `Storefront override failed: ${overrideMessage}` });
        console.error(`Stock override failed for ${row.epos_product_id}: ${overrideMessage}`);
      }
    }
  }

  const remainingRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT p.epos_product_id
      FROM epos_products p
      LEFT JOIN epos_product_stock s ON s.epos_product_id::text = p.epos_product_id
      LEFT JOIN product_site_meta m ON m.epos_product_id = p.epos_product_id
      WHERE p.is_deleted = FALSE
      GROUP BY p.epos_product_id, m.storefront_stock_override
      HAVING GREATEST(COALESCE(SUM(s.current_stock), 0), COALESCE(m.storefront_stock_override, 0)) < ${minimumStock}
    ) remaining
  `;

  const remainingBelowMinimum = Number(remainingRows[0]?.count || 0);
  const updated = result.updatedExisting + result.createdStockRows;
  const failuresForResponse = result.failures.slice(0, 10);
  const ok = remainingBelowMinimum === 0;

  return Response.json(
    {
      ok,
      message: `Stock repair checked ${result.checked} product${result.checked === 1 ? "" : "s"}. Epos updated ${updated}; storefront overrides applied ${result.storefrontOverrides}. ${remainingBelowMinimum} product${remainingBelowMinimum === 1 ? "" : "s"} remain below ${minimumStock}.`,
      result: { ...result, failures: failuresForResponse, updated, remainingBelowMinimum }
    },
    { status: ok ? 200 : 207, headers: { "Cache-Control": "no-store" } }
  );
}
