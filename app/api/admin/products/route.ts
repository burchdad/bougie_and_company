import { ensureProductAdminTables, getAdminProducts, isAdminRequest } from "@/lib/admin-products";
import { getSql } from "@/lib/db";
import { updateEposProduct, updateEposProductStock } from "@/lib/epos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const products = await getAdminProducts(searchParams.get("q")?.trim() || "");
  return Response.json({ ok: true, products }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    eposProductId?: string;
    marketingTitle?: string;
    marketingDescription?: string;
    department?: string;
    isFeatured?: boolean;
    isHidden?: boolean;
    eposName?: string;
    eposDescription?: string;
    eposSku?: string;
    eposSalePrice?: string;
    eposStock?: string;
  };

  if (!body.eposProductId) {
    return Response.json({ ok: false, message: "Missing product ID." }, { status: 400 });
  }

  await ensureProductAdminTables();

  const sql = getSql();
  const productRows = await sql`
    SELECT p.raw, s.epos_stock_id, s.raw AS stock_raw
    FROM epos_products p
    LEFT JOIN LATERAL (
      SELECT epos_stock_id, raw
      FROM epos_product_stock
      WHERE epos_product_id::text = p.epos_product_id
      ORDER BY location_id ASC NULLS LAST, epos_stock_id ASC
      LIMIT 1
    ) s ON TRUE
    WHERE p.epos_product_id = ${body.eposProductId}
    LIMIT 1
  `;

  if (!productRows.length) {
    return Response.json({ ok: false, message: "Product not found in Neon cache." }, { status: 404 });
  }

  const eposName = body.eposName?.trim() || body.marketingTitle?.trim() || "Untitled product";
  const eposDescription = body.eposDescription?.trim() || body.marketingDescription?.trim() || eposName;
  const eposSku = body.eposSku?.trim() || "";
  const eposSalePrice = body.eposSalePrice && body.eposSalePrice.trim() !== "" ? Number(body.eposSalePrice) : null;
  const eposStock = body.eposStock && body.eposStock.trim() !== "" ? Number(body.eposStock) : null;

  if ((eposSalePrice !== null && Number.isNaN(eposSalePrice)) || (eposStock !== null && Number.isNaN(eposStock))) {
    return Response.json({ ok: false, message: "Price and stock must be valid numbers." }, { status: 400 });
  }

  try {
    await updateEposProduct(body.eposProductId, productRows[0].raw as Record<string, unknown>, {
      name: eposName,
      description: eposDescription,
      sku: eposSku,
      salePrice: eposSalePrice
    });

    if (eposStock !== null && productRows[0].epos_stock_id) {
      await updateEposProductStock(String(productRows[0].epos_stock_id), productRows[0].stock_raw as Record<string, unknown>, eposStock);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Epos update failed.";
    console.error(message);
    return Response.json({ ok: false, message: `Epos rejected the update: ${message}` }, { status: 502 });
  }

  await sql`
    UPDATE epos_products
    SET name = ${eposName},
      description = ${eposDescription},
      sku = ${eposSku || null},
      sale_price = ${eposSalePrice},
      raw = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(COALESCE(raw, '{}'::jsonb), '{Name}', to_jsonb(${eposName}::text), true),
            '{Description}',
            to_jsonb(${eposDescription}::text),
            true
          ),
          '{Sku}',
          to_jsonb(${eposSku}::text),
          true
        ),
        '{SalePrice}',
        to_jsonb(${eposSalePrice}::numeric),
        true
      ),
      synced_at = NOW()
    WHERE epos_product_id = ${body.eposProductId}
  `;

  if (eposStock !== null && productRows[0].epos_stock_id) {
    await sql`
      UPDATE epos_product_stock
      SET current_stock = ${eposStock},
        raw = jsonb_set(COALESCE(raw, '{}'::jsonb), '{CurrentStock}', to_jsonb(${eposStock}::numeric), true),
        synced_at = NOW()
      WHERE epos_stock_id = ${String(productRows[0].epos_stock_id)}
    `;
  }

  await sql`
    INSERT INTO product_site_meta (
      epos_product_id,
      marketing_title,
      marketing_description,
      department,
      is_featured,
      is_hidden,
      updated_at
    )
    VALUES (
      ${body.eposProductId},
      ${body.marketingTitle?.trim() || null},
      ${body.marketingDescription?.trim() || null},
      ${body.department?.trim() || null},
      ${Boolean(body.isFeatured)},
      ${Boolean(body.isHidden)},
      NOW()
    )
    ON CONFLICT (epos_product_id)
    DO UPDATE SET
      marketing_title = EXCLUDED.marketing_title,
      marketing_description = EXCLUDED.marketing_description,
      department = EXCLUDED.department,
      is_featured = EXCLUDED.is_featured,
      is_hidden = EXCLUDED.is_hidden,
      updated_at = NOW()
  `;

  return Response.json({ ok: true, message: "Product website details saved." }, { headers: { "Cache-Control": "no-store" } });
}
