import { getSql } from "@/lib/db";
import { createEposProduct, getEposId, updateEposProduct } from "@/lib/epos";

export type ShippingSettings = {
  id: number;
  origin_postal_code: string;
  free_shipping_threshold: string;
  base_rate: string;
  per_item_rate: string;
  texas_rate: string;
  remote_rate: string;
  epos_shipping_product_id: string | null;
  updated_at: string;
};

export type ShippingAddress = {
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

const defaultSettings = {
  originPostalCode: "75785",
  freeShippingThreshold: 150,
  baseRate: 8.95,
  perItemRate: 1.25,
  texasRate: 7.95,
  remoteRate: 19.95
};

export async function ensureShippingTables() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS site_shipping_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      origin_postal_code TEXT NOT NULL DEFAULT '75785',
      free_shipping_threshold NUMERIC(12, 2) NOT NULL DEFAULT 150,
      base_rate NUMERIC(12, 2) NOT NULL DEFAULT 8.95,
      per_item_rate NUMERIC(12, 2) NOT NULL DEFAULT 1.25,
      texas_rate NUMERIC(12, 2) NOT NULL DEFAULT 7.95,
      remote_rate NUMERIC(12, 2) NOT NULL DEFAULT 19.95,
      epos_shipping_product_id TEXT,
      epos_raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    INSERT INTO site_shipping_settings (id)
    VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function getShippingSettings() {
  await ensureShippingTables();
  const sql = getSql();
  const rows = await sql`
    SELECT id,
      origin_postal_code,
      free_shipping_threshold::text,
      base_rate::text,
      per_item_rate::text,
      texas_rate::text,
      remote_rate::text,
      epos_shipping_product_id,
      updated_at::text
    FROM site_shipping_settings
    WHERE id = 1
  `;

  return rows[0] as ShippingSettings;
}

export async function saveShippingSettings(fields: {
  originPostalCode: string;
  freeShippingThreshold: number;
  baseRate: number;
  perItemRate: number;
  texasRate: number;
  remoteRate: number;
}) {
  await ensureShippingTables();
  const sql = getSql();
  const rows = await sql`
    UPDATE site_shipping_settings
    SET origin_postal_code = ${fields.originPostalCode || defaultSettings.originPostalCode},
      free_shipping_threshold = ${fields.freeShippingThreshold},
      base_rate = ${fields.baseRate},
      per_item_rate = ${fields.perItemRate},
      texas_rate = ${fields.texasRate},
      remote_rate = ${fields.remoteRate},
      updated_at = NOW()
    WHERE id = 1
    RETURNING id,
      origin_postal_code,
      free_shipping_threshold::text,
      base_rate::text,
      per_item_rate::text,
      texas_rate::text,
      remote_rate::text,
      epos_shipping_product_id,
      updated_at::text
  `;

  return rows[0] as ShippingSettings;
}

export function calculateShipping(settings: ShippingSettings, address: ShippingAddress, subtotalValue: number, itemCountValue: number) {
  const subtotal = Math.max(0, Number(subtotalValue) || 0);
  const itemCount = Math.max(0, Math.trunc(Number(itemCountValue) || 0));
  const state = String(address.state || "").trim().toUpperCase();
  const country = String(address.country || "US").trim().toUpperCase();
  const freeThreshold = Number(settings.free_shipping_threshold || defaultSettings.freeShippingThreshold);
  const hasAddress = Boolean(address.address1 && address.city && state && address.postalCode);

  if (!hasAddress) {
    return {
      ok: false,
      message: "Enter a shipping address to calculate shipping.",
      shippingAmount: 0,
      serviceName: "Address required",
      eposShippingProductId: settings.epos_shipping_product_id
    };
  }

  if (country !== "US") {
    return {
      ok: false,
      message: "Online shipping is currently available for US addresses only.",
      shippingAmount: 0,
      serviceName: "US shipping only",
      eposShippingProductId: settings.epos_shipping_product_id
    };
  }

  if (freeThreshold > 0 && subtotal >= freeThreshold) {
    return {
      ok: true,
      message: "Free shipping applied.",
      shippingAmount: 0,
      serviceName: "Free Shipping",
      eposShippingProductId: settings.epos_shipping_product_id
    };
  }

  const remoteStates = new Set(["AK", "HI"]);
  const baseRate = remoteStates.has(state)
    ? Number(settings.remote_rate || defaultSettings.remoteRate)
    : state === "TX"
      ? Number(settings.texas_rate || defaultSettings.texasRate)
      : Number(settings.base_rate || defaultSettings.baseRate);
  const perItemRate = Math.max(0, itemCount - 1) * Number(settings.per_item_rate || defaultSettings.perItemRate);
  const shippingAmount = Number((baseRate + perItemRate).toFixed(2));

  return {
    ok: true,
    message: "Shipping calculated.",
    shippingAmount,
    serviceName: remoteStates.has(state) ? "Remote US Shipping" : state === "TX" ? "Texas Shipping" : "Standard Shipping",
    eposShippingProductId: settings.epos_shipping_product_id
  };
}

export async function syncShippingProductToEpos(settings: ShippingSettings) {
  const fields = {
    name: "Website Shipping",
    description: "Shipping charge selected during Bougie & Company website checkout.",
    sku: "WEBSITE-SHIPPING",
    salePrice: Number(settings.base_rate || defaultSettings.baseRate),
    categoryId: null
  };

  const raw = settings.epos_shipping_product_id
    ? await updateEposProduct(settings.epos_shipping_product_id, {}, fields)
    : await createEposProduct(fields);
  const eposId = getEposId(raw);

  if (eposId) {
    const sql = getSql();
    await sql`
      UPDATE site_shipping_settings
      SET epos_shipping_product_id = ${eposId},
        epos_raw = ${JSON.stringify(raw)}::jsonb,
        updated_at = NOW()
      WHERE id = 1
    `;
  }

  return { eposId, raw };
}
