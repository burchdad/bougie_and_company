import { getSql } from "@/lib/db";

export type AdminProduct = {
  epos_product_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  sale_price: string | null;
  stock: string | null;
  stock_id: string | null;
  stock_location_id: string | null;
  synced_at: string;
  marketing_title: string | null;
  marketing_description: string | null;
  department: string | null;
  is_featured: boolean | null;
  is_hidden: boolean | null;
  primary_image_url: string | null;
  primary_image_alt: string | null;
};

export function isAdminRequest(request: Request) {
  const adminKey = process.env.ADMIN_ACCESS_KEY;

  if (!adminKey) {
    return false;
  }

  const url = new URL(request.url);
  return request.headers.get("x-admin-key") === adminKey || url.searchParams.get("adminKey") === adminKey;
}

export async function ensureProductAdminTables() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS product_site_meta (
      epos_product_id TEXT PRIMARY KEY REFERENCES epos_products(epos_product_id) ON DELETE CASCADE,
      marketing_title TEXT,
      marketing_description TEXT,
      department TEXT,
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS product_images (
      id BIGSERIAL PRIMARY KEY,
      epos_product_id TEXT NOT NULL REFERENCES epos_products(epos_product_id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      pathname TEXT,
      alt_text TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images (epos_product_id, sort_order ASC)`;
  await sql`CREATE INDEX IF NOT EXISTS product_site_meta_department_idx ON product_site_meta (department)`;
}

export async function getAdminProducts(query = "") {
  await ensureProductAdminTables();

  const sql = getSql();
  const rows = query
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
          stock_row.epos_stock_id AS stock_id,
          stock_row.location_id::text AS stock_location_id,
          p.synced_at::text,
          m.marketing_title,
          m.marketing_description,
          m.department,
          m.is_featured,
          m.is_hidden,
          i.url AS primary_image_url,
          i.alt_text AS primary_image_alt
        FROM epos_products p
        LEFT JOIN epos_product_stock s ON s.epos_product_id::text = p.epos_product_id
        LEFT JOIN product_site_meta m ON m.epos_product_id = p.epos_product_id
        LEFT JOIN LATERAL (
          SELECT epos_stock_id, location_id
          FROM epos_product_stock
          WHERE epos_product_id::text = p.epos_product_id
          ORDER BY location_id ASC NULLS LAST, epos_stock_id ASC
          LIMIT 1
        ) stock_row ON TRUE
        LEFT JOIN LATERAL (
          SELECT url, alt_text
          FROM product_images
          WHERE epos_product_id = p.epos_product_id
          ORDER BY is_primary DESC, sort_order ASC, id ASC
          LIMIT 1
        ) i ON TRUE
        WHERE p.is_deleted = FALSE
          AND (
            p.name ILIKE ${`%${query}%`}
            OR p.description ILIKE ${`%${query}%`}
            OR p.sku ILIKE ${`%${query}%`}
            OR p.barcode ILIKE ${`%${query}%`}
          )
        GROUP BY p.epos_product_id, p.name, p.description, p.sku, p.barcode, p.category_id, p.sale_price, stock_row.epos_stock_id, stock_row.location_id, p.synced_at, m.marketing_title, m.marketing_description, m.department, m.is_featured, m.is_hidden, i.url, i.alt_text
        ORDER BY p.name ASC
        LIMIT 300
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
          stock_row.epos_stock_id AS stock_id,
          stock_row.location_id::text AS stock_location_id,
          p.synced_at::text,
          m.marketing_title,
          m.marketing_description,
          m.department,
          m.is_featured,
          m.is_hidden,
          i.url AS primary_image_url,
          i.alt_text AS primary_image_alt
        FROM epos_products p
        LEFT JOIN epos_product_stock s ON s.epos_product_id::text = p.epos_product_id
        LEFT JOIN product_site_meta m ON m.epos_product_id = p.epos_product_id
        LEFT JOIN LATERAL (
          SELECT epos_stock_id, location_id
          FROM epos_product_stock
          WHERE epos_product_id::text = p.epos_product_id
          ORDER BY location_id ASC NULLS LAST, epos_stock_id ASC
          LIMIT 1
        ) stock_row ON TRUE
        LEFT JOIN LATERAL (
          SELECT url, alt_text
          FROM product_images
          WHERE epos_product_id = p.epos_product_id
          ORDER BY is_primary DESC, sort_order ASC, id ASC
          LIMIT 1
        ) i ON TRUE
        WHERE p.is_deleted = FALSE
        GROUP BY p.epos_product_id, p.name, p.description, p.sku, p.barcode, p.category_id, p.sale_price, stock_row.epos_stock_id, stock_row.location_id, p.synced_at, m.marketing_title, m.marketing_description, m.department, m.is_featured, m.is_hidden, i.url, i.alt_text
        ORDER BY p.name ASC
        LIMIT 300
      `;

  return rows as AdminProduct[];
}
