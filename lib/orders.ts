import { getSql, emailPattern } from "@/lib/db";
import { upsertCustomerAccount } from "@/lib/customer-capture";
import { getDropshipFlatShippingRate, getDropshipShippingMode, isDropshippingCheckoutEnabled, isDropshippingEnabled, isDropshippingManualFulfillmentEnabled } from "@/lib/dropshipping/config";
import { calculateDropshipShippingTotal } from "@/lib/dropshipping/checkout";
import { getPublishedDropshipCheckoutProducts, type DropshipCheckoutProduct } from "@/lib/dropshipping/db";
import { eposWriteWithPayloadVariants, getEposId } from "@/lib/epos";
import { calculateShipping, getShippingSettings, type ShippingAddress } from "@/lib/shipping";

export type CheckoutItemInput = {
  id?: string;
  name?: string;
  quantity?: number;
  productType?: "native" | "dropship";
};

export type CheckoutAddressInput = ShippingAddress & {
  address2?: string;
};

export type CheckoutPayload = {
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  address?: CheckoutAddressInput;
  items?: CheckoutItemInput[];
  notes?: string;
};

export type SiteOrder = {
  id: number;
  order_number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_service: string;
  subtotal: string;
  shipping_amount: string;
  total: string;
  epos_order_id: string | null;
  epos_customer_id: string | null;
  epos_sync_status: string;
  epos_sync_message: string | null;
  payment_status: string;
  fulfillment_status: string;
  contains_native_items: boolean;
  contains_dropship_items: boolean;
  dropship_fulfillment_count: number;
  created_at: string;
};

type ProductRow = {
  epos_product_id: string;
  name: string;
  sku: string | null;
  sale_price: string | null;
  stock: string | null;
  storefront_stock_override: string | null;
};

