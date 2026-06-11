import { getSql, emailPattern } from "@/lib/db";
import { eposWriteWithPayloadVariants, getEposId } from "@/lib/epos";
import { calculateShipping, getShippingSettings, type ShippingAddress } from "@/lib/shipping";

export type CheckoutItemInput = {
  id?: string;
  name?: string;
  quantity?: number;
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
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
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

  await sql`CREATE INDEX IF NOT EXISTS site_orders_created_idx ON site_orders (created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS site_order_items_order_idx ON site_order_items (order_id)`;
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
      name,
      sku,
      quantity::int,
      unit_price::text,
      line_total::text
    FROM site_order_items
    WHERE order_id = ${orderId}
    ORDER BY id ASC
  `) as Array<{
    epos_product_id: string;
    name: string;
    sku: string | null;
    quantity: number;
    unit_price: string;
    line_total: string;
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

function normalizeItems(items: CheckoutItemInput[] | undefined) {
  const byId = new Map<string, CheckoutItemInput>();

  (items || []).forEach((item) => {
    const id = String(item.id || "").trim();
    const quantity = Math.max(0, Math.trunc(Number(item.quantity || 0)));

    if (!id || quantity < 1) {
      return;
    }

    const existing = byId.get(id);
    byId.set(id, {
      id,
      name: item.name,
      quantity: (existing?.quantity || 0) + quantity
    });
  });

  return [...byId.values()];
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
  const base = {
    CustomerId: params.customerId ? Number(params.customerId) : undefined,
    Reference: params.orderNumber,
    ReferenceCode: params.orderNumber,
    Notes: notes,
    Note: notes,
    Status: 1,
    TransactionStatus: 1,
    TransactionStatusId: 1,
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
  const payloads = [
    { ...base, OrderProducts: itemLines },
    { ...base, Products: itemLines },
    { ...base, Lines: itemLines },
    base
  ];
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

  const transactionPayloads = [
    {
      CustomerId: params.customerId ? Number(params.customerId) : undefined,
      DateTime: new Date().toISOString(),
      TotalAmount: params.total,
      Total: params.total,
      TransactionStatus: 1,
      TransactionStatusId: 1,
      Reference: params.orderNumber,
      ReferenceCode: params.orderNumber,
      Notes: notes,
      Note: notes
    },
    {
      CustomerId: params.customerId ? Number(params.customerId) : undefined,
      Date: new Date().toISOString(),
      Amount: params.total,
      TransactionStatus: 1,
      TransactionStatusId: 1,
      Reference: params.orderNumber,
      Notes: notes
    }
  ];

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
}) {
  const customer = await tryEposCustomer(params.payload, params.address);

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
  const productRows = await loadProducts(normalizedItems.map((item) => String(item.id)));
  const byId = new Map(productRows.map((product) => [product.epos_product_id, product]));
  const orderItems: OrderItem[] = [];

  for (const input of normalizedItems) {
    const product = byId.get(String(input.id));
    const quantity = Number(input.quantity || 0);

    if (!product) {
      return { ok: false as const, message: `${input.name || "An item"} is not available in the live EPOS catalog.` };
    }

    const availableStock = displayStock(product);
    if (availableStock < quantity) {
      return { ok: false as const, message: `${product.name} only has ${availableStock} available.` };
    }

    const unitPrice = Number(product.sale_price || 0);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { ok: false as const, message: `${product.name} is missing an online sale price.` };
    }

    orderItems.push({
      productId: product.epos_product_id,
      name: product.name,
      sku: product.sku,
      quantity,
      unitPrice: money(unitPrice),
      lineTotal: money(unitPrice * quantity)
    });
  }

  const subtotal = money(orderItems.reduce((sum, item) => sum + item.lineTotal, 0));
  const shipping = calculateShipping(settings, address, subtotal, orderItems.reduce((sum, item) => sum + item.quantity, 0));

  if (!shipping.ok) {
    return { ok: false as const, message: shipping.message };
  }

  const shippingAmount = money(shipping.shippingAmount);
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
      customer_notes
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
      ${String(payload.notes || "").trim() || null}
    )
    RETURNING id::int
  `;
  const id = Number(inserted[0].id);
  const nextOrderNumber = orderNumber(id);

  await sql`UPDATE site_orders SET order_number = ${nextOrderNumber}, updated_at = NOW() WHERE id = ${id}`;

  for (const item of orderItems) {
    await sql`
      INSERT INTO site_order_items (order_id, epos_product_id, name, sku, quantity, unit_price, line_total)
      VALUES (${id}, ${item.productId}, ${item.name}, ${item.sku}, ${item.quantity}, ${item.unitPrice}, ${item.lineTotal})
    `;
  }

  try {
    const epos = await syncOrderToEpos({
      orderId: id,
      orderNumber: nextOrderNumber,
      payload: { ...payload, customer: { ...payload.customer, firstName, lastName, email } },
      address,
      items: orderItems,
      shippingService: shipping.serviceName,
      shippingAmount,
      shippingProductId: shipping.eposShippingProductId,
      total
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
