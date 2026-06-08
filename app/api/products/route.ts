import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductRow = {
  epos_product_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  sale_price: string | null;
  stock: string | null;
  synced_at: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";
    const sql = getSql();

    const rows = (query
      ? await sql`
          SELECT
            p.epos_product_id,
            p.name,
            p.description,
            p.sku,
            p.barcode,
            p.category_id::text,
            p.sale_price::text,
            COALESCE(SUM(s.current_stock), 0)::text AS stock,
            p.synced_at::text
          FROM epos_products p
          LEFT JOIN epos_product_stock s ON s.epos_product_id::text = p.epos_product_id
          WHERE p.is_deleted = FALSE
            AND (
              p.name ILIKE ${`%${query}%`}
              OR p.description ILIKE ${`%${query}%`}
              OR p.sku ILIKE ${`%${query}%`}
              OR p.barcode ILIKE ${`%${query}%`}
            )
          GROUP BY p.epos_product_id, p.name, p.description, p.sku, p.barcode, p.category_id, p.sale_price, p.synced_at
          ORDER BY p.name ASC
          LIMIT 240
        `
      : await sql`
          SELECT
            p.epos_product_id,
            p.name,
            p.description,
            p.sku,
            p.barcode,
            p.category_id::text,
            p.sale_price::text,
            COALESCE(SUM(s.current_stock), 0)::text AS stock,
            p.synced_at::text
          FROM epos_products p
          LEFT JOIN epos_product_stock s ON s.epos_product_id::text = p.epos_product_id
          WHERE p.is_deleted = FALSE
          GROUP BY p.epos_product_id, p.name, p.description, p.sku, p.barcode, p.category_id, p.sale_price, p.synced_at
          ORDER BY p.name ASC
          LIMIT 240
        `) as ProductRow[];

    return Response.json({ ok: true, products: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product catalog is not available yet.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
