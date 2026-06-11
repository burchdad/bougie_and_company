import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";

const databaseUrl = process.env.DATABASE_URL;
const eposBaseUrl = (process.env.EPOS_API_BASE_URL || "https://api.eposnowhq.com/api/V4").replace(/\/$/, "");
const eposToken = process.env.EPOS_AUTH_TOKEN;
const importImages = process.env.IMPORT_EPOS_IMAGES === "true" || process.argv.includes("--images");
const imageLimitArg = process.argv.find((arg) => arg.startsWith("--image-limit="));
const imageLimit = Math.min(Math.max(Number(imageLimitArg?.split("=")[1] || process.env.EPOS_IMAGE_IMPORT_LIMIT || 100), 1), 250);

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not configured.");
}

if (!eposToken) {
  throw new Error("EPOS_AUTH_TOKEN is not configured.");
}

const sql = neon(databaseUrl);

function authHeader() {
  return eposToken.startsWith("Basic ") ? eposToken : `Basic ${eposToken}`;
}

async function eposFetch(path) {
  const response = await fetch(`${eposBaseUrl}/${path.replace(/^\//, "")}`, {
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Epos request failed: ${response.status} ${response.statusText} ${await response.text()}`.trim());
  }

  return response.json();
}

async function fetchCollection(resource, maxPages = Number(process.env.EPOS_MAX_PAGES || 50)) {
  const records = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const separator = resource.includes("?") ? "&" : "?";
    const pageRecords = await eposFetch(`${resource}${separator}page=${page}`);

    if (!Array.isArray(pageRecords) || pageRecords.length === 0) {
      break;
    }

    records.push(...pageRecords);

    if (pageRecords.length < 200) {
      break;
    }
  }

  return records;
}

function recordId(record) {
  const id = record.Id ?? record.ID ?? record.id;
  return typeof id === "number" || typeof id === "string" ? String(id) : null;
}

function recordString(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function recordNumber(record, keys) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

async function ensureTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS epos_products (
      epos_product_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      sku TEXT,
      barcode TEXT,
      category_id NUMERIC,
      sale_price NUMERIC(12, 2),
      cost_price NUMERIC(12, 2),
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS epos_product_stock (
      epos_stock_id TEXT PRIMARY KEY,
      epos_product_id NUMERIC,
      location_id NUMERIC,
      current_stock NUMERIC,
      on_order NUMERIC,
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
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
  await sql`
    CREATE TABLE IF NOT EXISTS product_deletion_overrides (
      epos_product_id TEXT PRIMARY KEY,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reason TEXT
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS epos_products_name_idx ON epos_products (name)`;
  await sql`CREATE INDEX IF NOT EXISTS epos_products_sku_idx ON epos_products (sku)`;
  await sql`CREATE INDEX IF NOT EXISTS epos_product_stock_product_idx ON epos_product_stock (epos_product_id)`;
  await sql`CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images (epos_product_id, sort_order ASC)`;
}

async function syncProducts() {
  const products = await fetchCollection("Product");
  const deletedRows = await sql`SELECT epos_product_id FROM product_deletion_overrides`;
  const deletedProductIds = new Set(deletedRows.map((row) => String(row.epos_product_id)));

  for (const product of products) {
    const productId = recordId(product);
    if (!productId) {
      continue;
    }

    if (deletedProductIds.has(productId)) {
      await sql`
        UPDATE epos_products
        SET is_deleted = TRUE, synced_at = NOW()
        WHERE epos_product_id = ${productId}
      `;
      continue;
    }

    await sql`
      INSERT INTO epos_products (epos_product_id, name, description, sku, barcode, category_id, sale_price, cost_price, raw, synced_at)
      VALUES (
        ${productId},
        ${recordString(product, ["Name", "name"]) || "Untitled product"},
        ${recordString(product, ["Description", "description"])},
        ${recordString(product, ["Sku", "SKU", "sku"])},
        ${recordString(product, ["Barcode", "BarCode", "barcode"])},
        ${recordNumber(product, ["CategoryId", "CategoryID", "categoryId"])},
        ${recordNumber(product, ["SalePrice", "Price", "UnitPrice", "salePrice", "price"])},
        ${recordNumber(product, ["CostPrice", "costPrice"])},
        ${JSON.stringify(product)}::jsonb,
        NOW()
      )
      ON CONFLICT (epos_product_id)
      DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, sku = EXCLUDED.sku, barcode = EXCLUDED.barcode,
        category_id = EXCLUDED.category_id, sale_price = EXCLUDED.sale_price, cost_price = EXCLUDED.cost_price,
        raw = EXCLUDED.raw, is_deleted = FALSE, synced_at = NOW()
    `;
  }

  return products.length;
}

async function syncStock() {
  const stockRecords = await fetchCollection("ProductStock");

  for (const stock of stockRecords) {
    const stockId = recordId(stock);
    if (!stockId) {
      continue;
    }

    await sql`
      INSERT INTO epos_product_stock (epos_stock_id, epos_product_id, location_id, current_stock, on_order, raw, synced_at)
      VALUES (
        ${stockId},
        ${recordNumber(stock, ["ProductId", "ProductID", "productId"])},
        ${recordNumber(stock, ["LocationId", "LocationID", "locationId"])},
        ${recordNumber(stock, ["CurrentStock", "StockLevel", "Stock", "Quantity", "Qty", "Available", "currentStock", "stockLevel", "stock", "quantity"])},
        ${recordNumber(stock, ["OnOrder", "onOrder"])},
        ${JSON.stringify(stock)}::jsonb,
        NOW()
      )
      ON CONFLICT (epos_stock_id)
      DO UPDATE SET epos_product_id = EXCLUDED.epos_product_id, location_id = EXCLUDED.location_id,
        current_stock = EXCLUDED.current_stock, on_order = EXCLUDED.on_order, raw = EXCLUDED.raw, synced_at = NOW()
    `;
  }

  return stockRecords.length;
}

const imageKeyPattern = /(image|photo|picture|thumbnail|media|avatar|icon)/i;
const imageUrlPattern = /^https?:\/\/.+\.(avif|gif|jpe?g|png|webp)(\?.*)?$/i;

function collectImageUrls(value, parentKey = "", urls = new Set()) {
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
    Object.entries(value).forEach(([key, child]) => collectImageUrls(child, key, urls));
  }
  return urls;
}

function imageExtension(url, contentType) {
  const match = new URL(url).pathname.match(/\.([a-z0-9]+)$/i);
  if (match?.[1]) {
    return match[1].toLowerCase();
  }
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("gif")) return "gif";
  return "jpg";
}

async function importImagesFromProducts() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log("Skipping image import: BLOB_READ_WRITE_TOKEN is not configured.");
    return { uploaded: 0, failed: 0, imageUrlsFound: 0, remainingWithoutPhotos: null };
  }

  const products = await sql`
    SELECT p.epos_product_id, p.name, p.raw
    FROM epos_products p
    WHERE p.is_deleted = FALSE
      AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.epos_product_id = p.epos_product_id)
    ORDER BY p.name ASC
    LIMIT ${imageLimit}
  `;
  const result = { uploaded: 0, failed: 0, imageUrlsFound: 0 };

  for (const product of products) {
    const imageUrls = [...collectImageUrls(product.raw)];
    result.imageUrlsFound += imageUrls.length;

    for (const [index, imageUrl] of imageUrls.entries()) {
      try {
        const response = await fetch(imageUrl, { cache: "no-store" });
        const contentType = response.headers.get("content-type");
        if (!response.ok || !contentType?.startsWith("image/")) {
          result.failed += 1;
          continue;
        }

        const pathname = `products/${product.epos_product_id}/epos-${product.epos_product_id}-${index}.${imageExtension(imageUrl, contentType)}`;
        const blob = await put(pathname, await response.blob(), { access: "public", contentType, addRandomSuffix: true });

        if (index === 0) {
          await sql`UPDATE product_images SET is_primary = FALSE WHERE epos_product_id = ${String(product.epos_product_id)}`;
        }

        await sql`
          INSERT INTO product_images (epos_product_id, url, pathname, alt_text, sort_order, is_primary)
          VALUES (${String(product.epos_product_id)}, ${blob.url}, ${blob.pathname}, ${String(product.name)}, ${index}, ${index === 0})
        `;
        result.uploaded += 1;
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        result.failed += 1;
      }
    }
  }

  const remainingRows = await sql`
    SELECT COUNT(*)::int AS count
    FROM epos_products p
    WHERE p.is_deleted = FALSE
      AND NOT EXISTS (SELECT 1 FROM product_images i WHERE i.epos_product_id = p.epos_product_id)
  `;

  return { ...result, remainingWithoutPhotos: Number(remainingRows[0]?.count || 0) };
}

await ensureTables();
const products = await syncProducts();
const stock = await syncStock();
const images = importImages ? await importImagesFromProducts() : undefined;

console.log(JSON.stringify({ ok: true, products, stock, ...(images ? { images } : {}) }, null, 2));
