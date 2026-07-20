import type { CommerceInventoryRecord, CommerceProduct } from "../core/types";
import type { CommerceRepository } from "../persistence/types";

export class InventoryService {
  constructor(private repository?: Pick<CommerceRepository, "upsertInventory">) {}

  recordsFromProduct(product: CommerceProduct): CommerceInventoryRecord[] {
    return product.variants.map((variant) => ({
      supplierKey: product.supplierKey,
      supplierProductId: product.supplierProductId,
      supplierVariantId: variant.supplierVariantId,
      sku: variant.sku,
      quantity: variant.inventoryQuantity,
      isInStock: variant.isInStock,
      warehouseType: product.warehouseType
    }));
  }

  async upsertProductInventory(product: CommerceProduct) {
    const records = this.recordsFromProduct(product);
    await this.repository?.upsertInventory?.(records);
    return records;
  }
}

