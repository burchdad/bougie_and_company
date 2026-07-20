import type { CommerceProduct, CommercePublishedProduct, CommerceSupplier, CommerceVariant } from "../core/types";

export function commerceSupplierFactory(overrides: Partial<CommerceSupplier> = {}): CommerceSupplier {
  return {
    key: "fixture",
    displayName: "Fixture Supplier",
    baseUrl: "https://example.test",
    isActive: true,
    capabilities: {
      catalogSearch: true,
      catalogSync: true,
      inventorySync: true,
      orderSubmission: false,
      orderStatus: false,
      tracking: false
    },
    ...overrides
  };
}

export function commerceVariantFactory(overrides: Partial<CommerceVariant> = {}): CommerceVariant {
  return {
    supplierKey: "fixture",
    supplierProductId: "product-1",
    supplierVariantId: "variant-1",
    sku: "SKU-1",
    barcode: null,
    title: "Small",
    sizeName: "Small",
    color: "Black",
    size: "S",
    price: 10,
    weight: null,
    inventoryQuantity: 3,
    isInStock: true,
    raw: { fixture: true },
    ...overrides
  };
}

export function commerceProductFactory(overrides: Partial<CommerceProduct> = {}): CommerceProduct {
  const supplierKey = overrides.supplierKey || "fixture";
  const supplierProductId = overrides.supplierProductId || "product-1";
  const variants = overrides.variants || [commerceVariantFactory({ supplierKey, supplierProductId })];

  return {
    supplierKey,
    supplierProductId,
    supplierSku: "PRODUCT-1",
    title: "Fixture Product",
    description: "A fixture product",
    categoryNames: ["Dresses"],
    imageUrl: "https://example.test/image.jpg",
    secondImageUrl: null,
    wholesalePrice: 12.29,
    originalPrice: null,
    suggestedRetailPrice: 48,
    shippingCost: 10.3,
    currency: "USD",
    warehouseType: "fixture",
    totalInventory: variants.reduce((sum, variant) => sum + variant.inventoryQuantity, 0),
    routeUrl: null,
    images: [{ url: "https://example.test/image.jpg", altText: "Fixture Product", sortOrder: 0 }],
    categories: [{ name: "Dresses" }],
    variants,
    raw: { fixture: true },
    ...overrides
  };
}

export function commercePublicationFactory(overrides: Partial<CommercePublishedProduct> = {}): CommercePublishedProduct {
  return {
    id: "publication-1",
    supplierKey: "fixture",
    supplierProductId: "product-1",
    titleOverride: null,
    descriptionOverride: null,
    priceOverride: null,
    markupType: "percentage",
    markupValue: 60,
    isPublished: true,
    collection: "dropshipping",
    ...overrides
  };
}

