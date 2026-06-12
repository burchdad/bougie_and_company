import { list, put } from "@vercel/blob";
import { ensureProductAdminTables } from "@/lib/admin-products";
import { getSql } from "@/lib/db";
import { eposFetch, getEposString } from "@/lib/epos";

const imageKeyPattern = /(image|photo|picture|thumbnail|media|avatar|icon)/i;
const imageUrlPattern = /^https?:\/\/.+\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i;
const imageImportBudgetMs = 45_000;
const eposImageLookupTimeoutMs = 3_000;

type ImageImportResult = {
  productsScanned: number;
  eposImageRecordsFound: number;
  eposImageRecordsMatched: number;
  productImageLookups: number;
  productImageRecordsFound: number;
  blobImagesFound: number;
  blobImagesMatched: number;
  blobImagesAlreadyLinked: number;
  blobImagesLinked: number;
  blobImagesUnmatched: number;
  blobImageRepairError: string | null;
  imageUrlsFound: number;
  uploaded: number;
  skippedExisting: number;
  skippedDuplicate: number;
  failed: number;
  failureSamples: Array<{
    host: string;
    status?: number;
    contentType?: string | null;
    reason: string;
  }>;
  remainingWithoutPhotos: number;
};

type EposImageRecord = Record<string, unknown>;
type BlobImageRepairResult = {
  found: number;
  matched: number;
  alreadyLinked: number;
  linked: number;
  unmatched: number;
  error: string | null;
};

