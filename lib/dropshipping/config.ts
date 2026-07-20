export function isDropshippingEnabled() {
  return process.env.DROPSHIPPING_ENABLED === "true";
}

export function isDropshippingCheckoutEnabled() {
  return isDropshippingEnabled() && process.env.DROPSHIPPING_CHECKOUT_ENABLED === "true";
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
