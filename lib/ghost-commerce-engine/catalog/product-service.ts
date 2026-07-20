import { CommerceError } from "../core/errors";
import type { CommerceSupplierKey } from "../core/types";
import type { CommerceProductQuery, CommerceRepository } from "../persistence/types";

export class ProductService {
  constructor(private repository: CommerceRepository) {}

  listSupplierProducts(query: CommerceProductQuery = {}) {
    return this.repository.listSupplierProducts(query);
  }

  async getSupplierProduct(supplierKey: CommerceSupplierKey, supplierProductId: string) {
    const product = await this.repository.getSupplierProduct(supplierKey, supplierProductId);
    if (!product) {
      throw new CommerceError("COMMERCE_PRODUCT_NOT_FOUND", `Product "${supplierProductId}" was not found for supplier "${supplierKey}".`);
    }

    return product;
  }
}