type OrderItem = {
  productId: string;
  productType: "native" | "dropship";
  name: string;
  sku: string | null;
  supplierKey?: string | null;
  supplierProductId?: string | null;
  supplierVariantId?: string | null;
  supplierSku?: string | null;
  variantTitle?: string | null;
  imageUrl?: string | null;
  shippingCost?: number;
  inventorySnapshot?: number;
  metadata?: Record<string, unknown>;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type DropshipFulfillmentRecord = {
  id: number;
  order_id: number;
  order_item_id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  shipping_address: string;
  supplier_key: string;
  supplier_product_id: string;
  supplier_variant_id: string;
  supplier_sku: string | null;
  product_title: string;
  variant_title: string | null;
  image_url: string | null;
  quantity: number;
  customer_paid_amount: string;
  supplier_cost: string | null;
  estimated_supplier_shipping: string;
  payment_status: string;
  fulfillment_status: string;
  status: string;
  supplier_order_id: string | null;
  supplier_order_reference: string | null;
  fulfillment_notes: string | null;
  tracking_number: string | null;
  tracking_carrier: string | null;
  created_at: string;
  updated_at: string;
};

export async function ensureOrderTables() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS site_orders (
      id BIGSERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'submitted',
      customer_first_name TEXT NOT NULL,
      customer_last_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT,
      shipping_address1 TEXT NOT NULL,
      shipping_address2 TEXT,
      shipping_city TEXT NOT NULL,
      shipping_state TEXT NOT NULL,
      shipping_postal_code TEXT NOT NULL,
      shipping_country TEXT NOT NULL DEFAULT 'US',
      shipping_service TEXT NOT NULL,
      subtotal NUMERIC(12, 2) NOT NULL,
      shipping_amount NUMERIC(12, 2) NOT NULL,
      total NUMERIC(12, 2) NOT NULL,
      customer_notes TEXT,
      epos_order_id TEXT,
      epos_customer_id TEXT,
      epos_sync_status TEXT NOT NULL DEFAULT 'pending',
      epos_sync_message TEXT,
      epos_raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS site_order_items (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES site_orders(id) ON DELETE CASCADE,
      epos_product_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sku TEXT,
      quantity INTEGER NOT NULL,
      unit_price NUMERIC(12, 2) NOT NULL,
      line_total NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'payment_confirmed'`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'pending'`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS tax_total NUMERIC(12, 2) NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'custom_order_request'`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS payment_reference TEXT`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS checkout_session_id TEXT`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS shipping_address_json JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS billing_address_json JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS contains_native_items BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS contains_dropship_items BOOLEAN NOT NULL DEFAULT FALSE`;
  await sql`ALTER TABLE site_orders ADD COLUMN IF NOT EXISTS cart_checksum TEXT`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'native'`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS supplier_key TEXT`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS supplier_product_id TEXT`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS supplier_variant_id TEXT`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS supplier_sku TEXT`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS title_snapshot TEXT`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS variant_title_snapshot TEXT`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS image_snapshot TEXT`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS shipping_cost_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'payment_confirmed'`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS inventory_snapshot NUMERIC`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb`;
  await sql`ALTER TABLE site_order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

  await sql`
    CREATE TABLE IF NOT EXISTS dropship_fulfillment_queue (
      id BIGSERIAL PRIMARY KEY,
      order_id BIGINT NOT NULL REFERENCES site_orders(id) ON DELETE CASCADE,
      order_item_id BIGINT NOT NULL REFERENCES site_order_items(id) ON DELETE CASCADE,
      supplier_key TEXT NOT NULL,
      supplier_product_id TEXT NOT NULL,
      supplier_variant_id TEXT NOT NULL,
      supplier_sku TEXT,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready_for_supplier_order',
      supplier_order_id TEXT,
      supplier_order_reference TEXT,
      fulfillment_notes TEXT,
      assigned_to TEXT,
      tracking_number TEXT,
      tracking_carrier TEXT,
      submitted_at TIMESTAMPTZ,
      fulfilled_at TIMESTAMPTZ,
      failed_at TIMESTAMPTZ,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (order_item_id)
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS site_orders_created_idx ON site_orders (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS site_order_items_order_idx ON site_order_items (order_id)`;
  await sql`CREATE INDEX IF NOT EXISTS dropship_fulfillment_queue_status_idx ON dropship_fulfillment_queue (status, created_at DESC)`;
}

export async function listOrders(limit = 50) {
  await ensureOrderTables();
  const sql = getSql();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);

  return (await sql`
    SELECT id::int,
      order_number,
      status,
      concat(customer_first_name, ' ', customer_last_name) AS customer_name,
      customer_email,
      customer_phone,
      shipping_service,
      subtotal::text,
      shipping_amount::text,
      total::text,
      epos_order_id,
      epos_customer_id,
      epos_sync_status,
      epos_sync_message,
      payment_status,
      fulfillment_status,
      contains_native_items,
      contains_dropship_items,
      (
        SELECT COUNT(*)::int
        FROM dropship_fulfillment_queue q
        WHERE q.order_id = site_orders.id
      ) AS dropship_fulfillment_count,
      created_at::text
    FROM site_orders
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `) as SiteOrder[];
}

export async function getOrderItems(orderId: number) {
  await ensureOrderTables();
  const sql = getSql();

  return (await sql`
    SELECT epos_product_id,
      product_type,
      supplier_key,
      supplier_product_id,
      supplier_variant_id,
      supplier_sku,
      name,
      sku,
      title_snapshot,
      variant_title_snapshot,
      image_snapshot,
      quantity::int,
      unit_price::text,
      shipping_cost_snapshot::text,
      line_total::text,
      fulfillment_status,
      inventory_snapshot::text
    FROM site_order_items
    WHERE order_id = ${orderId}
    ORDER BY id ASC
  `) as Array<{
    epos_product_id: string;
    product_type: string;
    supplier_key: string | null;
    supplier_product_id: string | null;
    supplier_variant_id: string | null;
    supplier_sku: string | null;
    name: string;
    sku: string | null;
    title_snapshot: string | null;
    variant_title_snapshot: string | null;
    image_snapshot: string | null;
    quantity: number;
    unit_price: string;
    shipping_cost_snapshot: string;
    line_total: string;
    fulfillment_status: string;
    inventory_snapshot: string | null;
  }>;
}

function displayStock(product: ProductRow) {
  const stock = Number(product.stock || 0);
  const override = Number(product.storefront_stock_override || 0);
  return stock > 0 ? stock : override;
}

function money(value: number) {
  return Number(value.toFixed(2));
}

function orderNumber(id: number) {
  return `WEB-${String(id).padStart(6, "0")}`;
}

function cartChecksum(items: CheckoutItemInput[]) {
  return Buffer.from(JSON.stringify(items.map((item) => ({ id: item.id, quantity: item.quantity })).sort((a, b) => String(a.id).localeCompare(String(b.id))))).toString("base64url").slice(0, 64);
}

function isDropshipCartId(id: string) {
  return id.startsWith("dropship:");
}

function normalizeItems(items: CheckoutItemInput[] | undefined) {
  const byLine = new Map<string, CheckoutItemInput>();

  (items || []).forEach((item) => {
    const id = String(item.id || "").trim();
    const name = String(item.name || "").trim();
    const quantity = Math.max(0, Math.trunc(Number(item.quantity || 0)));

    if (!id || quantity < 1) {
      return;
    }

    const lineKey = `${id}::${name}`;
    const existing = byLine.get(lineKey);
    byLine.set(lineKey, {
      id,
      name,
      quantity: (existing?.quantity || 0) + quantity
    });
  });

  return [...byLine.values()];
}

async function loadProducts(productIds: string[]) {
  const sql = getSql();

  return (await sql`
    SELECT p.epos_product_id,
      p.name,
      p.sku,
      p.sale_price::text,
      COALESCE(SUM(s.current_stock), 0)::text AS stock,
      m.storefront_stock_override::text
    FROM epos_products p
    LEFT JOIN epos_product_stock s ON s.epos_product_id::text = p.epos_product_id
    LEFT JOIN product_site_meta m ON m.epos_product_id = p.epos_product_id
    WHERE p.epos_product_id = ANY(${productIds})
      AND p.is_deleted = FALSE
    GROUP BY p.epos_product_id, p.name, p.sku, p.sale_price, m.storefront_stock_override
  `) as ProductRow[];
}

function dropshipVariantLabel(product: DropshipCheckoutProduct) {
  return [product.color, product.size || product.size_name || product.variant_title].map((item) => item || "").filter(Boolean).join(" / ") || null;
}

function calculateDropshipShipping(items: OrderItem[]) {
  const dropshipItems = items.filter((item) => item.productType === "dropship");
  return calculateDropshipShippingTotal(
    dropshipItems.map((item) => ({ quantity: item.quantity, shippingCost: Number(item.shippingCost || 0) })),
    getDropshipShippingMode(),
    getDropshipFlatShippingRate()
  );
}

async function buildOrderItems(normalizedItems: CheckoutItemInput[]) {
  const nativeInputs = normalizedItems.filter((item) => !isDropshipCartId(String(item.id)));
  const dropshipInputs = normalizedItems.filter((item) => isDropshipCartId(String(item.id)));
  const nativeRows = nativeInputs.length ? await loadProducts(nativeInputs.map((item) => String(item.id))) : [];
  const dropshipRows = dropshipInputs.length ? await getPublishedDropshipCheckoutProducts(dropshipInputs.map((item) => String(item.id))) : [];
  const nativeById = new Map(nativeRows.map((product) => [product.epos_product_id, product]));
  const dropshipById = new Map(dropshipRows.map((product) => [product.cart_id, product]));
  const orderItems: OrderItem[] = [];
  const requestedQuantityById = new Map<string, number>();

  normalizedItems.forEach((item) => {
    const id = String(item.id);
    requestedQuantityById.set(id, (requestedQuantityById.get(id) || 0) + Number(item.quantity || 0));
  });

  for (const input of nativeInputs) {
    const product = nativeById.get(String(input.id));
    const quantity = Number(input.quantity || 0);

    if (!product) {
      return { ok: false as const, message: `${input.name || "An item"} is not available in the shop right now.` };
    }

    const availableStock = displayStock(product);
    const requestedQuantity = requestedQuantityById.get(product.epos_product_id) || quantity;
    if (availableStock < requestedQuantity) {
      return { ok: false as const, message: `${product.name} only has ${availableStock} available.` };
    }

    const unitPrice = Number(product.sale_price || 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { ok: false as const, message: `${product.name} is missing an online sale price.` };
    }

    orderItems.push({
      productId: product.epos_product_id,
      productType: "native",
      name: input.name || product.name,
      sku: product.sku,
      quantity,
      unitPrice: money(unitPrice),
      lineTotal: money(unitPrice * quantity),
      inventorySnapshot: availableStock
    });
  }

  for (const input of dropshipInputs) {
    const product = dropshipById.get(String(input.id));
    const quantity = Number(input.quantity || 0);

    if (!isDropshippingEnabled()) {
      return { ok: false as const, message: "Dropshipping is not enabled for checkout right now." };
    }

    if (!isDropshippingManualFulfillmentEnabled()) {
      return { ok: false as const, message: "Dropship fulfillment is not enabled yet." };
    }

    if (!isDropshippingCheckoutEnabled()) {
      return { ok: false as const, message: "Dropship checkout is not enabled yet." };
    }

    if (!product) {
      return { ok: false as const, message: `${input.name || "A dropship item"} is no longer published.` };
    }

    const requestedQuantity = requestedQuantityById.get(product.cart_id) || quantity;
    if (!product.is_in_stock || product.inventory_quantity < requestedQuantity) {
      return { ok: false as const, message: `${product.title} only has ${Math.max(0, product.inventory_quantity)} available from the supplier.` };
    }

    if (!Number.isFinite(product.retail_price) || product.retail_price <= 0) {
      return { ok: false as const, message: `${product.title} could not be priced for checkout.` };
    }

    orderItems.push({
      productId: product.cart_id,
      productType: "dropship",
      name: product.title,
      sku: product.sku || product.supplier_sku,
      supplierKey: product.supplier_key,
      supplierProductId: product.supplier_product_id,
      supplierVariantId: product.supplier_variant_id,
      supplierSku: product.sku || product.supplier_sku,
      variantTitle: dropshipVariantLabel(product),
      imageUrl: product.image_url,
      shippingCost: money(product.shipping_cost),
      inventorySnapshot: product.inventory_quantity,
      metadata: {
        wholesale_price: product.wholesale_price,
        estimated_supplier_shipping: product.shipping_cost,
        warehouse_type: product.warehouse_type,
        collection: product.collection
      },
      quantity,
      unitPrice: money(product.retail_price),
      lineTotal: money(product.retail_price * quantity)
    });
  }

  return { ok: true as const, items: orderItems };
}

async function tryEposCustomer(payload: CheckoutPayload, address: CheckoutAddressInput) {
  const firstName = String(payload.customer?.firstName || "").trim();
  const lastName = String(payload.customer?.lastName || "").trim();
  const email = String(payload.customer?.email || "").trim().toLowerCase();
  const phone = String(payload.customer?.phone || "").trim();
  const customerPayloads = [
    {
      Forename: firstName,
      Surname: lastName,
      EmailAddress: email,
      PhoneNumber: phone,
      AddressLine1: address.address1,
      AddressLine2: address.address2 || "",
      Town: address.city,
      County: address.state,
      PostCode: address.postalCode
    },
    {
      FirstName: firstName,
      LastName: lastName,
      Email: email,
      Phone: phone,
      Address1: address.address1,
      Address2: address.address2 || "",
      City: address.city,
      State: address.state,
      PostCode: address.postalCode
    },
    {
      Name: `${firstName} ${lastName}`.trim(),
      EmailAddress: email,
      Telephone: phone
    }
  ];
  let lastError: unknown;

  for (const customerPayload of customerPayloads) {
    try {
      const raw = await eposWriteWithPayloadVariants("Customer", "POST", customerPayload);
      return { id: getEposId(raw), raw };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function tryEposOrder(params: {
  orderId: number;
  orderNumber: string;
  customerId: string | null;
  payload: CheckoutPayload;
  address: CheckoutAddressInput;
  items: OrderItem[];
  shippingService: string;
  shippingAmount: number;
  shippingProductId?: string | null;
  total: number;
}) {
  const statusNumbers = Array.from({ length: 12 }, (_, index) => index + 1);
  const statusNames = ["Complete", "Completed", "Paid", "Pending", "Closed", "Processed"];
  const itemLines = params.items.map((item) => ({
    ProductId: Number(item.productId),
    ProductID: Number(item.productId),
    Quantity: item.quantity,
    UnitPrice: item.unitPrice,
    Price: item.unitPrice,
    SalePrice: item.unitPrice,
    Total: item.lineTotal,
    Name: item.name,
    Sku: item.sku
  }));
  if (params.shippingProductId) {
    itemLines.push({
      ProductId: Number(params.shippingProductId),
      ProductID: Number(params.shippingProductId),
      Quantity: 1,
      UnitPrice: params.shippingAmount,
      Price: params.shippingAmount,
      SalePrice: params.shippingAmount,
      Total: params.shippingAmount,
      Name: params.shippingService,
      Sku: "WEBSITE-SHIPPING"
    });
  }
  const notes = [
    `Website order ${params.orderNumber}`,
    `Ship via ${params.shippingService}: $${params.shippingAmount.toFixed(2)}`,
    `Ship to ${params.address.address1}${params.address.address2 ? `, ${params.address.address2}` : ""}, ${params.address.city}, ${params.address.state} ${params.address.postalCode}`,
    params.payload.customer?.phone ? `Phone: ${params.payload.customer.phone}` : "",
    params.payload.notes ? `Customer note: ${params.payload.notes}` : ""
  ].filter(Boolean).join("\n");
  const statusVariants = [
    ...statusNumbers.map((status) => ({
      Status: status,
      StatusId: status,
      StatusID: status,
      TransactionStatus: status,
      TransactionStatusId: status,
      TransactionStatusID: status
    })),
    ...statusNames.map((status) => ({
      Status: status,
      StatusId: status,
      TransactionStatus: status,
      TransactionStatusId: status
    }))
  ];
  const base = {
    CustomerId: params.customerId ? Number(params.customerId) : undefined,
    Reference: params.orderNumber,
    ReferenceCode: params.orderNumber,
    Notes: notes,
    Note: notes,
    Total: params.total,
    TotalAmount: params.total,
    DateTime: new Date().toISOString(),
    DeliveryAddress1: params.address.address1,
    DeliveryAddress2: params.address.address2 || "",
    DeliveryTown: params.address.city,
    DeliveryCounty: params.address.state,
    DeliveryPostCode: params.address.postalCode,
    Items: itemLines,
    OrderItems: itemLines,
    TransactionItems: itemLines
  };
  const payloads = statusVariants.flatMap((status) => [
    { ...base, ...status, OrderProducts: itemLines },
    { ...base, ...status, Products: itemLines },
    { ...base, ...status, Lines: itemLines },
    { ...base, ...status }
  ]);
  const endpoints = ["Transaction"];
  const failures: string[] = [];

  for (const endpoint of endpoints) {
    for (const orderPayload of payloads) {
      try {
        const raw = await eposWriteWithPayloadVariants(endpoint, "POST", orderPayload);
        return { id: getEposId(raw), endpoint, raw };
      } catch (error) {
        failures.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const transactionPayloads = statusVariants.flatMap((status) => [
    {
      ...status,
      CustomerId: params.customerId ? Number(params.customerId) : undefined,
      DateTime: new Date().toISOString(),
      TotalAmount: params.total,
      Total: params.total,
      Reference: params.orderNumber,
      ReferenceCode: params.orderNumber,
      Notes: notes,
      Note: notes
    },
    {
      ...status,
      CustomerId: params.customerId ? Number(params.customerId) : undefined,
      Date: new Date().toISOString(),
      Amount: params.total,
      Reference: params.orderNumber,
      Notes: notes
    }
  ]);

  for (const transactionPayload of transactionPayloads) {
    try {
      const transactionRaw = await eposWriteWithPayloadVariants("Transaction", "POST", transactionPayload);
      const transactionId = getEposId(transactionRaw);

      if (!transactionId) {
        return { id: null, endpoint: "Transaction", raw: transactionRaw };
      }

      const lineFailures: string[] = [];
      for (const line of itemLines) {
        const linePayload = {
          TransactionId: Number(transactionId),
          TransactionID: Number(transactionId),
          ProductId: line.ProductId,
          ProductID: line.ProductID,
          Quantity: line.Quantity,
          UnitPrice: line.UnitPrice,
          Price: line.Price,
          Total: line.Total,
          TotalAmount: line.Total
        };
        let lineSynced = false;

        for (const lineEndpoint of ["TransactionItem", "TransactionItems", "TransactionDetail", "TransactionDetails"]) {
          try {
            await eposWriteWithPayloadVariants(lineEndpoint, "POST", linePayload);
            lineSynced = true;
            break;
          } catch (error) {
            lineFailures.push(`${lineEndpoint}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }

        if (!lineSynced) {
          throw new Error(lineFailures.slice(-4).join(" | "));
        }
      }

      return { id: transactionId, endpoint: "Transaction", raw: transactionRaw };
    } catch (error) {
      failures.push(`Transaction+lines: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(failures.join(" | ").slice(0, 2000));
}

async function syncOrderToEpos(params: {
  orderId: number;
  orderNumber: string;
  payload: CheckoutPayload;
  address: CheckoutAddressInput;
  items: OrderItem[];
  shippingService: string;
  shippingAmount: number;
  shippingProductId?: string | null;
  total: number;
  existingCustomerId?: string | null;
}) {
  const customer = params.existingCustomerId
    ? { id: params.existingCustomerId, raw: { Id: Number(params.existingCustomerId), reused: true } }
    : await tryEposCustomer(params.payload, params.address);

  try {
    const order = await tryEposOrder({ ...params, customerId: customer.id });

    return {
      ok: true as const,
      customerId: customer.id,
      orderId: order.id,
      message: order.id ? "Order sent to EPOS." : "Order sent to EPOS but no order ID was returned.",
      raw: {
        customer: customer.raw,
        order: order.raw,
        endpoint: order.endpoint
      }
    };
  } catch (error) {
    return {
      ok: false as const,
      customerId: customer.id,
      orderId: null,
      message: error instanceof Error ? error.message : "EPOS order sync failed.",
      raw: {
        customer: customer.raw
      }
    };
  }
}

async function loadOrderForRetry(orderId: number) {
  await ensureOrderTables();
  const sql = getSql();
  const rows = await sql`
    SELECT id::int,
      order_number,
      customer_first_name,
      customer_last_name,
      customer_email,
      customer_phone,
      shipping_address1,
      shipping_address2,
      shipping_city,
      shipping_state,
      shipping_postal_code,
      shipping_country,
      shipping_service,
      shipping_amount::text,
      total::text,
      customer_notes,
      epos_customer_id
    FROM site_orders
    WHERE id = ${orderId}
  `;

  if (!rows.length) {
    throw new Error("Order was not found.");
  }

  const itemRows = await getOrderItems(orderId);
  const order = rows[0] as Record<string, string | number | null>;
  return {
    order,
    items: itemRows.filter((item) => item.product_type !== "dropship").map((item) => ({
      productId: item.epos_product_id,
      productType: "native" as const,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total)
    }))
  };
}

export async function retryOrderEposSync(orderId: number) {
  const sql = getSql();
  const { order, items } = await loadOrderForRetry(orderId);
  const address: CheckoutAddressInput = {
    address1: String(order.shipping_address1 || ""),
    address2: String(order.shipping_address2 || ""),
    city: String(order.shipping_city || ""),
    state: String(order.shipping_state || ""),
    postalCode: String(order.shipping_postal_code || ""),
    country: String(order.shipping_country || "US")
  };
  const payload: CheckoutPayload = {
    customer: {
      firstName: String(order.customer_first_name || ""),
      lastName: String(order.customer_last_name || ""),
      email: String(order.customer_email || ""),
      phone: String(order.customer_phone || "")
    },
    address,
    notes: String(order.customer_notes || "")
  };
  const settings = await getShippingSettings();
  const epos = await syncOrderToEpos({
    orderId,
    orderNumber: String(order.order_number),
    payload,
    address,
    items,
    shippingService: String(order.shipping_service || "Website Shipping"),
    shippingAmount: Number(order.shipping_amount || 0),
    shippingProductId: settings.epos_shipping_product_id,
    total: Number(order.total || 0),
    existingCustomerId: order.epos_customer_id ? String(order.epos_customer_id) : null
  });

  await sql`
    UPDATE site_orders
    SET epos_customer_id = ${epos.customerId},
      epos_order_id = ${epos.orderId},
      epos_sync_status = ${epos.ok && epos.orderId ? "synced" : epos.ok ? "submitted" : "failed"},
      epos_sync_message = ${epos.message},
      epos_raw = ${JSON.stringify(epos.raw)}::jsonb,
      updated_at = NOW()
    WHERE id = ${orderId}
  `;

  return epos;
}

export async function listDropshipFulfillmentQueue(limit = 100) {
  await ensureOrderTables();
  const sql = getSql();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);

  return (await sql`
    SELECT
      q.id::int,
      q.order_id::int,
      q.order_item_id::int,
      o.order_number,
      concat(o.customer_first_name, ' ', o.customer_last_name) AS customer_name,
      o.customer_email,
      concat(o.shipping_address1, COALESCE(', ' || o.shipping_address2, ''), ', ', o.shipping_city, ', ', o.shipping_state, ' ', o.shipping_postal_code) AS shipping_address,
      q.supplier_key,
      q.supplier_product_id,
      q.supplier_variant_id,
      q.supplier_sku,
      i.name AS product_title,
      i.variant_title_snapshot AS variant_title,
      i.image_snapshot AS image_url,
      q.quantity::int,
      i.line_total::text AS customer_paid_amount,
      (i.metadata_json->>'wholesale_price') AS supplier_cost,
      i.shipping_cost_snapshot::text AS estimated_supplier_shipping,
      o.payment_status,
      i.fulfillment_status,
      q.status,
      q.supplier_order_id,
      q.supplier_order_reference,
      q.fulfillment_notes,
      q.tracking_number,
      q.tracking_carrier,
      q.created_at::text,
      q.updated_at::text
    FROM dropship_fulfillment_queue q
    JOIN site_orders o ON o.id = q.order_id
    JOIN site_order_items i ON i.id = q.order_item_id
    ORDER BY q.created_at DESC
    LIMIT ${safeLimit}
  `) as DropshipFulfillmentRecord[];
}

export async function updateDropshipFulfillment(input: {
  id: number;
  status?: string;
  supplierOrderId?: string | null;
  supplierOrderReference?: string | null;
  fulfillmentNotes?: string | null;
  trackingNumber?: string | null;
  trackingCarrier?: string | null;
  errorMessage?: string | null;
}) {
  await ensureOrderTables();
  const sql = getSql();
  const allowed = new Set([
    "ready_for_supplier_order",
    "supplier_order_submitted",
    "supplier_processing",
    "shipped",
    "delivered",
    "cancelled",
    "failed",
    "refunded",
    "SUPPLIER_INVENTORY_CHANGED"
  ]);
  const nextStatus = input.status || "ready_for_supplier_order";

  if (!allowed.has(nextStatus)) {
    throw new Error("Unsupported fulfillment status.");
  }

  const rows = await sql`
    UPDATE dropship_fulfillment_queue
    SET status = ${nextStatus},
      supplier_order_id = ${input.supplierOrderId ?? null},
      supplier_order_reference = ${input.supplierOrderReference ?? null},
      fulfillment_notes = ${input.fulfillmentNotes ?? null},
      tracking_number = ${input.trackingNumber ?? null},
      tracking_carrier = ${input.trackingCarrier ?? null},
      error_message = ${input.errorMessage ?? null},
      submitted_at = CASE WHEN ${nextStatus} = 'supplier_order_submitted' THEN NOW() ELSE submitted_at END,
      fulfilled_at = CASE WHEN ${nextStatus} IN ('shipped', 'delivered') THEN NOW() ELSE fulfilled_at END,
      failed_at = CASE WHEN ${nextStatus} = 'failed' THEN NOW() ELSE failed_at END,
      updated_at = NOW()
    WHERE id = ${input.id}
    RETURNING id::int, order_id::int, order_item_id::int, status
  `;

  if (!rows.length) {
    throw new Error("Fulfillment queue record was not found.");
  }

  const row = rows[0] as { id: number; order_id: number; order_item_id: number; status: string };
  await sql`
    UPDATE site_order_items
    SET fulfillment_status = ${nextStatus},
      updated_at = NOW()
    WHERE id = ${row.order_item_id}
  `;
  await sql`
    UPDATE site_orders
    SET fulfillment_status = (
      SELECT CASE
        WHEN COUNT(*) FILTER (WHERE fulfillment_status NOT IN ('delivered', 'cancelled', 'refunded')) = 0 THEN 'delivered'
        WHEN COUNT(*) FILTER (WHERE fulfillment_status = 'shipped') > 0 THEN 'shipped'
        WHEN COUNT(*) FILTER (WHERE fulfillment_status IN ('supplier_order_submitted', 'supplier_processing')) > 0 THEN 'supplier_processing'
        WHEN COUNT(*) FILTER (WHERE fulfillment_status = 'failed') > 0 THEN 'failed'
        ELSE site_orders.fulfillment_status
      END
      FROM site_order_items
      WHERE order_id = ${row.order_id}
    ),
      updated_at = NOW()
    WHERE id = ${row.order_id}
  `;

  return row;
}

export async function submitCheckoutOrder(payload: CheckoutPayload) {
  await ensureOrderTables();

  const firstName = String(payload.customer?.firstName || "").trim();
  const lastName = String(payload.customer?.lastName || "").trim();
  const email = String(payload.customer?.email || "").trim().toLowerCase();
  const address: CheckoutAddressInput = {
    address1: String(payload.address?.address1 || "").trim(),
    address2: String(payload.address?.address2 || "").trim(),
    city: String(payload.address?.city || "").trim(),
    state: String(payload.address?.state || "").trim().toUpperCase(),
    postalCode: String(payload.address?.postalCode || "").trim(),
    country: String(payload.address?.country || "US").trim().toUpperCase()
  };
  const normalizedItems = normalizeItems(payload.items);

  if (!firstName || !lastName || !emailPattern.test(email)) {
    return { ok: false as const, message: "Enter your name and a valid email address." };
  }

  if (!normalizedItems.length) {
    return { ok: false as const, message: "Add at least one live shop item before checkout." };
  }

  const settings = await getShippingSettings();
  const builtItems = await buildOrderItems(normalizedItems);
  if (!builtItems.ok) {
    return builtItems;
  }
  const orderItems = builtItems.items;
  const nativeItems = orderItems.filter((item) => item.productType === "native");
  const dropshipItems = orderItems.filter((item) => item.productType === "dropship");

  const subtotal = money(orderItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const nativeSubtotal = money(nativeItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const addressCheck = calculateShipping(settings, address, Math.max(nativeSubtotal, 0.01), 1);
  const shipping = nativeItems.length
    ? calculateShipping(settings, address, nativeSubtotal, nativeItems.reduce((sum, item) => sum + item.quantity, 0))
    : { ...addressCheck, shippingAmount: 0, serviceName: "Supplier Shipping" };

  if (!shipping.ok) {
    return { ok: false as const, message: shipping.message };
  }

  const dropshipShippingAmount = calculateDropshipShipping(dropshipItems);
  const shippingAmount = money(shipping.shippingAmount + dropshipShippingAmount);
  const total = money(subtotal + shippingAmount);
  const sql = getSql();
  const inserted = await sql`
    INSERT INTO site_orders (
      order_number,
      customer_first_name,
      customer_last_name,
      customer_email,
      customer_phone,
      shipping_address1,
      shipping_address2,
      shipping_city,
      shipping_state,
      shipping_postal_code,
      shipping_country,
      shipping_service,
      subtotal,
      shipping_amount,
      total,
      customer_notes,
      payment_status,
      fulfillment_status,
      currency,
      tax_total,
      discount_total,
      payment_provider,
      shipping_address_json,
      billing_address_json,
      contains_native_items,
      contains_dropship_items,
      cart_checksum
    )
    VALUES (
      'PENDING',
      ${firstName},
      ${lastName},
      ${email},
      ${String(payload.customer?.phone || "").trim() || null},
      ${address.address1},
      ${address.address2 || null},
      ${address.city},
      ${address.state},
      ${address.postalCode},
      ${address.country || "US"},
      ${shipping.serviceName},
      ${subtotal},
      ${shippingAmount},
      ${total},
      ${String(payload.notes || "").trim() || null},
      ${"payment_confirmed"},
      ${dropshipItems.length ? "ready_for_supplier_order" : "payment_confirmed"},
      ${"USD"},
      ${0},
      ${0},
      ${"custom_order_request"},
      ${JSON.stringify(address)}::jsonb,
      ${JSON.stringify(address)}::jsonb,
      ${nativeItems.length > 0},
      ${dropshipItems.length > 0},
      ${cartChecksum(normalizedItems)}
    )
    RETURNING id::int
  `;
  const id = Number(inserted[0].id);
  const nextOrderNumber = orderNumber(id);

  await sql`UPDATE site_orders SET order_number = ${nextOrderNumber}, updated_at = NOW() WHERE id = ${id}`;

  for (const item of orderItems) {
    await sql`
      INSERT INTO site_order_items (
        order_id,
        epos_product_id,
        product_type,
        supplier_key,
        supplier_product_id,
        supplier_variant_id,
        supplier_sku,
        name,
        sku,
        title_snapshot,
        variant_title_snapshot,
        image_snapshot,
        quantity,
        unit_price,
        shipping_cost_snapshot,
        line_total,
        fulfillment_status,
        inventory_snapshot,
        metadata_json,
        updated_at
      )
      VALUES (
        ${id},
        ${item.productId},
        ${item.productType},
        ${item.supplierKey || null},
        ${item.supplierProductId || null},
        ${item.supplierVariantId || null},
        ${item.supplierSku || null},
        ${item.name},
        ${item.sku},
        ${item.name},
        ${item.variantTitle || null},
        ${item.imageUrl || null},
        ${item.quantity},
        ${item.unitPrice},
        ${item.shippingCost || 0},
        ${item.lineTotal},
        ${item.productType === "dropship" ? "ready_for_supplier_order" : "payment_confirmed"},
        ${item.inventorySnapshot ?? null},
        ${JSON.stringify(item.metadata || {})}::jsonb,
        NOW()
      )
    `;
  }

  await sql`
    INSERT INTO dropship_fulfillment_queue (
      order_id,
      order_item_id,
      supplier_key,
      supplier_product_id,
      supplier_variant_id,
      supplier_sku,
      quantity,
      status
    )
    SELECT
      order_id,
      id,
      supplier_key,
      supplier_product_id,
      supplier_variant_id,
      supplier_sku,
      quantity,
      'ready_for_supplier_order'
    FROM site_order_items
    WHERE order_id = ${id}
      AND product_type = 'dropship'
    ON CONFLICT (order_item_id) DO NOTHING
  `;

  try {
    await upsertCustomerAccount({
      firstName,
      lastName,
      email,
      phone: String(payload.customer?.phone || "").trim() || null,
      source: "checkout",
      orderNumber: nextOrderNumber
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Customer capture failed.");
  }

  try {
    if (!nativeItems.length) {
      await sql`
        UPDATE site_orders
        SET epos_sync_status = 'skipped',
          epos_sync_message = 'Dropship-only order. Manual supplier fulfillment queue created.',
          updated_at = NOW()
        WHERE id = ${id}
      `;
    } else {
      const epos = await syncOrderToEpos({
        orderId: id,
        orderNumber: nextOrderNumber,
        payload: { ...payload, customer: { ...payload.customer, firstName, lastName, email } },
        address,
        items: nativeItems,
        shippingService: shipping.serviceName,
        shippingAmount: money(shipping.shippingAmount),
        shippingProductId: shipping.eposShippingProductId,
        total: money(nativeSubtotal + shipping.shippingAmount)
      });

      await sql`
        UPDATE site_orders
        SET epos_customer_id = ${epos.customerId},
          epos_order_id = ${epos.orderId},
          epos_sync_status = ${epos.ok && epos.orderId ? "synced" : epos.ok ? "submitted" : "failed"},
          epos_sync_message = ${epos.message},
          epos_raw = ${JSON.stringify(epos.raw)}::jsonb,
          updated_at = NOW()
        WHERE id = ${id}
      `;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "EPOS order sync failed.";
    await sql`
      UPDATE site_orders
      SET epos_sync_status = 'failed',
        epos_sync_message = ${message},
        updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  const rows = await sql`
    SELECT order_number,
      total::text,
      epos_order_id,
      epos_sync_status,
      epos_sync_message
    FROM site_orders
    WHERE id = ${id}
  `;
  const order = rows[0] as {
    order_number: string;
    total: string;
    epos_order_id: string | null;
    epos_sync_status: string;
    epos_sync_message: string | null;
  };

  return {
    ok: true as const,
    message: order.epos_sync_status === "failed"
      ? `Order ${order.order_number} was saved, but EPOS sync needs review.`
      : `Order ${order.order_number} submitted.`,
    order
  };
}
