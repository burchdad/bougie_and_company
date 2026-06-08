import { getSql } from "@/lib/db";
import { EposProduct, EposProductStock, fetchEposCollection, getEposId, getEposNumber, getEposString } from "@/lib/epos";

type SyncResult = {
  products: number;
  stock: number;
};

export async function syncEposProducts() {
  const sql = getSql();
  const products = await fetchEposCollection<EposProduct>("Product");

  for (const product of products) {
    const productId = getEposId(product);

    if (!productId) {
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
        ${getEposNumber(stock, ["CurrentStock", "Stock", "Quantity", "currentStock", "stock"])},
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

export async function syncEposCatalog(): Promise<SyncResult> {
  const products = await syncEposProducts();
  const stock = await syncEposStock();

  return { products, stock };
}

export async function recordEposSyncEvent(eventType: string, payload: unknown, status = "received") {
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
