import { getSql } from "@/lib/db";
import { getDropshippingSchema } from "./config";
import { calculateDropshipRetailPrice } from "./pricing";
import { getSupplierAdapter, listSupplierAdapters } from "./suppliers";
import type { MarkupType, NormalizedSupplierProduct, SupplierSyncParams } from "./types";

export type DropshipAdminProduct = {
  id: string;
  supplier_key: string;
  supplier_product_id: string;
  supplier_sku: string | null;
  title: string;
  description: string | null;
  category_names: string[];
  image_url: string | null;
  second_image_url: string | null;
  wholesale_price: string | null;
  original_price: string | null;
  suggested_retail_price: string | null;
  shipping_cost: string | null;
  currency: string | null;
  warehouse_type: string | null;
  total_inventory: string;
  route_url: string | null;
  last_synced_at: string | null;
  variants_count: number;
  in_stock_variants: number;
  published_id: string | null;
  title_override: string | null;
  description_override: string | null;
  price_override: string | null;
  markup_type: MarkupType | null;
  markup_value: string | null;
  is_published: boolean;
  collection: string | null;
  retail_price: number;
};

type DropshipQuery = {
  supplierKey?: string;
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  published?: boolean | null;
  inStock?: boolean | null;
};

function isUndefinedTableError(error: unknown) {
  return error instanceof Error && (error.message.includes("does not exist") || "code" in error && (error as { code?: string }).code === "42P01");
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function tableName(name: string) {
  const schema = getDropshippingSchema();
  return schema ? `${quoteIdentifier(schema)}.${quoteIdentifier(name)}` : quoteIdentifier(name);
}

function dropshipTableNames() {
  return {
    sources: tableName("supplier_sources"),
    products: tableName("supplier_products"),
    variants: tableName("supplier_variants"),
    images: tableName("supplier_images"),
    categories: tableName("supplier_categories"),
    syncRuns: tableName("supplier_sync_runs"),
    published: tableName("dropship_published_products")
  };
}

function dropshipTables(sql: ReturnType<typeof getSql>) {
  const names = dropshipTableNames();

  return {
    sources: sql.unsafe(names.sources),
    products: sql.unsafe(names.products),
    variants: sql.unsafe(names.variants),
    images: sql.unsafe(names.images),
    categories: sql.unsafe(names.categories),
    syncRuns: sql.unsafe(names.syncRuns),
    published: sql.unsafe(names.published)
  };
}

async function executeTrustedStatement(sql: ReturnType<typeof getSql>, statement: string) {
  await sql.query(statement, []);
}

async function verifyDropshippingTables(sql: ReturnType<typeof getSql>) {
  const schema = getDropshippingSchema();
  if (!schema) {
    return;
  }

  const requiredTables = [
    "supplier_sources",
    "supplier_products",
    "supplier_variants",
    "supplier_images",
    "supplier_categories",
    "supplier_sync_runs",
    "dropship_published_products"
  ];
  const rows = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ${schema}
      AND table_name IN (SELECT value::text FROM jsonb_array_elements_text(${JSON.stringify(requiredTables)}::jsonb))
  `;
  const found = new Set(rows.map((row) => String(row.table_name)));
  const missing = requiredTables.filter((table) => !found.has(table));

  if (missing.length) {
    throw new Error(`Dropshipping schema initialization incomplete. Missing table(s): ${missing.join(", ")}.`);
  }
}

export async function ensureDropshippingTables() {
  const sql = getSql();
  const schema = getDropshippingSchema();
  const names = dropshipTableNames();
  const tables = dropshipTables(sql);

  if (schema) {
    await executeTrustedStatement(sql, `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schema)}`);
  }

  await executeTrustedStatement(sql, `
    CREATE TABLE IF NOT EXISTS ${names.sources} (
      id BIGSERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      base_url TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await executeTrustedStatement(sql, `
    CREATE TABLE IF NOT EXISTS ${names.products} (
      id BIGSERIAL PRIMARY KEY,
      supplier_key TEXT NOT NULL,
      supplier_product_id TEXT NOT NULL,
      supplier_sku TEXT,
      title TEXT NOT NULL,
      description TEXT,
      category_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      image_url TEXT,
      second_image_url TEXT,
      wholesale_price NUMERIC(12, 2),
      original_price NUMERIC(12, 2),
      suggested_retail_price NUMERIC(12, 2),
      shipping_cost NUMERIC(12, 2),
      currency TEXT,
      warehouse_type TEXT,
      total_inventory NUMERIC NOT NULL DEFAULT 0,
      route_url TEXT,
      raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (supplier_key, supplier_product_id)
    )
  `);

  await executeTrustedStatement(sql, `
    CREATE TABLE IF NOT EXISTS ${names.variants} (
      id BIGSERIAL PRIMARY KEY,
      supplier_key TEXT NOT NULL,
      supplier_product_id TEXT NOT NULL,
      supplier_variant_id TEXT NOT NULL,
      sku TEXT,
      barcode TEXT,
      title TEXT,
      color TEXT,
      size TEXT,
      size_name TEXT,
      price NUMERIC(12, 2),
      weight NUMERIC(12, 4),
      inventory_quantity NUMERIC NOT NULL DEFAULT 0,
      is_in_stock BOOLEAN NOT NULL DEFAULT FALSE,
      raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      last_synced_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (supplier_key, supplier_variant_id)
    )
  `);

  await executeTrustedStatement(sql, `
    CREATE TABLE IF NOT EXISTS ${names.images} (
      id BIGSERIAL PRIMARY KEY,
      supplier_key TEXT NOT NULL,
      supplier_product_id TEXT NOT NULL,
      url TEXT NOT NULL,
      alt_text TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (supplier_key, supplier_product_id, url)
    )
  `);

  await executeTrustedStatement(sql, `
    CREATE TABLE IF NOT EXISTS ${names.categories} (
      id BIGSERIAL PRIMARY KEY,
      supplier_key TEXT NOT NULL,
      name TEXT NOT NULL,
      raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (supplier_key, name)
    )
  `);

  await executeTrustedStatement(sql, `
    CREATE TABLE IF NOT EXISTS ${names.syncRuns} (
      id BIGSERIAL PRIMARY KEY,
      supplier_key TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      products_seen INTEGER NOT NULL DEFAULT 0,
      products_upserted INTEGER NOT NULL DEFAULT 0,
      variants_seen INTEGER NOT NULL DEFAULT 0,
      variants_upserted INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await executeTrustedStatement(sql, `
    CREATE TABLE IF NOT EXISTS ${names.published} (
      id BIGSERIAL PRIMARY KEY,
      supplier_key TEXT NOT NULL,
      supplier_product_id TEXT NOT NULL,
      local_product_id TEXT,
      title_override TEXT,
      description_override TEXT,
      price_override NUMERIC(12, 2),
      markup_type TEXT NOT NULL DEFAULT 'percentage',
      markup_value NUMERIC(12, 2) NOT NULL DEFAULT 60,
      is_published BOOLEAN NOT NULL DEFAULT FALSE,
      collection TEXT,
      seo_title TEXT,
      seo_description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (supplier_key, supplier_product_id)
    )
  `);

  await executeTrustedStatement(sql, `CREATE INDEX IF NOT EXISTS supplier_products_supplier_idx ON ${names.products} (supplier_key, last_synced_at DESC)`);
  await executeTrustedStatement(sql, `CREATE INDEX IF NOT EXISTS supplier_products_title_idx ON ${names.products} USING GIN (to_tsvector('english', title))`);
  await executeTrustedStatement(sql, `CREATE INDEX IF NOT EXISTS supplier_variants_product_idx ON ${names.variants} (supplier_key, supplier_product_id)`);
  await executeTrustedStatement(sql, `CREATE INDEX IF NOT EXISTS supplier_sync_runs_supplier_idx ON ${names.syncRuns} (supplier_key, started_at DESC)`);

  await sql`
    INSERT INTO ${tables.sources} (key, name, base_url, is_active, updated_at)
    VALUES ('dear-lover', 'Dear-Lover', 'https://ds.dear-lover.com', TRUE, NOW())
    ON CONFLICT (key)
    DO UPDATE SET name = EXCLUDED.name, base_url = EXCLUDED.base_url, is_active = TRUE, updated_at = NOW()
  `;

  await verifyDropshippingTables(sql);
}

export async function listSuppliers() {
  await ensureDropshippingTables();
  const sql = getSql();
  const tables = dropshipTables(sql);
  const rows = await sql`
    SELECT key, name, base_url, is_active
    FROM ${tables.sources}
    ORDER BY name ASC
  `;
  const configured = new Set(rows.map((row) => String(row.key)));
  const missing = listSupplierAdapters()
    .filter((adapter) => !configured.has(adapter.supplierKey))
    .map((adapter) => ({
      key: adapter.supplierKey,
      name: adapter.supplierKey,
      base_url: null,
      is_active: true
    }));

  return [...rows, ...missing];
}

async function upsertSupplierProduct(product: NormalizedSupplierProduct) {
  const sql = getSql();
  const tables = dropshipTables(sql);

  await sql`
    INSERT INTO ${tables.products} (
      supplier_key,
      supplier_product_id,
      supplier_sku,
      title,
      description,
      category_names,
      image_url,
      second_image_url,
      wholesale_price,
      original_price,
      suggested_retail_price,
      shipping_cost,
      currency,
      warehouse_type,
      total_inventory,
      route_url,
      raw_json,
      last_synced_at,
      updated_at
    )
    VALUES (
      ${product.supplierKey},
      ${product.supplierProductId},
      ${product.supplierSku},
      ${product.title},
      ${product.description},
      ${product.categoryNames},
      ${product.imageUrl},
      ${product.secondImageUrl},
      ${product.wholesalePrice},
      ${product.originalPrice},
      ${product.suggestedRetailPrice},
      ${product.shippingCost},
      ${product.currency},
      ${product.warehouseType},
      ${product.totalInventory},
      ${product.routeUrl},
      ${JSON.stringify(product.raw)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (supplier_key, supplier_product_id)
    DO UPDATE SET
      supplier_sku = EXCLUDED.supplier_sku,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      category_names = EXCLUDED.category_names,
      image_url = EXCLUDED.image_url,
      second_image_url = EXCLUDED.second_image_url,
      wholesale_price = EXCLUDED.wholesale_price,
      original_price = EXCLUDED.original_price,
      suggested_retail_price = EXCLUDED.suggested_retail_price,
      shipping_cost = EXCLUDED.shipping_cost,
      currency = EXCLUDED.currency,
      warehouse_type = EXCLUDED.warehouse_type,
      total_inventory = EXCLUDED.total_inventory,
      route_url = EXCLUDED.route_url,
      raw_json = EXCLUDED.raw_json,
      last_synced_at = NOW(),
      updated_at = NOW()
  `;

  for (const variant of product.variants) {
    await sql`
      INSERT INTO ${tables.variants} (
        supplier_key,
        supplier_product_id,
        supplier_variant_id,
        sku,
        barcode,
        title,
        color,
        size,
        size_name,
        price,
        weight,
        inventory_quantity,
        is_in_stock,
        raw_json,
        last_synced_at,
        updated_at
      )
      VALUES (
        ${variant.supplierKey},
        ${variant.supplierProductId},
        ${variant.supplierVariantId},
        ${variant.sku},
        ${variant.barcode},
        ${variant.title},
        ${variant.color},
        ${variant.size},
        ${variant.sizeName},
        ${variant.price},
        ${variant.weight},
        ${variant.inventoryQuantity},
        ${variant.isInStock},
        ${JSON.stringify(variant.raw)}::jsonb,
        NOW(),
        NOW()
      )
      ON CONFLICT (supplier_key, supplier_variant_id)
      DO UPDATE SET
        supplier_product_id = EXCLUDED.supplier_product_id,
        sku = EXCLUDED.sku,
        barcode = EXCLUDED.barcode,
        title = EXCLUDED.title,
        color = EXCLUDED.color,
        size = EXCLUDED.size,
        size_name = EXCLUDED.size_name,
        price = EXCLUDED.price,
        weight = EXCLUDED.weight,
        inventory_quantity = EXCLUDED.inventory_quantity,
        is_in_stock = EXCLUDED.is_in_stock,
        raw_json = EXCLUDED.raw_json,
        last_synced_at = NOW(),
        updated_at = NOW()
    `;
  }

  for (const image of product.images) {
    await sql`
      INSERT INTO ${tables.images} (supplier_key, supplier_product_id, url, alt_text, sort_order, raw_json)
      VALUES (${product.supplierKey}, ${product.supplierProductId}, ${image.url}, ${image.altText || null}, ${image.sortOrder || 0}, ${JSON.stringify(image.raw || {})}::jsonb)
      ON CONFLICT (supplier_key, supplier_product_id, url)
      DO UPDATE SET alt_text = EXCLUDED.alt_text, sort_order = EXCLUDED.sort_order, raw_json = EXCLUDED.raw_json
    `;
  }

  for (const category of product.categories) {
    await sql`
      INSERT INTO ${tables.categories} (supplier_key, name, raw_json, updated_at)
      VALUES (${product.supplierKey}, ${category.name}, ${JSON.stringify(category.raw || {})}::jsonb, NOW())
      ON CONFLICT (supplier_key, name)
      DO UPDATE SET raw_json = EXCLUDED.raw_json, updated_at = NOW()
    `;
  }
}

export async function syncSupplierProducts(supplierKey: string, params: SupplierSyncParams = {}) {
  await ensureDropshippingTables();
  const adapter = getSupplierAdapter(supplierKey);
  const sql = getSql();
  const tables = dropshipTables(sql);
  const started = await sql`
    INSERT INTO ${tables.syncRuns} (supplier_key, status, metadata_json)
    VALUES (${supplierKey}, 'running', ${JSON.stringify(params)}::jsonb)
    RETURNING id::int
  `;
  const syncRunId = Number(started[0].id);
  const pages = Math.max(1, Math.min(20, Math.trunc(Number(params.pages || 1))));
  const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(params.pageSize || 30))));
  let productsSeen = 0;
  let productsUpserted = 0;
  let variantsSeen = 0;
  let variantsUpserted = 0;
  const failures: string[] = [];

  try {
    for (let page = 1; page <= pages; page += 1) {
      const result = await adapter.searchProducts({ ...params, page, pageSize });
      productsSeen += result.products.length;

      for (const product of result.products) {
        variantsSeen += product.variants.length;
        try {
          await upsertSupplierProduct(product);
          productsUpserted += 1;
          variantsUpserted += product.variants.length;
        } catch (error) {
          failures.push(`${product.supplierProductId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      if (!result.hasMore) {
        break;
      }
    }

    const status = failures.length ? "partial" : "success";
    await sql`
      UPDATE ${tables.syncRuns}
      SET status = ${status},
        finished_at = NOW(),
        products_seen = ${productsSeen},
        products_upserted = ${productsUpserted},
        variants_seen = ${variantsSeen},
        variants_upserted = ${variantsUpserted},
        error_message = ${failures.slice(0, 6).join(" | ") || null}
      WHERE id = ${syncRunId}
    `;

    return { syncRunId, status, productsSeen, productsUpserted, variantsSeen, variantsUpserted, failures };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supplier sync failed.";
    await sql`
      UPDATE ${tables.syncRuns}
      SET status = 'failed',
        finished_at = NOW(),
        products_seen = ${productsSeen},
        products_upserted = ${productsUpserted},
        variants_seen = ${variantsSeen},
        variants_upserted = ${variantsUpserted},
        error_message = ${message}
      WHERE id = ${syncRunId}
    `;
    throw error;
  }
}

export async function importRawSupplierProducts(supplierKey: string, rawProducts: unknown[], metadata: Record<string, unknown> = {}) {
  await ensureDropshippingTables();
  const adapter = getSupplierAdapter(supplierKey);
  const sql = getSql();
  const tables = dropshipTables(sql);
  const started = await sql`
    INSERT INTO ${tables.syncRuns} (supplier_key, status, metadata_json)
    VALUES (${supplierKey}, 'running', ${JSON.stringify({ ...metadata, source: "raw-import" })}::jsonb)
    RETURNING id::int
  `;
  const syncRunId = Number(started[0].id);
  let productsSeen = 0;
  let productsUpserted = 0;
  let variantsSeen = 0;
  let variantsUpserted = 0;
  const failures: string[] = [];

  try {
    for (const rawProduct of rawProducts) {
      productsSeen += 1;
      try {
        const product = adapter.normalizeProduct(rawProduct);

        if (!product.supplierProductId) {
          throw new Error("Supplier product id is missing.");
        }

        variantsSeen += product.variants.length;
        await upsertSupplierProduct(product);
        productsUpserted += 1;
        variantsUpserted += product.variants.length;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }

    const status = failures.length ? "partial" : "success";
    await sql`
      UPDATE ${tables.syncRuns}
      SET status = ${status},
        finished_at = NOW(),
        products_seen = ${productsSeen},
        products_upserted = ${productsUpserted},
        variants_seen = ${variantsSeen},
        variants_upserted = ${variantsUpserted},
        error_message = ${failures.slice(0, 6).join(" | ") || null}
      WHERE id = ${syncRunId}
    `;

    return { syncRunId, status, productsSeen, productsUpserted, variantsSeen, variantsUpserted, failures };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Raw supplier import failed.";
    await sql`
      UPDATE ${tables.syncRuns}
      SET status = 'failed',
        finished_at = NOW(),
        products_seen = ${productsSeen},
        products_upserted = ${productsUpserted},
        variants_seen = ${variantsSeen},
        variants_upserted = ${variantsUpserted},
        error_message = ${message}
      WHERE id = ${syncRunId}
    `;
    throw error;
  }
}

function mapAdminProduct(row: Record<string, unknown>): DropshipAdminProduct {
  const retailPrice = calculateDropshipRetailPrice({
    wholesalePrice: numberOrNull(row.wholesale_price),
    shippingCost: numberOrNull(row.shipping_cost),
    suggestedRetailPrice: numberOrNull(row.suggested_retail_price),
    markupType: row.markup_type as MarkupType | null,
    markupValue: numberOrNull(row.markup_value),
    priceOverride: numberOrNull(row.price_override)
  });

  return {
    id: String(row.id),
    supplier_key: String(row.supplier_key),
    supplier_product_id: String(row.supplier_product_id),
    supplier_sku: row.supplier_sku ? String(row.supplier_sku) : null,
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    category_names: stringArray(row.category_names),
    image_url: row.image_url ? String(row.image_url) : null,
    second_image_url: row.second_image_url ? String(row.second_image_url) : null,
    wholesale_price: row.wholesale_price === null || row.wholesale_price === undefined ? null : String(row.wholesale_price),
    original_price: row.original_price === null || row.original_price === undefined ? null : String(row.original_price),
    suggested_retail_price: row.suggested_retail_price === null || row.suggested_retail_price === undefined ? null : String(row.suggested_retail_price),
    shipping_cost: row.shipping_cost === null || row.shipping_cost === undefined ? null : String(row.shipping_cost),
    currency: row.currency ? String(row.currency) : null,
    warehouse_type: row.warehouse_type ? String(row.warehouse_type) : null,
    total_inventory: String(row.total_inventory || 0),
    route_url: row.route_url ? String(row.route_url) : null,
    last_synced_at: row.last_synced_at ? String(row.last_synced_at) : null,
    variants_count: Number(row.variants_count || 0),
    in_stock_variants: Number(row.in_stock_variants || 0),
    published_id: row.published_id ? String(row.published_id) : null,
    title_override: row.title_override ? String(row.title_override) : null,
    description_override: row.description_override ? String(row.description_override) : null,
    price_override: row.price_override === null || row.price_override === undefined ? null : String(row.price_override),
    markup_type: row.markup_type as MarkupType | null,
    markup_value: row.markup_value === null || row.markup_value === undefined ? null : String(row.markup_value),
    is_published: Boolean(row.is_published),
    collection: row.collection ? String(row.collection) : null,
    retail_price: retailPrice
  };
}

export async function getDropshipProducts(query: DropshipQuery = {}) {
  const sql = getSql();
  const tables = dropshipTables(sql);
  try {
    await ensureDropshippingTables();
  } catch (error) {
    if (isUndefinedTableError(error)) {
      console.error(error instanceof Error ? `Dropshipping tables unavailable: ${error.message}` : "Dropshipping tables unavailable.");
      return [];
    }
    throw error;
  }
  const page = Math.max(1, Math.trunc(Number(query.page || 1)));
  const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(query.pageSize || 30))));
  const offset = (page - 1) * pageSize;
  const search = query.search?.trim() || "";
  const supplierKey = query.supplierKey?.trim() || "dear-lover";
  const category = query.category?.trim() || "";

  const rows = await sql`
    SELECT
      p.id::text,
      p.supplier_key,
      p.supplier_product_id,
      p.supplier_sku,
      p.title,
      p.description,
      p.category_names,
      p.image_url,
      p.second_image_url,
      p.wholesale_price::text,
      p.original_price::text,
      p.suggested_retail_price::text,
      p.shipping_cost::text,
      p.currency,
      p.warehouse_type,
      p.total_inventory::text,
      p.route_url,
      p.last_synced_at::text,
      COUNT(v.id)::int AS variants_count,
      COUNT(v.id) FILTER (WHERE v.is_in_stock AND v.inventory_quantity > 0)::int AS in_stock_variants,
      d.id::text AS published_id,
      d.title_override,
      d.description_override,
      d.price_override::text,
      d.markup_type,
      d.markup_value::text,
      COALESCE(d.is_published, FALSE) AS is_published,
      d.collection
    FROM ${tables.products} p
    LEFT JOIN ${tables.variants} v ON v.supplier_key = p.supplier_key AND v.supplier_product_id = p.supplier_product_id
    LEFT JOIN ${tables.published} d ON d.supplier_key = p.supplier_key AND d.supplier_product_id = p.supplier_product_id
    WHERE p.supplier_key = ${supplierKey}
      AND (${search} = '' OR p.title ILIKE ${`%${search}%`} OR p.supplier_sku ILIKE ${`%${search}%`} OR p.supplier_product_id ILIKE ${`%${search}%`})
      AND (${category} = '' OR ${category} = ANY(p.category_names))
      AND (${query.published === null || query.published === undefined} OR COALESCE(d.is_published, FALSE) = ${Boolean(query.published)})
      AND (${query.inStock === null || query.inStock === undefined} OR (${Boolean(query.inStock)} = FALSE OR p.total_inventory > 0))
    GROUP BY p.id, d.id
    ORDER BY p.last_synced_at DESC NULLS LAST, p.title ASC
    LIMIT ${pageSize}
    OFFSET ${offset}
  `;

  return rows.map((row) => mapAdminProduct(row));
}

