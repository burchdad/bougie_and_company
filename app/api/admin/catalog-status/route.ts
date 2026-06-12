import { ensureProductAdminTables, isAdminRequest } from "@/lib/admin-products";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  await ensureProductAdminTables();

  const sql = getSql();
  const [
    productRows,
    categoryRows,
    duplicateSlugRows,
    imageRows,
    noCategoryRows,
    staleExternalRows
  ] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE p.is_deleted = FALSE)::int AS active,
        COUNT(*) FILTER (WHERE p.is_deleted = FALSE AND COALESCE(m.is_hidden, FALSE) = FALSE)::int AS visible,
        COUNT(*) FILTER (WHERE p.is_deleted = FALSE AND COALESCE(m.is_hidden, FALSE) = TRUE)::int AS hidden
      FROM epos_products p
      LEFT JOIN product_site_meta m ON m.epos_product_id = p.epos_product_id
    `,
    sql`SELECT COUNT(*)::int AS total FROM site_categories`,
    sql`
      SELECT slug, COUNT(*)::int AS count
      FROM site_categories
      GROUP BY slug
      HAVING COUNT(*) > 1
      ORDER BY slug ASC
    `,
    sql`
      SELECT
        COUNT(DISTINCT i.epos_product_id)::int AS products_with_images,
        COUNT(DISTINCT i.epos_product_id) FILTER (WHERE i.pathname IS NOT NULL)::int AS products_with_blob_images,
        COUNT(*) FILTER (WHERE i.pathname IS NULL AND i.url LIKE 'http%' AND i.url NOT LIKE '%.public.blob.vercel-storage.com%')::int AS external_image_rows
      FROM product_images i
      JOIN epos_products p ON p.epos_product_id = i.epos_product_id
      LEFT JOIN product_site_meta m ON m.epos_product_id = p.epos_product_id
      WHERE p.is_deleted = FALSE
        AND COALESCE(m.is_hidden, FALSE) = FALSE
    `,
    sql`
      SELECT p.epos_product_id, p.name, p.sku
      FROM epos_products p
      LEFT JOIN product_site_meta m ON m.epos_product_id = p.epos_product_id
      WHERE p.is_deleted = FALSE
        AND COALESCE(m.is_hidden, FALSE) = FALSE
        AND NOT EXISTS (
          SELECT 1
          FROM product_site_categories pc
          WHERE pc.epos_product_id = p.epos_product_id
        )
      ORDER BY p.name ASC
      LIMIT 25
    `,
    sql`
      SELECT i.epos_product_id, p.name, p.sku, i.url
      FROM product_images i
      JOIN epos_products p ON p.epos_product_id = i.epos_product_id
      LEFT JOIN product_site_meta m ON m.epos_product_id = p.epos_product_id
      WHERE p.is_deleted = FALSE
        AND COALESCE(m.is_hidden, FALSE) = FALSE
        AND i.pathname IS NULL
        AND i.url LIKE 'http%'
        AND i.url NOT LIKE '%.public.blob.vercel-storage.com%'
      ORDER BY p.name ASC
      LIMIT 25
    `
  ]);

  const products = productRows[0] || {};
  const images = imageRows[0] || {};
  const visible = Number(products.visible || 0);
  const productsWithImages = Number(images.products_with_images || 0);
  const productsWithBlobImages = Number(images.products_with_blob_images || 0);

  return Response.json(
    {
      ok: true,
      products: {
        total: Number(products.total || 0),
        active: Number(products.active || 0),
        visible,
        hidden: Number(products.hidden || 0)
      },
      categories: {
        total: Number(categoryRows[0]?.total || 0),
        duplicateSlugCount: duplicateSlugRows.length,
        duplicateSlugs: duplicateSlugRows
      },
      images: {
        productsWithImages,
        productsWithBlobImages,
        externalImageRows: Number(images.external_image_rows || 0),
        visibleMissingImages: Math.max(visible - productsWithImages, 0),
        visibleMissingBlobImages: Math.max(visible - productsWithBlobImages, 0)
      },
      visibleProductsMissingCategories: noCategoryRows,
      externalImageSamples: staleExternalRows
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
