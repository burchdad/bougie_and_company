import { getSql } from "@/lib/db";
import { inferDepartment } from "@/lib/product-categorization";
import { ensureCategoryTables } from "@/lib/categories";

export type AdminProduct = {
  epos_product_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  sale_price: string | null;
  stock: string | null;
  storefront_stock_override: string | null;
  stock_id: string | null;
  stock_location_id: string | null;
  synced_at: string;
  marketing_title: string | null;
  marketing_description: string | null;
  department: string | null;
  category_ids: number[];
  category_slugs: string[];
  is_featured: boolean | null;
  is_hidden: boolean | null;
  primary_image_url: string | null;
  primary_image_alt: string | null;
};

type AdminProductRow = AdminProduct & {
  category_slug?: string | null;
  parent_category_slug?: string | null;
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
  await ensureCategoryTables();
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS product_site_meta (
      epos_product_id TEXT PRIMARY KEY REFERENCES epos_products(epos_product_id) ON DELETE CASCADE,
      marketing_title TEXT,
      marketing_description TEXT,
      department TEXT,
      storefront_stock_override NUMERIC,
      is_featured BOOLEAN NOT NULL DEFAULT FALSE,
      is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE product_site_meta ADD COLUMN IF NOT EXISTS storefront_stock_override NUMERIC`;

  await sql`
    CREATE TABLE IF NOT EXISTS product_site_categories (
      epos_product_id TEXT NOT NULL REFERENCES epos_products(epos_product_id) ON DELETE CASCADE,
      site_category_id BIGINT NOT NULL REFERENCES site_categories(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (epos_product_id, site_category_id)
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
  await sql`CREATE INDEX IF NOT EXISTS product_site_categories_category_idx ON product_site_categories (site_category_id)`;
}

export async function getAdminProducts(query = "", limit = 1000) {
  await ensureProductAdminTables();

  const sql = getSql();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 2000);
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
          m.storefront_stock_override::text AS storefront_stock_override,
          stock_row.epos_stock_id AS stock_id,
          stock_row.location_id::text AS stock_location_id,
          p.synced_at::text,
          m.marketing_title,
          m.marketing_description,
          m.department,
          COALESCE(site_assignments.category_ids, ARRAY[]::int[]) AS category_ids,
          COALESCE(site_assignments.category_slugs, ARRAY[]::text[]) AS category_slugs,
          sc.slug AS category_slug,
          parent_sc.slug AS parent_category_slug,
          m.is_featured,
          m.is_hidden,
          i.url AS primary_image_url,
          i.alt_text AS primary_image_alt
        FROM epos_products p
        LEFT JOIN epos_product_stock s ON s.epos_product_id::text = p.epos_product_id
        LEFT JOIN product_site_meta m ON m.epos_product_id = p.epos_product_id
        LEFT JOIN site_categories sc ON sc.epos_category_id = p.category_id::text
        LEFT JOIN site_categories parent_sc ON parent_sc.id = sc.parent_id
        LEFT JOIN LATERAL (
          SELECT
            ARRAY_AGG(c.id::int ORDER BY c.parent_id NULLS FIRST, c.sort_order ASC, c.label ASC) AS category_ids,
            ARRAY_AGG(c.slug ORDER BY c.parent_id NULLS FIRST, c.sort_order ASC, c.label ASC) AS category_slugs
          FROM product_site_categories pc
          JOIN site_categories c ON c.id = pc.site_category_id
          WHERE pc.epos_product_id = p.epos_product_id
        ) site_assignments ON TRUE
        LEFT JOIN LATERAL (
          SELECT epos_stock_id, location_id
          FROM epos_product_stock
          WHERE epos_product_id::text = p.epos_product_id
          ORDER BY location_id ASC NULLS LAST, epos_stock_id ASC
          LIMIT 1
        ) stock_row ON TRUE
        LEFT JOIN LATERAL (
          SELECT i.url, i.alt_text
          FROM product_images i
          LEFT JOIN epos_products image_product ON image_product.epos_product_id = i.epos_product_id
          WHERE i.epos_product_id = p.epos_product_id
            OR (
              p.sku IS NOT NULL
              AND p.sku <> ''
              AND image_product.sku = p.sku
            )
            OR (
              p.barcode IS NOT NULL
              AND p.barcode <> ''
              AND image_product.barcode = p.barcode
            )
            OR (
              NULLIF(regexp_replace(regexp_replace(lower(p.name), '^[a-z]+[0-9]+[a-z0-9-]*[[:space:]]+', '', 'i'), '[[:space:]]+(bath bomb|bath bombs|soap|soaps|homemade soap|handmade soap)$', '', 'i'), '') IS NOT NULL
              AND NULLIF(regexp_replace(regexp_replace(lower(image_product.name), '^[a-z]+[0-9]+[a-z0-9-]*[[:space:]]+', '', 'i'), '[[:space:]]+(bath bomb|bath bombs|soap|soaps|homemade soap|handmade soap)$', '', 'i'), '') IS NOT NULL
              AND regexp_replace(regexp_replace(lower(p.name), '^[a-z]+[0-9]+[a-z0-9-]*[[:space:]]+', '', 'i'), '[[:space:]]+(bath bomb|bath bombs|soap|soaps|homemade soap|handmade soap)$', '', 'i')
                = regexp_replace(regexp_replace(lower(image_product.name), '^[a-z]+[0-9]+[a-z0-9-]*[[:space:]]+', '', 'i'), '[[:space:]]+(bath bomb|bath bombs|soap|soaps|homemade soap|handmade soap)$', '', 'i')
            )
          ORDER BY
            CASE
              WHEN i.epos_product_id = p.epos_product_id THEN 0
              WHEN p.sku IS NOT NULL AND p.sku <> '' AND image_product.sku = p.sku THEN 1
              WHEN p.barcode IS NOT NULL AND p.barcode <> '' AND image_product.barcode = p.barcode THEN 2
              ELSE 3
            END,
            i.is_primary DESC,
            i.sort_order ASC,
            i.id ASC
          LIMIT 1
        ) i ON TRUE
        WHERE p.is_deleted = FALSE
          AND (
            p.name ILIKE ${`%${query}%`}
            OR p.epos_product_id ILIKE ${`%${query}%`}
            OR p.description ILIKE ${`%${query}%`}
            OR p.sku ILIKE ${`%${query}%`}
            OR p.barcode ILIKE ${`%${query}%`}
          )
        GROUP BY p.epos_product_id, p.name, p.description, p.sku, p.barcode, p.category_id, p.sale_price, m.storefront_stock_override, stock_row.epos_stock_id, stock_row.location_id, p.synced_at, m.marketing_title, m.marketing_description, m.department, site_assignments.category_ids, site_assignments.category_slugs, sc.slug, parent_sc.slug, m.is_featured, m.is_hidden, i.url, i.alt_text
        ORDER BY p.name ASC
        LIMIT ${safeLimit}
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
          m.storefront_stock_override::text AS storefront_stock_override,
          stock_row.epos_stock_id AS stock_id,
          stock_row.location_id::text AS stock_location_id,
          p.synced_at::text,
          m.marketing_title,
          m.marketing_description,
          m.department,
          COALESCE(site_assignments.category_ids, ARRAY[]::int[]) AS category_ids,
          COALESCE(site_assignments.category_slugs, ARRAY[]::text[]) AS category_slugs,
          sc.slug AS category_slug,
          parent_sc.slug AS parent_category_slug,
          m.is_featured,
          m.is_hidden,
          i.url AS primary_image_url,
          i.alt_text AS primary_image_alt
        FROM epos_products p
        LEFT JOIN epos_product_stock s ON s.epos_product_id::text = p.epos_product_id
        LEFT JOIN product_site_meta m ON m.epos_product_id = p.epos_product_id
        LEFT JOIN site_categories sc ON sc.epos_category_id = p.category_id::text
        LEFT JOIN site_categories parent_sc ON parent_sc.id = sc.parent_id
        LEFT JOIN LATERAL (
          SELECT
            ARRAY_AGG(c.id::int ORDER BY c.parent_id NULLS FIRST, c.sort_order ASC, c.label ASC) AS category_ids,
            ARRAY_AGG(c.slug ORDER BY c.parent_id NULLS FIRST, c.sort_order ASC, c.label ASC) AS category_slugs
          FROM product_site_categories pc
          JOIN site_categories c ON c.id = pc.site_category_id
          WHERE pc.epos_product_id = p.epos_product_id
        ) site_assignments ON TRUE
        LEFT JOIN LATERAL (
          SELECT epos_stock_id, location_id
          FROM epos_product_stock
          WHERE epos_product_id::text = p.epos_product_id
          ORDER BY location_id ASC NULLS LAST, epos_stock_id ASC
          LIMIT 1
        ) stock_row ON TRUE
        LEFT JOIN LATERAL (
          SELECT i.url, i.alt_text
          FROM product_images i
          LEFT JOIN epos_products image_product ON image_product.epos_product_id = i.epos_product_id
          WHERE i.epos_product_id = p.epos_product_id
            OR (
              p.sku IS NOT NULL
              AND p.sku <> ''
              AND image_product.sku = p.sku
            )
            OR (
              p.barcode IS NOT NULL
              AND p.barcode <> ''
              AND image_product.barcode = p.barcode
            )
            OR (
              NULLIF(regexp_replace(regexp_replace(lower(p.name), '^[a-z]+[0-9]+[a-z0-9-]*[[:space:]]+', '', 'i'), '[[:space:]]+(bath bomb|bath bombs|soap|soaps|homemade soap|handmade soap)$', '', 'i'), '') IS NOT NULL
              AND NULLIF(regexp_replace(regexp_replace(lower(image_product.name), '^[a-z]+[0-9]+[a-z0-9-]*[[:space:]]+', '', 'i'), '[[:space:]]+(bath bomb|bath bombs|soap|soaps|homemade soap|handmade soap)$', '', 'i'), '') IS NOT NULL
              AND regexp_replace(regexp_replace(lower(p.name), '^[a-z]+[0-9]+[a-z0-9-]*[[:space:]]+', '', 'i'), '[[:space:]]+(bath bomb|bath bombs|soap|soaps|homemade soap|handmade soap)$', '', 'i')
                = regexp_replace(regexp_replace(lower(image_product.name), '^[a-z]+[0-9]+[a-z0-9-]*[[:space:]]+', '', 'i'), '[[:space:]]+(bath bomb|bath bombs|soap|soaps|homemade soap|handmade soap)$', '', 'i')
            )
          ORDER BY
            CASE
              WHEN i.epos_product_id = p.epos_product_id THEN 0
              WHEN p.sku IS NOT NULL AND p.sku <> '' AND image_product.sku = p.sku THEN 1
              WHEN p.barcode IS NOT NULL AND p.barcode <> '' AND image_product.barcode = p.barcode THEN 2
              ELSE 3
            END,
            i.is_primary DESC,
            i.sort_order ASC,
            i.id ASC
          LIMIT 1
        ) i ON TRUE
        WHERE p.is_deleted = FALSE
        GROUP BY p.epos_product_id, p.name, p.description, p.sku, p.barcode, p.category_id, p.sale_price, m.storefront_stock_override, stock_row.epos_stock_id, stock_row.location_id, p.synced_at, m.marketing_title, m.marketing_description, m.department, site_assignments.category_ids, site_assignments.category_slugs, sc.slug, parent_sc.slug, m.is_featured, m.is_hidden, i.url, i.alt_text
        ORDER BY p.name ASC
        LIMIT ${safeLimit}
      `;

  return (rows as AdminProductRow[]).map((row) => ({
    ...row,
    category_ids: row.category_ids || [],
    category_slugs: row.category_slugs || [],
    department: inferDepartment(row)
  }));
}