export async function importDropshipProduct(input: {
  supplierKey: string;
  supplierProductId: string;
  markupType?: MarkupType;
  markupValue?: number | null;
  priceOverride?: number | null;
  collection?: string | null;
  publish?: boolean;
}) {
  await ensureDropshippingTables();
  const sql = getSql();
  const tables = dropshipTables(sql);
  const productRows = await sql`
    SELECT supplier_key, supplier_product_id
    FROM ${tables.products}
    WHERE supplier_key = ${input.supplierKey}
      AND supplier_product_id = ${input.supplierProductId}
    LIMIT 1
  `;

  if (!productRows.length) {
    throw new Error("Supplier product has not been synced yet.");
  }

  const markupType = input.markupType || "percentage";
  if (!["percentage", "fixed", "manual"].includes(markupType)) {
    throw new Error("Invalid markup type.");
  }

  const rows = await sql`
    INSERT INTO ${tables.published} AS published (
      supplier_key,
      supplier_product_id,
      markup_type,
      markup_value,
      price_override,
      collection,
      is_published,
      updated_at
    )
    VALUES (
      ${input.supplierKey},
      ${input.supplierProductId},
      ${markupType},
      ${input.markupValue ?? (markupType === "percentage" ? 60 : 0)},
      ${input.priceOverride ?? null},
      ${input.collection || null},
      ${Boolean(input.publish)},
      NOW()
    )
    ON CONFLICT (supplier_key, supplier_product_id)
    DO UPDATE SET
      markup_type = EXCLUDED.markup_type,
      markup_value = EXCLUDED.markup_value,
      price_override = EXCLUDED.price_override,
      collection = EXCLUDED.collection,
      is_published = EXCLUDED.is_published,
      updated_at = NOW()
    RETURNING id::text
  `;

  return rows[0];
}

