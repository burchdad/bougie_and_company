import type {
  CommerceProduct,
  CommerceProductSearchRequest,
  CommerceProductSearchResult,
  CommerceSupplierAdapter,
  CommerceSyncRequest,
  CommerceSyncResult,
  CommerceVariant
} from "../core/types";
import { commerceProductFactory } from "./factories";

export class FixtureCommerceAdapter implements CommerceSupplierAdapter {
  key = "fixture";
  displayName = "Fixture Supplier";
  capabilities = {
    catalogSearch: true,
    catalogSync: true,
    inventorySync: true,
    orderSubmission: false,
    orderStatus: false,
    tracking: false
  };
  private products: CommerceProduct[];

  constructor(products: CommerceProduct[] = [commerceProductFactory()]) {
    this.products = products;
  }

  async testConnection() {
    return { ok: true, supplierKey: this.key };
  }

  async searchProducts(request: CommerceProductSearchRequest): Promise<CommerceProductSearchResult> {
    const page = Math.max(1, Number(request.page || 1));
    const pageSize = Math.max(1, Number(request.pageSize || this.products.length || 1));
    const start = (page - 1) * pageSize;
    const products = this.products.slice(start, start + pageSize);
    const totalPages = Math.max(1, Math.ceil(this.products.length / pageSize));

    return {
      products,
      page,
      pageSize,
      total: this.products.length,
      totalPages,
      hasMore: page < totalPages,
      raw: { fixture: true }
    };
  }

  async syncCatalog(request: CommerceSyncRequest): Promise<CommerceSyncResult> {
    const result = await this.searchProducts({ page: 1, pageSize: request.pageSize || this.products.length || 1 });
    return {
      supplierKey: this.key,
      status: "success",
      productsSeen: result.products.length,
      productsUpserted: 0,
      variantsSeen: result.products.reduce((sum, product) => sum + product.variants.length, 0),
      variantsUpserted: 0,
      failures: []
    };
  }

  normalizeProduct(raw: unknown): CommerceProduct {
    return raw && typeof raw === "object" && "supplierProductId" in raw ? raw as CommerceProduct : commerceProductFactory();
  }

  normalizeVariants(raw: unknown): CommerceVariant[] {
    return this.normalizeProduct(raw).variants;
  }
}

