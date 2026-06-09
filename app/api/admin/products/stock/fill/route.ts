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
  epos_stock_id: string | null;
  stock_raw: Record<string, unknown> | null;
};

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
      stock_row.epos_stock_id,
      stock_row.raw AS stock_raw
    FROM epos_products p
    LEFT JOIN epos_product_stock s ON s.epos_product_id::text = p.epos_product_id
    LEFT JOIN LATERAL (
      SELECT epos_stock_id, raw
      FROM epos_product_stock
      WHERE epos_product_id::text = p.epos_product_id
      ORDER BY location_id ASC NULLS LAST, epos_stock_id ASC
      LIMIT 1
    ) stock_row ON TRUE
    WHERE p.is_deleted = FALSE
    GROUP BY p.epos_product_id, p.name, stock_row.epos_stock_id, stock_row.raw
    HAVING COALESCE(SUM(s.current_stock), 0) < ${minimumStock}
    ORDER BY p.name ASC
    LIMIT ${limit}
  `) as StockRepairRow[];

  const result = {
    checked: rows.length,
    updatedExisting: 0,
    createdStockRows: 0,
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
      result.createdStockRows += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown stock update error.";
      result.failed += 1;
      result.failures.push({ productId: String(row.epos_product_id), name: row.name, message });
      console.error(`Stock repair failed for ${row.epos_product_id}: ${message}`);
    }
  }

  const remainingRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM epos_products p
    LEFT JOIN epos_product_stock s ON s.epos_product_id::text = p.epos_product_id
    WHERE p.is_deleted = FALSE
    GROUP BY p.epos_product_id
    HAVING COALESCE(SUM(s.current_stock), 0) < ${minimumStock}
  `;

  const remainingBelowMinimum = remainingRows.length;
  const updated = result.updatedExisting + result.createdStockRows;

  return Response.json(
    {
      ok: result.failed === 0,
      message: `Stock repair checked ${result.checked} product${result.checked === 1 ? "" : "s"} and set ${updated} to at least ${minimumStock}. ${remainingBelowMinimum} product${remainingBelowMinimum === 1 ? "" : "s"} remain below ${minimumStock}.`,
      result: { ...result, updated, remainingBelowMinimum }
    },
    { status: result.failed === 0 ? 200 : 207, headers: { "Cache-Control": "no-store" } }
  );
}
