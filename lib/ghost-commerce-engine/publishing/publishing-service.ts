import { CommerceError } from "../core/errors";
import type { CommerceMarkupType, CommercePublishedProduct, CommerceSupplierKey } from "../core/types";
import type { CommerceRepository } from "../persistence/types";

export type PublishProductInput = {
  supplierKey: CommerceSupplierKey;
  supplierProductId: string;
  titleOverride?: string | null;
  descriptionOverride?: string | null;
  markupType?: CommerceMarkupType;
  markupValue?: number | null;
  priceOverride?: number | null;
  collection?: string | null;
  publish?: boolean;
};

export class PublishingService {
  constructor(private repository: CommerceRepository) {}

  async importSupplierProduct(input: PublishProductInput): Promise<CommercePublishedProduct> {
    const product = await this.repository.getSupplierProduct(input.supplierKey, input.supplierProductId);
    if (!product) {
      throw new CommerceError("COMMERCE_PRODUCT_NOT_FOUND", "Supplier product has not been synced yet.");
    }

    return this.repository.upsertPublishedProduct({
      supplierKey: input.supplierKey,
      supplierProductId: input.supplierProductId,
      titleOverride: input.titleOverride || null,
      descriptionOverride: input.descriptionOverride || null,
      markupType: input.markupType || "percentage",
      markupValue: input.markupValue ?? (input.markupType === "fixed" ? 0 : 60),
      priceOverride: input.priceOverride ?? null,
      collection: input.collection || null,
      isPublished: Boolean(input.publish)
    });
  }

  publishProduct(supplierKey: CommerceSupplierKey, supplierProductId: string) {
    return this.repository.publishProduct(supplierKey, supplierProductId);
  }

  unpublishProduct(supplierKey: CommerceSupplierKey, supplierProductId: string) {
    return this.repository.unpublishProduct(supplierKey, supplierProductId);
  }
}

