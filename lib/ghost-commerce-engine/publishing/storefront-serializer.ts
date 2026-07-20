import type { CommerceProduct, CommercePublishedProduct, CommerceStorefrontProduct, CommerceVariant } from "../core/types";
import { PricingService } from "../pricing/pricing-service";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function variantLabel(variant: CommerceVariant) {
  return [variant.color, variant.size || variant.sizeName || variant.title].map((item) => item || "").filter(Boolean).join(" / ") || null;
}

export class StorefrontSerializer {
  constructor(private pricing = new PricingService()) {}

  serialize(product: CommerceProduct, publication: CommercePublishedProduct): CommerceStorefrontProduct[] {
    if (!publication.isPublished) {
      return [];
    }

    const title = publication.titleOverride || product.title;
    const price = this.pricing.calculate({
      wholesalePrice: product.wholesalePrice,
      shippingCost: product.shippingCost,
      suggestedRetailPrice: product.suggestedRetailPrice,
      markupType: publication.markupType,
      markupValue: publication.markupValue,
      priceOverride: publication.priceOverride
    }).retailPrice;
    const department = publication.collection || "dropshipping";
    const categorySlugs = [department, ...product.categoryNames.map(slugify)].filter(Boolean);

    return product.variants.map((variant) => ({
      id: `dropship:${product.supplierKey}:${variant.supplierVariantId}`,
      name: title,
      description: product.description,
      sku: variant.sku || product.supplierSku,
      barcode: variant.barcode,
      salePrice: price.toFixed(2),
      stock: String(variant.isInStock ? variant.inventoryQuantity : 0),
      marketingTitle: title,
      marketingDescription: publication.descriptionOverride || null,
      department,
      categorySlugs,
      primaryImageUrl: product.imageUrl,
      primaryImageAlt: title,
      isDropship: true,
      supplierKey: product.supplierKey,
      supplierProductId: product.supplierProductId,
      supplierVariantId: variant.supplierVariantId,
      variantLabel: variantLabel(variant),
      warehouseType: product.warehouseType
    }));
  }
}

