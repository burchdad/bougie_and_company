import type { CommerceProduct, CommerceVariant } from "../core/types";

export class VariantService {
  listInStockVariants(product: CommerceProduct): CommerceVariant[] {
    return product.variants.filter((variant) => variant.isInStock && variant.inventoryQuantity > 0);
  }

  countInStockVariants(product: CommerceProduct) {
    return this.listInStockVariants(product).length;
  }
}

