import { put } from "@vercel/blob";
import { ensureProductAdminTables } from "@/lib/admin-products";
import { getSql } from "@/lib/db";

const imageKeyPattern = /(image|photo|picture|thumbnail|media|avatar|icon)/i;
const imageUrlPattern = /^https?:\/\/.+\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i;

type ImageImportResult = {
  productsScanned: number;
  imageUrlsFound: number;
  uploaded: number;
  skippedExisting: number;
  skippedDuplicate: number;
  failed: number;
  remainingWithoutPhotos: number;
};

function collectImageUrls(value: unknown, parentKey = "", urls = new Set<string>()) {
  if (!value) {
    return urls;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("http") && (imageUrlPattern.test(trimmed) || imageKeyPattern.test(parentKey))) {
      urls.add(trimmed);
    }
    return urls;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, parentKey, urls));
    return urls;
  }

  if (typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => collectImageUrls(child, key, urls));
  }

  return urls;
}

function extensionFrom(url: string, contentType: string | null) {
  const pathname = new URL(url).pathname;
  const match = pathname.match(/\.([a-z0-9]+)$/i);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }

  if (contentType?.includes("png")) {
    return "png";
  }

  if (contentType?.includes("webp")) {
    return "webp";
  }

  if (contentType?.includes("gif")) {
    return "gif";
  }

  return "jpg";
}

function safeName(value: string) {
  return value.replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-").toLowerCase();
}

export async function importEposProductImages({ skipExisting = true, limit = 25 } = {}) {
  await ensureProductAdminTables();

  const sql = getSql();
  const products = skipExisting
    ? await sql`
        SELECT p.epos_product_id, p.name, p.raw, COUNT(i.id)::int AS image_count
        FROM epos_products p
        LEFT JOIN product_images i ON i.epos_product_id = p.epos_product_id
        WHERE p.is_deleted = FALSE
          AND NOT EXISTS (
            SELECT 1
            FROM product_images existing
            WHERE existing.epos_product_id = p.epos_product_id
          )
        GROUP BY p.epos_product_id, p.name, p.raw
        ORDER BY p.name ASC
        LIMIT ${limit}
      `
    : await sql`
    SELECT p.epos_product_id, p.name, p.raw, COUNT(i.id)::int AS image_count
    FROM epos_products p
    LEFT JOIN product_images i ON i.epos_product_id = p.epos_product_id
    WHERE p.is_deleted = FALSE
    GROUP BY p.epos_product_id, p.name, p.raw
    ORDER BY p.name ASC
        LIMIT ${limit}
  `;

  const result: ImageImportResult = {
    productsScanned: products.length,
    imageUrlsFound: 0,
    uploaded: 0,
    skippedExisting: 0,
    skippedDuplicate: 0,
    failed: 0,
    remainingWithoutPhotos: 0
  };

  const existingPathRows = await sql`SELECT pathname FROM product_images WHERE pathname IS NOT NULL`;
  const existingPathnames = new Set(existingPathRows.map((row) => String(row.pathname)));

  for (const product of products) {
    if (skipExisting && Number(product.image_count || 0) > 0) {
      result.skippedExisting += 1;
      continue;
    }

    const imageUrls = [...collectImageUrls(product.raw)];
    result.imageUrlsFound += imageUrls.length;

    for (const [index, imageUrl] of imageUrls.entries()) {
      try {
        const response = await fetch(imageUrl, { cache: "no-store" });

        if (!response.ok) {
          result.failed += 1;
          continue;
        }

        const contentType = response.headers.get("content-type");
        if (!contentType?.startsWith("image/")) {
          result.failed += 1;
          continue;
        }

        const extension = extensionFrom(imageUrl, contentType);
        const pathname = `products/${product.epos_product_id}/epos-${safeName(product.epos_product_id)}-${index}.${extension}`;

        if (existingPathnames.has(pathname)) {
          result.skippedDuplicate += 1;
          continue;
        }

        const blob = await put(pathname, await response.blob(), {
          access: "public",
          contentType,
          addRandomSuffix: true
        });

        if (index === 0) {
          await sql`UPDATE product_images SET is_primary = FALSE WHERE epos_product_id = ${String(product.epos_product_id)}`;
        }

        await sql`
          INSERT INTO product_images (epos_product_id, url, pathname, alt_text, sort_order, is_primary)
          VALUES (${String(product.epos_product_id)}, ${blob.url}, ${blob.pathname}, ${String(product.name)}, ${index}, ${index === 0})
        `;

        existingPathnames.add(blob.pathname);
        result.uploaded += 1;
      } catch (error) {
        console.error(error instanceof Error ? error.message : "Epos product image import failed.");
        result.failed += 1;
      }
    }
  }

  const remainingRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM epos_products p
    WHERE p.is_deleted = FALSE
      AND NOT EXISTS (
        SELECT 1
        FROM product_images i
        WHERE i.epos_product_id = p.epos_product_id
      )
  `;
  result.remainingWithoutPhotos = Number(remainingRows[0]?.count || 0);

  return result;
}