export async function publishAllSyncedDropshipProducts(input: {
  supplierKey: string;
  markupType?: MarkupType;
  markupValue?: number | null;
  collection?: string | null;
}) {
  await ensureDropshippingTables();
  const sql = getSql();
  const tables = dropshipTables(sql);
  const markupType = input.markupType || "percentage";

  if (!["percentage", "fixed", "manual"].includes(markupType)) {
    throw new Error("Invalid markup type.");
  }

  const rows = await sql`
    INSERT INTO ${tables.published} AS published (
      supplier_key,
      supplier_product_id,
      markup_type,
      markup_value,
      collection,
      is_published,
      updated_at
    )
    SELECT
      p.supplier_key,
      p.supplier_product_id,
      ${markupType},
      ${input.markupValue ?? (markupType === "percentage" ? 60 : 0)},
      ${input.collection || "dropshipping"},
      TRUE,
      NOW()
    FROM ${tables.products} p
    WHERE p.supplier_key = ${input.supplierKey}
    ON CONFLICT (supplier_key, supplier_product_id)
    DO UPDATE SET
      markup_type = published.markup_type,
      markup_value = published.markup_value,
      collection = COALESCE(published.collection, EXCLUDED.collection),
      is_published = TRUE,
      updated_at = NOW()
    RETURNING id::text
  `;

  return { publishedCount: rows.length };
}

