import { getSql } from "@/lib/db";
import { EposProduct, EposProductStock, fetchEposCollection, getEposId, getEposNumber, getEposString } from "@/lib/epos";
import { importEposProductImages } from "@/lib/epos-product-images";

type SyncResult = {
  products: number;
  stock: number;
  images?: Awaited<ReturnType<typeof importEposProductImages>>;
};

async function ensureEposTables() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS epos_sync_events (
      id BIGSERIAL PRIMARY KEY,
      event_type TEXT NOT NULL DEFAULT 'Batch Update',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'received',
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    )
  `;

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
    CREATE TABLE IF NOT EXISTS product_deletion_overrides (
      epos_product_id TEXT PRIMARY KEY,
      deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reason TEXT
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS epos_sync_events_created_at_idx ON epos_sync_events (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS epos_products_name_idx ON epos_products (name)`;
  await sql`CREATE INDEX IF NOT EXISTS epos_products_sku_idx ON epos_products (sku)`;
  await sql`CREATE INDEX IF NOT EXISTS epos_product_stock_product_idx ON epos_product_stock (epos_product_id)`;
}

export async function syncEposProducts() {
  await ensureEposTables();

  const sql = getSql();
  const products = await fetchEposCollection<EposProduct>("Product");
  const deletedRows = await sql`SELECT epos_product_id FROM product_deletion_overrides`;
  const deletedProductIds = new Set(deletedRows.map((row) => String(row.epos_product_id)));

  for (const product of products) {
    const productId = getEposId(product);

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
      INSERT INTO epos_products (
        epos_product_id,
        name,
        description,
        sku,
        barcode,
        category_id,
        sale_price,
        cost_price,
        raw,
        synced_at
      )
      VALUES (
        ${productId},
        ${getEposString(product, ["Name", "name"]) || "Untitled product"},
        ${getEposString(product, ["Description", "description"])},
        ${getEposString(product, ["Sku", "SKU", "sku"])},
        ${getEposString(product, ["Barcode", "BarCode", "barcode"])},
        ${getEposNumber(product, ["CategoryId", "CategoryID", "categoryId"])},
        ${getEposNumber(product, ["SalePrice", "Price", "UnitPrice", "salePrice", "price"])},
        ${getEposNumber(product, ["CostPrice", "costPrice"])},
        ${JSON.stringify(product)}::jsonb,
        NOW()
      )
      ON CONFLICT (epos_product_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        sku = EXCLUDED.sku,
        barcode = EXCLUDED.barcode,
        category_id = EXCLUDED.category_id,
        sale_price = EXCLUDED.sale_price,
        cost_price = EXCLUDED.cost_price,
        raw = EXCLUDED.raw,
        is_deleted = FALSE,
        synced_at = NOW()
    `;
  }

  return products.length;
}

export async function syncEposStock() {
  await ensureEposTables();

  const sql = getSql();
  const stockRecords = await fetchEposCollection<EposProductStock>("ProductStock");

  for (const stock of stockRecords) {
    const stockId = getEposId(stock);

    if (!stockId) {
      continue;
    }

    await sql`
      INSERT INTO epos_product_stock (
        epos_stock_id,
        epos_product_id,
        location_id,
        current_stock,
        on_order,
        raw,
        synced_at
      )
      VALUES (
        ${stockId},
        ${getEposNumber(stock, ["ProductId", "ProductID", "productId"])},
        ${getEposNumber(stock, ["LocationId", "LocationID", "locationId"])},
        ${getEposNumber(stock, ["CurrentStock", "StockLevel", "Stock", "Quantity", "Qty", "Available", "currentStock", "stockLevel", "stock", "quantity"])},
        ${getEposNumber(stock, ["OnOrder", "onOrder"])},
        ${JSON.stringify(stock)}::jsonb,
        NOW()
      )
      ON CONFLICT (epos_stock_id)
      DO UPDATE SET
        epos_product_id = EXCLUDED.epos_product_id,
        location_id = EXCLUDED.location_id,
        current_stock = EXCLUDED.current_stock,
        on_order = EXCLUDED.on_order,
        raw = EXCLUDED.raw,
        synced_at = NOW()
    `;
  }

  return stockRecords.length;
}

export async function syncEposCatalog(options: { importImages?: boolean; imageLimit?: number; skipExistingImages?: boolean } = {}): Promise<SyncResult> {
  const products = await syncEposProducts();
  const stock = await syncEposStock();
  const images = options.importImages
    ? await importEposProductImages({
        limit: options.imageLimit,
        skipExisting: options.skipExistingImages !== false
      })
    : undefined;

  return { products, stock, ...(images ? { images } : {}) };
}

export async function recordEposSyncEvent(eventType: string, payload: unknown, status = "received") {
  await ensureEposTables();

  const sql = getSql();
  const rows = await sql`
    INSERT INTO epos_sync_events (event_type, payload, status)
    VALUES (${eventType}, ${JSON.stringify(payload)}::jsonb, ${status})
    RETURNING id
  `;

  return rows[0]?.id as number | undefined;
}

export async function updateEposSyncEvent(id: number, status: string, error?: string) {
  const sql = getSql();
  await sql`
    UPDATE epos_sync_events
    SET status = ${status}, error = ${error || null}, processed_at = NOW()
    WHERE id = ${id}
  `;
}