type BlobHydrationResult = {
  scanned: number;
  hydrated: number;
  failed: number;
  remainingExternal: number;
  failureSamples: ImageImportResult["failureSamples"];
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

function isUsableImageResponse(imageUrl: string, contentType: string | null) {
  return Boolean(contentType?.startsWith("image/") || contentType?.includes("application/octet-stream") || imageUrlPattern.test(imageUrl));
}

function imageContentTypeFrom(extension: string, contentType: string | null) {
  if (contentType?.startsWith("image/")) {
    return contentType;
  }

  if (extension === "png") {
    return "image/png";
  }

  if (extension === "webp") {
    return "image/webp";
  }

  if (extension === "gif") {
    return "image/gif";
  }

  if (extension === "avif") {
    return "image/avif";
  }

  return "image/jpeg";
}

function addFailureSample(result: { failureSamples: ImageImportResult["failureSamples"] }, imageUrl: string, reason: string, details: { status?: number; contentType?: string | null } = {}) {
  if (result.failureSamples.length >= 5) {
    return;
  }

  let host = "unknown";
  try {
    host = new URL(imageUrl).host;
  } catch {
    host = "invalid-url";
  }

  result.failureSamples.push({
    host,
    reason,
    ...details
  });
}

function safeName(value: string) {
  return value
    .replace(/[^a-z0-9._-]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 90);
}

function isImagePathname(pathname: string) {
  return /\.(avif|gif|jpe?g|png|webp)$/i.test(pathname);
}

function blobFolderFromPathname(pathname: string) {
  const match = pathname.match(/^products\/([^/]+)\//);
  return match?.[1] || null;
}

function blobProductIdFromPathname(pathname: string) {
  const match = pathname.match(/(?:^|\/)epos-(\d+)-/i);
  return match?.[1] || null;
}

function normalizedLookup(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/^[a-z]{2,}\d+[a-z0-9-]*\s+/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  return normalized || null;
}

function findNestedValue(record: unknown, keys: string[], seen = new Set<unknown>()): unknown {
  if (!record || typeof record !== "object" || seen.has(record)) {
    return null;
  }

  seen.add(record);

  if (Array.isArray(record)) {
    for (const item of record) {
      const value = findNestedValue(item, keys, seen);
      if (value !== null && value !== undefined && value !== "") {
        return value;
      }
    }

    return null;
  }

  const object = record as Record<string, unknown>;
  for (const key of keys) {
    const value = object[key];
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  for (const child of Object.values(object)) {
    const value = findNestedValue(child, keys, seen);
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return null;
}

function collectRecords(value: unknown, records: EposImageRecord[] = [], seen = new Set<unknown>()) {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return records;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((item) => collectRecords(item, records, seen));
    return records;
  }

  const object = value as EposImageRecord;
  if (collectImageUrls(object).size) {
    records.push(object);
  }

  Object.values(object).forEach((child) => collectRecords(child, records, seen));

  return records;
}

function getNestedString(record: unknown, keys: string[]) {
  const value = findNestedValue(record, keys);
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function getImageRecordProductId(record: EposImageRecord) {
  const value = findNestedValue(record, ["ProductId", "ProductID", "productId", "productID", "product_id"]);

  if (typeof value === "number" || typeof value === "string") {
    return String(value);
  }

  return null;
}

async function fetchEposRecords(resource: string, maxPages = 1) {
  const records: EposImageRecord[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const separator = resource.includes("?") ? "&" : "?";
    const response = await eposFetch<unknown>(`${resource}${separator}page=${page}`, {
      signal: AbortSignal.timeout(eposImageLookupTimeoutMs)
    });
    const pageRecords = collectRecords(response);
    records.push(...pageRecords);

    if (!Array.isArray(response) || response.length === 0 || response.length < 200) {
      break;
    }
  }

  return records;
}

async function fetchEposImageRecords() {
  const resources = [
    "ProductImage",
    "ProductImages",
    "ProductImage/Get",
    "ProductImages/Get",
    "ProductAttachment",
    "ProductAttachments",
    "ProductMedia",
    "ProductImages/GetProductImages",
    "Image",
    "Images"
  ];
  const records: EposImageRecord[] = [];
  const seen = new Set<string>();

  for (const resource of resources) {
    try {
      const resourceRecords = await fetchEposRecords(resource, 2);
      for (const record of resourceRecords) {
        const fingerprint = JSON.stringify(record);
        if (!seen.has(fingerprint)) {
          seen.add(fingerprint);
          records.push(record);
        }
      }
    } catch {
      // Epos installations differ on image resource naming. Try the next known shape.
    }
  }

  return records;
}

function productImageResources(productId: string) {
  const encodedId = encodeURIComponent(productId);
  return [
    `Product/${encodedId}`,
    `Product/${encodedId}/Images`,
    `ProductImage?ProductId=${encodedId}`,
    `ProductImages?ProductId=${encodedId}`,
    `Product/${encodedId}/Image`,
    `ProductAttachments?ProductId=${encodedId}`
  ];
}

async function fetchProductImageRecords(productId: string) {
  const records: EposImageRecord[] = [];
  const seen = new Set<string>();
  let lookups = 0;

  for (const resource of productImageResources(productId)) {
    lookups += 1;
    try {
      const resourceRecords = await fetchEposRecords(resource);
      for (const record of resourceRecords) {
        const fingerprint = JSON.stringify(record);
        if (!seen.has(fingerprint)) {
          seen.add(fingerprint);
          records.push(record);
        }
      }

      if (records.length) {
        break;
      }
    } catch {
      // Epos image routes are not consistent across stores; keep trying product-scoped shapes.
    }
  }

  return { records, lookups };
}

function addUrls(target: Map<string, Set<string>>, key: string | null, urls: Set<string>) {
  if (!key || !urls.size) {
    return;
  }

  const existing = target.get(key) || new Set<string>();
  urls.forEach((url) => existing.add(url));
  target.set(key, existing);
}

function buildImageUrlIndexes(records: EposImageRecord[]) {
  const byProductId = new Map<string, Set<string>>();
  const bySku = new Map<string, Set<string>>();
  const byName = new Map<string, Set<string>>();
  let matchedRecords = 0;

  records.forEach((record) => {
    const productId = getImageRecordProductId(record);
    const sku = normalizedLookup(getNestedString(record, ["Sku", "SKU", "sku", "ProductSku", "ProductSKU", "productSku"]));
    const name = normalizedLookup(getNestedString(record, ["Name", "name", "ProductName", "productName", "Description", "description"]));

    const urls = collectImageUrls(record);
    const directUrl = getEposString(record, ["ImageUrl", "ImageURL", "Url", "URL", "FileUrl", "FileURL", "ImagePath"]);
    if (directUrl?.startsWith("http")) {
      urls.add(directUrl);
    }

    if (!urls.size) {
      return;
    }

    if (productId || sku || name) {
      matchedRecords += 1;
    }

    addUrls(byProductId, productId, urls);
    addUrls(bySku, sku, urls);
    addUrls(byName, name, urls);
  });

  return { byProductId, bySku, byName, matchedRecords };
}

function collectIndexedImageUrls(record: EposImageRecord, productId: string, productSku: string | null, productName: string | null) {
  const index = buildImageUrlIndexes([record]);
  const skuKey = normalizedLookup(productSku);
  const nameKey = normalizedLookup(productName);

  return [
    ...new Set([
      ...collectImageUrls(record),
      ...(index.byProductId.get(productId) || []),
      ...(skuKey ? index.bySku.get(skuKey) || [] : []),
      ...(nameKey ? index.byName.get(nameKey) || [] : [])
    ])
  ];
}

async function listProductBlobs(maxBlobs = 5000) {
  const blobs: Array<{ url: string; pathname: string }> = [];
  let cursor: string | undefined;

  do {
    const page = await list({ prefix: "products/", limit: 1000, cursor });
    blobs.push(...page.blobs.filter((blob) => isImagePathname(blob.pathname)).map((blob) => ({ url: blob.url, pathname: blob.pathname })));
    cursor = page.cursor;
  } while (cursor && blobs.length < maxBlobs);

  return blobs.slice(0, maxBlobs);
}

async function linkExistingBlobImages() {
  const sql = getSql();

  try {
    const blobs = await listProductBlobs();
    if (!blobs.length) {
      return { found: 0, matched: 0, alreadyLinked: 0, linked: 0, unmatched: 0, error: null } satisfies BlobImageRepairResult;
    }

    const products = await sql`
      SELECT epos_product_id, name, sku
      FROM epos_products
      WHERE is_deleted = FALSE
    `;
    const productsByFolder = new Map<string, Array<{ epos_product_id: string; name: string; sku: string | null }>>();

    products.forEach((product) => {
      const candidates = [
        String(product.epos_product_id),
        typeof product.sku === "string" ? safeName(product.sku) : null,
        typeof product.name === "string" ? safeName(product.name) : null
      ].filter(Boolean) as string[];

      candidates.forEach((candidate) => {
        productsByFolder.set(candidate, [...(productsByFolder.get(candidate) || []), product as { epos_product_id: string; name: string; sku: string | null }]);
      });
    });

    const existingRows = await sql`SELECT epos_product_id, pathname FROM product_images WHERE pathname IS NOT NULL`;
    const existingPairs = new Set(existingRows.map((row) => `${String(row.epos_product_id)}::${String(row.pathname)}`));
    let matched = 0;
    let alreadyLinked = 0;
    let linked = 0;
    let unmatched = 0;

    for (const blob of blobs) {
      const folder = blobFolderFromPathname(blob.pathname);
      const productId = blobProductIdFromPathname(blob.pathname);
      const matches = [
        ...new Map(
          [...(folder ? productsByFolder.get(folder) || [] : []), ...(productId ? productsByFolder.get(productId) || [] : [])].map((product) => [
            String(product.epos_product_id),
            product
          ])
        ).values()
      ];

      if (!matches.length) {
        unmatched += 1;
        continue;
      }

      matched += 1;

      for (const [index, product] of matches.entries()) {
        const pairKey = `${String(product.epos_product_id)}::${blob.pathname}`;
        if (existingPairs.has(pairKey)) {
          alreadyLinked += 1;
          continue;
        }

        const isPrimary = index === 0;
        if (isPrimary) {
          await sql`UPDATE product_images SET is_primary = FALSE WHERE epos_product_id = ${String(product.epos_product_id)}`;
        }

        await sql`
          INSERT INTO product_images (epos_product_id, url, pathname, alt_text, sort_order, is_primary)
          VALUES (${String(product.epos_product_id)}, ${blob.url}, ${blob.pathname}, ${String(product.name)}, 0, ${isPrimary})
        `;
        linked += 1;
        existingPairs.add(pairKey);
      }
    }

    return { found: blobs.length, matched, alreadyLinked, linked, unmatched, error: null } satisfies BlobImageRepairResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Existing Blob image repair failed.";
    console.error(message);
    return { found: 0, matched: 0, alreadyLinked: 0, linked: 0, unmatched: 0, error: message } satisfies BlobImageRepairResult;
  }
}

export async function importEposProductImages({ skipExisting = true, limit = 25 } = {}) {
  const startedAt = Date.now();
  await ensureProductAdminTables();

  const sql = getSql();
  const shouldRepairBlobs = process.env.EPOS_IMAGE_REPAIR_BLOBS === "true";
  const blobRepair = shouldRepairBlobs
    ? await linkExistingBlobImages()
    : ({ found: 0, matched: 0, alreadyLinked: 0, linked: 0, unmatched: 0, error: null } satisfies BlobImageRepairResult);
  const products = skipExisting
    ? await sql`
        SELECT p.epos_product_id, p.name, p.sku, p.raw, COUNT(i.id)::int AS image_count
        FROM epos_products p
        LEFT JOIN product_images i ON i.epos_product_id = p.epos_product_id
        WHERE p.is_deleted = FALSE
          AND NOT EXISTS (
            SELECT 1
            FROM product_images existing
            WHERE existing.epos_product_id = p.epos_product_id
          )
        GROUP BY p.epos_product_id, p.name, p.sku, p.raw
        ORDER BY p.name ASC
        LIMIT ${limit}
      `
    : await sql`
    SELECT p.epos_product_id, p.name, p.sku, p.raw, COUNT(i.id)::int AS image_count
    FROM epos_products p
    LEFT JOIN product_images i ON i.epos_product_id = p.epos_product_id
    WHERE p.is_deleted = FALSE
    GROUP BY p.epos_product_id, p.name, p.sku, p.raw
    ORDER BY p.name ASC
        LIMIT ${limit}
  `;
  const shouldGlobalScan = process.env.EPOS_IMAGE_IMPORT_GLOBAL_SCAN === "true";
  const eposImageRecords = shouldGlobalScan ? await fetchEposImageRecords() : [];
  const imageIndexes = buildImageUrlIndexes(eposImageRecords);

  const result: ImageImportResult = {
    productsScanned: products.length,
    eposImageRecordsFound: eposImageRecords.length,
    eposImageRecordsMatched: imageIndexes.matchedRecords,
    productImageLookups: 0,
    productImageRecordsFound: 0,
    blobImagesFound: blobRepair.found,
    blobImagesMatched: blobRepair.matched,
    blobImagesAlreadyLinked: blobRepair.alreadyLinked,
    blobImagesLinked: blobRepair.linked,
    blobImagesUnmatched: blobRepair.unmatched,
    blobImageRepairError: blobRepair.error,
    imageUrlsFound: 0,
    uploaded: 0,
    skippedExisting: 0,
    skippedDuplicate: 0,
    failed: 0,
    failureSamples: [],
    remainingWithoutPhotos: 0
  };

  const existingPathRows = await sql`SELECT pathname FROM product_images WHERE pathname IS NOT NULL`;
  const existingPathnames = new Set(existingPathRows.map((row) => String(row.pathname)));

  for (const product of products) {
    if (Date.now() - startedAt > imageImportBudgetMs) {
      break;
    }

    if (skipExisting && Number(product.image_count || 0) > 0) {
      result.skippedExisting += 1;
      continue;
    }

    const productId = String(product.epos_product_id);
    const productSku = typeof product.sku === "string" ? product.sku : null;
    const productName = typeof product.name === "string" ? product.name : null;
    const skuKey = normalizedLookup(productSku);
    const nameKey = normalizedLookup(productName);
    const imageUrls = [
      ...new Set([
        ...collectImageUrls(product.raw),
        ...(imageIndexes.byProductId.get(productId) || []),
        ...(skuKey ? imageIndexes.bySku.get(skuKey) || [] : []),
        ...(nameKey ? imageIndexes.byName.get(nameKey) || [] : [])
      ])
    ];

    if (!imageUrls.length) {
      const productImageRecords = await fetchProductImageRecords(productId);
      result.productImageLookups += productImageRecords.lookups;
      result.productImageRecordsFound += productImageRecords.records.length;

      for (const record of productImageRecords.records) {
        collectIndexedImageUrls(record, productId, productSku, productName).forEach((url) => {
          if (!imageUrls.includes(url)) {
            imageUrls.push(url);
          }
        });
      }
    }

    result.imageUrlsFound += imageUrls.length;

    let uploadedForProduct = 0;
    let failedForProduct = 0;

    for (const [index, imageUrl] of imageUrls.entries()) {
      try {
        const response = await fetch(imageUrl, { cache: "no-store" });

        if (!response.ok) {
          result.failed += 1;
          failedForProduct += 1;
          addFailureSample(result, imageUrl, "fetch-not-ok", { status: response.status, contentType: response.headers.get("content-type") });
          continue;
        }

        const contentType = response.headers.get("content-type");
        if (!isUsableImageResponse(imageUrl, contentType)) {
          result.failed += 1;
          failedForProduct += 1;
          addFailureSample(result, imageUrl, "not-image-content-type", { status: response.status, contentType });
          continue;
        }

        const extension = extensionFrom(imageUrl, contentType);
        const uploadContentType = imageContentTypeFrom(extension, contentType);
        const folderName = safeName(productSku || productName || productId) || safeName(productId);
        const pathname = `products/${folderName}/epos-${safeName(productSku || productId)}-${index}.${extension}`;

        if (existingPathnames.has(pathname)) {
          result.skippedDuplicate += 1;
          continue;
        }

        const blob = await put(pathname, await response.blob(), {
          access: "public",
          contentType: uploadContentType,
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
        uploadedForProduct += 1;
      } catch (error) {
        console.error(error instanceof Error ? error.message : "Epos product image import failed.");
        result.failed += 1;
        failedForProduct += 1;
        addFailureSample(result, imageUrl, error instanceof Error ? error.message : "fetch-error");
      }
    }

    if (uploadedForProduct === 0 && failedForProduct > 0 && Date.now() - startedAt <= imageImportBudgetMs) {
      const productImageRecords = await fetchProductImageRecords(productId);
      result.productImageLookups += productImageRecords.lookups;
      result.productImageRecordsFound += productImageRecords.records.length;

      const freshImageUrls = [
        ...new Set(
          productImageRecords.records.flatMap((record) => collectIndexedImageUrls(record, productId, productSku, productName)).filter((url) => !imageUrls.includes(url))
        )
      ];
      result.imageUrlsFound += freshImageUrls.length;

      for (const [index, imageUrl] of freshImageUrls.entries()) {
        try {
          const response = await fetch(imageUrl, { cache: "no-store" });

          if (!response.ok) {
            result.failed += 1;
            addFailureSample(result, imageUrl, "fresh-fetch-not-ok", { status: response.status, contentType: response.headers.get("content-type") });
            continue;
          }

          const contentType = response.headers.get("content-type");
          if (!isUsableImageResponse(imageUrl, contentType)) {
            result.failed += 1;
            addFailureSample(result, imageUrl, "fresh-not-image-content-type", { status: response.status, contentType });
            continue;
          }

          const extension = extensionFrom(imageUrl, contentType);
          const uploadContentType = imageContentTypeFrom(extension, contentType);
          const folderName = safeName(productSku || productName || productId) || safeName(productId);
          const pathname = `products/${folderName}/epos-${safeName(productSku || productId)}-${index}.${extension}`;

          if (existingPathnames.has(pathname)) {
            result.skippedDuplicate += 1;
            continue;
          }

          const blob = await put(pathname, await response.blob(), {
            access: "public",
            contentType: uploadContentType,
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
          addFailureSample(result, imageUrl, error instanceof Error ? error.message : "fresh-fetch-error");
        }
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

export async function hydrateExternalProductImages({ limit = 50 } = {}) {
  const startedAt = Date.now();
  await ensureProductAdminTables();

  const sql = getSql();
  const rows = await sql`
    SELECT
      i.id::text,
      i.epos_product_id,
      i.url,
      i.alt_text,
      i.sort_order,
      p.name,
      p.sku
    FROM product_images i
    JOIN epos_products p ON p.epos_product_id = i.epos_product_id
    WHERE p.is_deleted = FALSE
      AND i.pathname IS NULL
      AND i.url LIKE 'http%'
      AND i.url NOT LIKE '%.public.blob.vercel-storage.com%'
    ORDER BY i.is_primary DESC, i.created_at ASC
    LIMIT ${Math.min(Math.max(Math.trunc(limit), 1), 250)}
  `;

  const result: BlobHydrationResult = {
    scanned: rows.length,
    hydrated: 0,
    failed: 0,
    remainingExternal: 0,
    failureSamples: []
  };

  for (const row of rows) {
    if (Date.now() - startedAt > imageImportBudgetMs) {
      break;
    }

    const imageUrl = String(row.url);

    try {
      const response = await fetch(imageUrl, { cache: "no-store" });

      if (!response.ok) {
        result.failed += 1;
        addFailureSample(result, imageUrl, "hydrate-fetch-not-ok", { status: response.status, contentType: response.headers.get("content-type") });
        continue;
      }

      const contentType = response.headers.get("content-type");
      if (!isUsableImageResponse(imageUrl, contentType)) {
        result.failed += 1;
        addFailureSample(result, imageUrl, "hydrate-not-image-content-type", { status: response.status, contentType });
        continue;
      }

      const productId = String(row.epos_product_id);
      const productSku = typeof row.sku === "string" ? row.sku : null;
      const productName = typeof row.name === "string" ? row.name : null;
      const extension = extensionFrom(imageUrl, contentType);
      const uploadContentType = imageContentTypeFrom(extension, contentType);
      const folderName = safeName(productSku || productName || productId) || safeName(productId);
      const pathname = `products/${folderName}/epos-${safeName(productSku || productId)}-${row.id}.${extension}`;
      const blob = await put(pathname, await response.blob(), {
        access: "public",
        contentType: uploadContentType,
        addRandomSuffix: true
      });

      await sql`
        UPDATE product_images
        SET url = ${blob.url},
          pathname = ${blob.pathname},
          alt_text = COALESCE(alt_text, ${productName})
        WHERE id = ${String(row.id)}
      `;
      result.hydrated += 1;
    } catch (error) {
      result.failed += 1;
      addFailureSample(result, imageUrl, error instanceof Error ? error.message : "hydrate-fetch-error");
    }
  }

  const remainingRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM product_images i
    JOIN epos_products p ON p.epos_product_id = i.epos_product_id
    WHERE p.is_deleted = FALSE
      AND i.pathname IS NULL
      AND i.url LIKE 'http%'
      AND i.url NOT LIKE '%.public.blob.vercel-storage.com%'
  `;
  result.remainingExternal = Number(remainingRows[0]?.count || 0);

  return result;
}
