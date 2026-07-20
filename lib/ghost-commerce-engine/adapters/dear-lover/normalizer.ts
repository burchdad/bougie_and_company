import type { CommerceProduct, CommerceVariant } from "../../core/types";
import { dearLoverSupplierKey } from "./types";

function asRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitCategories(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeImageUrl(value: unknown) {
  const raw = asString(value);
  if (!raw) {
    return null;
  }

  return raw.startsWith("http://") ? raw.replace("http://", "https://") : raw;
}

export function normalizeDearLoverProduct(raw: unknown): CommerceProduct {
  const product = asRecord(raw);
  const supplierProductId = String(product.id || "");
  const imageUrl = normalizeImageUrl(product.image_src);
  const secondImageUrl = normalizeImageUrl(product.second_image);
  const categoryNames = splitCategories(product.category_names);
  const images = [
    imageUrl ? { url: imageUrl, altText: asString(product.alt_text) || asString(product.title), sortOrder: 0, raw: { source: "image_src" } } : null,
    secondImageUrl ? { url: secondImageUrl, altText: asString(product.alt_text) || asString(product.title), sortOrder: 1, raw: { source: "second_image" } } : null
  ].filter(Boolean) as CommerceProduct["images"];

  return {
    supplierKey: dearLoverSupplierKey,
    supplierProductId,
    supplierSku: asString(product.codeno),
    title: asString(product.title) || "Untitled dropship product",
    description: null,
    categoryNames,
    imageUrl,
    secondImageUrl,
    wholesalePrice: asNumber(product.sale_price),
    originalPrice: asNumber(product.original_price),
    suggestedRetailPrice: asNumber(product.suggest_price),
    shippingCost: asNumber(product.shipping_cost),
    currency: asString(product.currency),
    warehouseType: asString(product.warehouse_type),
    totalInventory: asNumber(product.inventory_quantity) ?? asNumber(product.total_qty) ?? 0,
    routeUrl: asString(product.route_url),
    images,
    categories: categoryNames.map((name) => ({ name })),
    variants: normalizeDearLoverVariants(raw),
    raw
  };
}

export function normalizeDearLoverVariants(raw: unknown): CommerceVariant[] {
  const product = asRecord(raw);
  const supplierProductId = String(product.id || "");
  const variants = Array.isArray(product.variants) ? product.variants : [];

  return variants.map((item, index) => {
    const variant = asRecord(item);
    const colorSize = asRecord(variant.color_size);
    const inventoryQuantity = asNumber(variant.inventory_quantity) ?? 0;

    return {
      supplierKey: dearLoverSupplierKey,
      supplierVariantId: String(variant.id || variant.codeno || `${supplierProductId}-${index}`),
      supplierProductId,
      sku: asString(variant.codeno),
      barcode: asString(variant.barcode),
      title: asString(variant.title),
      sizeName: asString(variant.size_name),
      color: asString(colorSize.color),
      size: asString(colorSize.size),
      price: asNumber(variant.price),
      weight: asNumber(variant.weight),
      inventoryQuantity,
      isInStock: Number(variant.is_instock) === 1 && inventoryQuantity > 0,
      raw: item
    };
  });
}

