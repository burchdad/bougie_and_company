import { put } from "@vercel/blob";
import { ensureProductAdminTables } from "@/lib/admin-products";
import { getSql } from "@/lib/db";
import { fetchEposCollection, getEposString } from "@/lib/epos";

const imageKeyPattern = /(image|photo|picture|thumbnail|media|avatar|icon)/i;
const imageUrlPattern = /^https?:\/\/.+\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i;

type ImageImportResult = {
  productsScanned: number;
  eposImageRecordsFound: number;
  imageUrlsFound: number;
  uploaded: number;
  skippedExisting: number;
  skippedDuplicate: number;
  failed: number;
  remainingWithoutPhotos: number;
};

type EposImageRecord = Record<string, unknown>;

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

function getImageRecordProductId(record: EposImageRecord) {
  const value = record.ProductId ?? record.ProductID ?? record.productId ?? record.productID ?? record.product_id;

  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  return null;
}

async function fetchEposImageRecords() {
  const resources = ["ProductImage", "ProductImages", "Product/Image", "ProductImages/Get"];

  for (const resource of resources) {
    try {
      const records = await fetchEposCollection<EposImageRecord>(resource, 50);
      if (records.length) {
        return records;
      }
    } catch {
      // Epos installations differ on image resource naming. Try the next known shape.
    }
  }

  return [];
}

function buildImageUrlsByProductId(records: EposImageRecord[]) {
  const byProductId = new Map<string, Set<string>>();

  records.forEach((record) => {
    const productId = getImageRecordProductId(record);
    if (!productId) {
      return;
    }

    const urls = collectImageUrls(record);
    const directUrl = getEposString(record, ["ImageUrl", "ImageURL", "Url", "URL", "FileUrl", "FileURL", "ImagePath"]);
    if (directUrl?.startsWith("http")) {
      urls.add(directUrl);
    }

    if (!urls.size) {
      return;
    }

    const existing = byProductId.get(productId) || new Set<string>();
    urls.forEach((url) => existing.add(url));
    byProductId.set(productId, existing);
  });

  return byProductId;
}

export async function importEposProductImages({ skipExisting = true, limit = 25 } = {}) {
  await ensureProductAdminTables();

  const sql = getSql();
  const eposImageRecords = await fetchEposImageRecords();
  const imageUrlsByProductId = buildImageUrlsByProductId(eposImageRecords);
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
    eposImageRecordsFound: eposImageRecords.length,
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

    const productId = String(product.epos_product_id);
    const imageUrls = [...new Set([...collectImageUrls(product.raw), ...(imageUrlsByProductId.get(productId) || [])])];
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
        const pathname = `products/${productId}/epos-${safeName(productId)}-${index}.${extension}`;

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
          await sql`UPDATE product_images SET is_primary = FALSE WHERE epos_product_id = ${productId}`;
        }

        await sql`
          INSERT INTO product_images (epos_product_id, url, pathname, alt_text, sort_order, is_primary)
          VALUES (${productId}, ${blob.url}, ${blob.pathname}, ${String(product.name)}, ${index}, ${index === 0})
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
