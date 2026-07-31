export function isDropshippingEnabled() {
  return process.env.DROPSHIPPING_ENABLED === "true";
}

export function isDropshippingCheckoutEnabled() {
  return isDropshippingEnabled() && process.env.DROPSHIPPING_CHECKOUT_ENABLED === "true" && isDropshippingManualFulfillmentEnabled();
}

export function isDropshippingManualFulfillmentEnabled() {
  return process.env.DROPSHIPPING_MANUAL_FULFILLMENT_ENABLED === "true";
}

export type DropshipShippingMode = "per_item" | "highest_item" | "flat" | "included";

export function getDropshipShippingMode(): DropshipShippingMode {
  const mode = process.env.DROPSHIP_SHIPPING_MODE || "per_item";
  if (["per_item", "highest_item", "flat", "included"].includes(mode)) {
    return mode as DropshipShippingMode;
  }

  return "per_item";
}

export function getDropshipFlatShippingRate() {
  const parsed = Number(process.env.DROPSHIP_FLAT_SHIPPING_RATE || 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function isDropshippingSyncEnabled() {
  return isDropshippingEnabled() && process.env.DROPSHIPPING_SYNC_ENABLED === "true";
}

export function isDearLoverSyncEnabled() {
  return isDropshippingSyncEnabled() && process.env.DEAR_LOVER_SYNC_ENABLED === "true";
}

export function getDearLoverBaseUrl() {
  return (process.env.DEAR_LOVER_BASE_URL || "https://ds.dear-lover.com").replace(/\/$/, "");
}

export function getDearLoverAuthCookie() {
  return process.env.DEAR_LOVER_AUTH_COOKIE || "";
}

export function isDropshippingFixtureEnabled() {
  const runtime = process.env.VERCEL_ENV || process.env.NODE_ENV || "development";
  return process.env.DROPSHIPPING_USE_FIXTURE === "true" && runtime !== "production";
}

export function getDropshippingSchema() {
  const schema = process.env.DROPSHIPPING_SCHEMA || "";
  if (!schema) {
    return "";
  }

  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    throw new Error("DROPSHIPPING_SCHEMA must be a valid PostgreSQL identifier.");
  }

  return schema;
}