export async function updateDropshipPublication(id: string, input: {
  titleOverride?: string | null;
  descriptionOverride?: string | null;
  markupType?: MarkupType;
  markupValue?: number | null;
  priceOverride?: number | null;
  collection?: string | null;
  isPublished?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
}) {
  await ensureDropshippingTables();
  const sql = getSql();
  const tables = dropshipTables(sql);
  const markupType = input.markupType || "percentage";

  if (!["percentage", "fixed", "manual"].includes(markupType)) {
    throw new Error("Invalid markup type.");
  }

  const rows = await sql`
    UPDATE ${tables.published}
    SET title_override = ${input.titleOverride || null},
      description_override = ${input.descriptionOverride || null},
      markup_type = ${markupType},
      markup_value = ${input.markupValue ?? null},
      price_override = ${input.priceOverride ?? null},
      collection = ${input.collection || null},
      is_published = ${Boolean(input.isPublished)},
      seo_title = ${input.seoTitle || null},
      seo_description = ${input.seoDescription || null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING id::text
  `;

  if (!rows.length) {
    throw new Error("Dropship publication was not found.");
  }

  return rows[0];
}

function mapPublishedDropshipStoreProduct(row: Record<string, unknown>) {
  const retailPrice = calculateDropshipRetailPrice({
    wholesalePrice: numberOrNull(row.wholesale_price),
    shippingCost: numberOrNull(row.shipping_cost),
    suggestedRetailPrice: numberOrNull(row.suggested_retail_price),
    markupType: row.markup_type as MarkupType,
    markupValue: numberOrNull(row.markup_value),
    priceOverride: numberOrNull(row.price_override)
  });
  const title = row.title_override ? String(row.title_override) : String(row.title);
  const variantLabel = [row.color, row.size || row.size_name || row.variant_title].map((item) => item ? String(item) : "").filter(Boolean).join(" / ");

  return {
    epos_product_id: `dropship:${row.supplier_key}:${row.supplier_variant_id}`,
    name: title,
    description: row.description ? String(row.description) : null,
    sku: row.sku ? String(row.sku) : row.supplier_sku ? String(row.supplier_sku) : null,
    barcode: row.barcode ? String(row.barcode) : null,
    category_id: null,
    sale_price: retailPrice.toFixed(2),
    stock: String(row.is_in_stock ? Number(row.inventory_quantity || 0) : 0),
    storefront_stock_override: null,
    synced_at: new Date().toISOString(),
    marketing_title: title,
    marketing_description: row.description_override ? String(row.description_override) : null,
    department: row.collection ? String(row.collection) : "dropshipping",
    category_ids: [],
    category_slugs: [
      row.collection ? String(row.collection) : "dropshipping",
      ...stringArray(row.category_names).map((category) => category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    ].filter(Boolean),
    has_explicit_categories: true,
    is_featured: false,
    is_hidden: false,
    primary_image_url: row.image_url ? String(row.image_url) : null,
    primary_image_alt: title,
    is_dropship: true,
    supplier_key: String(row.supplier_key),
    supplier_product_id: String(row.supplier_product_id),
    supplier_variant_id: String(row.supplier_variant_id),
    dropship_variant_label: variantLabel || null,
    dropship_warehouse_type: row.warehouse_type ? String(row.warehouse_type) : null
  };
}

export async function getPublishedDropshipStoreProductPage(options: {
  supplierKey?: string;
  limit?: number;
  offset?: number;
  search?: string;
  collection?: string;
} = {}) {
  await ensureDropshippingTables();
  const sql = getSql();
  const tables = dropshipTables(sql);
  const supplierKey = options.supplierKey?.trim() || "dear-lover";
  const limit = Math.max(1, Math.min(96, Math.trunc(Number(options.limit || 48))));
  const offset = Math.max(0, Math.trunc(Number(options.offset || 0)));
  const search = options.search?.trim() || "";
  const collection = options.collection?.trim() || "";

  const parentRows = await sql`
    SELECT
      p.supplier_product_id,
      p.title
    FROM ${tables.published} d
    JOIN ${tables.products} p ON p.supplier_key = d.supplier_key AND p.supplier_product_id = d.supplier_product_id
    WHERE d.is_published = TRUE
      AND p.supplier_key = ${supplierKey}
      AND (${collection} = '' OR d.collection = ${collection})
      AND (${search} = '' OR p.title ILIKE ${`%${search}%`} OR p.supplier_sku ILIKE ${`%${search}%`} OR p.supplier_product_id ILIKE ${`%${search}%`})
    ORDER BY p.title ASC
    LIMIT ${limit + 1}
    OFFSET ${offset}
  `;
  const pageProductIds = parentRows.slice(0, limit).map((row) => String(row.supplier_product_id));

  if (!pageProductIds.length) {
    return {
      products: [] as ReturnType<typeof mapPublishedDropshipStoreProduct>[],
      pagination: {
        limit,
        offset,
        returned: 0,
        hasMore: false,
        nextOffset: null as number | null
      }
    };
  }

  const rows = await sql`
    SELECT
      p.supplier_key,
      p.supplier_product_id,
      p.supplier_sku,
      p.title,
      p.description,
      p.category_names,
      p.image_url,
      p.wholesale_price::text,
      p.suggested_retail_price::text,
      p.shipping_cost::text,
      p.warehouse_type,
      d.title_override,
      d.description_override,
      d.price_override::text,
      d.markup_type,
      d.markup_value::text,
      d.collection,
      v.supplier_variant_id,
      v.sku,
      v.barcode,
      v.title AS variant_title,
      v.color,
      v.size,
      v.size_name,
      v.price::text AS variant_price,
      v.inventory_quantity::text,
      v.is_in_stock
    FROM ${tables.published} d
    JOIN ${tables.products} p ON p.supplier_key = d.supplier_key AND p.supplier_product_id = d.supplier_product_id
    JOIN ${tables.variants} v ON v.supplier_key = p.supplier_key AND v.supplier_product_id = p.supplier_product_id
    WHERE d.is_published = TRUE
      AND p.supplier_key = ${supplierKey}
      AND p.supplier_product_id = ANY(${pageProductIds})
    ORDER BY p.title ASC, v.size_name ASC, v.title ASC
  `;
  const hasMore = parentRows.length > limit;

  return {
    products: rows.map((row) => mapPublishedDropshipStoreProduct(row)),
    pagination: {
      limit,
      offset,
      returned: pageProductIds.length,
      hasMore,
      nextOffset: hasMore ? offset + limit : null
    }
  };
}

export async function getPublishedDropshipStoreProducts() {
  const page = await getPublishedDropshipStoreProductPage({ limit: 96, offset: 0 });
  return page.products;
}

export type DropshipCheckoutProduct = {
  cart_id: string;
  supplier_key: string;
  supplier_product_id: string;
  supplier_variant_id: string;
  supplier_sku: string | null;
  sku: string | null;
  barcode: string | null;
  title: string;
  description: string | null;
  category_names: string[];
  image_url: string | null;
  warehouse_type: string | null;
  variant_title: string | null;
  color: string | null;
  size: string | null;
  size_name: string | null;
  inventory_quantity: number;
  is_in_stock: boolean;
  wholesale_price: number | null;
  shipping_cost: number;
  retail_price: number;
  collection: string | null;
};

export async function getPublishedDropshipCheckoutProducts(cartIds: string[]) {
  await ensureDropshippingTables();
  const variantIds = cartIds
    .map((id) => String(id || ""))
    .filter((id) => id.startsWith("dropship:"))
    .map((id) => id.split(":")[2])
    .filter(Boolean);

  if (!variantIds.length) {
    return [] as DropshipCheckoutProduct[];
  }

  const sql = getSql();
  const tables = dropshipTables(sql);
  const rows = await sql`
    SELECT
      p.supplier_key,
      p.supplier_product_id,
      p.supplier_sku,
      p.title,
      p.description,
      p.category_names,
      p.image_url,
      p.wholesale_price::text,
      p.suggested_retail_price::text,
      p.shipping_cost::text,
      p.warehouse_type,
      d.title_override,
      d.description_override,
      d.price_override::text,
      d.markup_type,
      d.markup_value::text,
      d.collection,
      v.supplier_variant_id,
      v.sku,
      v.barcode,
      v.title AS variant_title,
      v.color,
      v.size,
      v.size_name,
      v.inventory_quantity::text,
      v.is_in_stock
    FROM ${tables.published} d
    JOIN ${tables.products} p ON p.supplier_key = d.supplier_key AND p.supplier_product_id = d.supplier_product_id
    JOIN ${tables.variants} v ON v.supplier_key = p.supplier_key AND v.supplier_product_id = p.supplier_product_id
    WHERE d.is_published = TRUE
      AND v.supplier_variant_id = ANY(${variantIds})
  `;

  return rows.map((row) => {
    const retailPrice = calculateDropshipRetailPrice({
      wholesalePrice: numberOrNull(row.wholesale_price),
      shippingCost: numberOrNull(row.shipping_cost),
      suggestedRetailPrice: numberOrNull(row.suggested_retail_price),
      markupType: row.markup_type as MarkupType,
      markupValue: numberOrNull(row.markup_value),
      priceOverride: numberOrNull(row.price_override)
    });
    const title = row.title_override ? String(row.title_override) : String(row.title);

    return {
      cart_id: `dropship:${row.supplier_key}:${row.supplier_variant_id}`,
      supplier_key: String(row.supplier_key),
      supplier_product_id: String(row.supplier_product_id),
      supplier_variant_id: String(row.supplier_variant_id),
      supplier_sku: row.supplier_sku ? String(row.supplier_sku) : null,
      sku: row.sku ? String(row.sku) : null,
      barcode: row.barcode ? String(row.barcode) : null,
      title,
      description: row.description_override ? String(row.description_override) : row.description ? String(row.description) : null,
      category_names: stringArray(row.category_names),
      image_url: row.image_url ? String(row.image_url) : null,
      warehouse_type: row.warehouse_type ? String(row.warehouse_type) : null,
      variant_title: row.variant_title ? String(row.variant_title) : null,
      color: row.color ? String(row.color) : null,
      size: row.size ? String(row.size) : null,
      size_name: row.size_name ? String(row.size_name) : null,
      inventory_quantity: Number(row.is_in_stock ? row.inventory_quantity || 0 : 0),
      is_in_stock: Boolean(row.is_in_stock),
      wholesale_price: numberOrNull(row.wholesale_price),
      shipping_cost: numberOrNull(row.shipping_cost) || 0,
      retail_price: retailPrice,
      collection: row.collection ? String(row.collection) : null
    };
  });
}
