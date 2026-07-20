import type {
  CommerceProduct,
  CommercePublishedProduct,
  CommerceSupplier,
  CommerceSupplierKey,
  CommerceSyncRequest,
  CommerceSyncResult,
  CommerceSyncRun,
  CommerceVariant
} from "../core/types";
import type { CommerceProductQuery, CommercePublicationInput, CommerceRepository } from "../persistence/types";
import { StorefrontSerializer } from "../publishing/storefront-serializer";

function productKey(supplierKey: string, supplierProductId: string) {
  return `${supplierKey}:${supplierProductId}`;
}

export class InMemoryCommerceRepository implements CommerceRepository {
  suppliers = new Map<string, CommerceSupplier>();
  products = new Map<string, CommerceProduct>();
  publications = new Map<string, CommercePublishedProduct>();
  syncRuns = new Map<string | number, CommerceSyncRun>();
  private syncRunCounter = 0;

  async upsertSupplier(supplier: CommerceSupplier) {
    this.suppliers.set(supplier.key, supplier);
  }

  async listSuppliers() {
    return Array.from(this.suppliers.values());
  }

  async upsertProduct(product: CommerceProduct) {
    this.products.set(productKey(product.supplierKey, product.supplierProductId), product);
  }

  async upsertVariants(product: CommerceProduct, variants: CommerceVariant[]) {
    const stored = this.products.get(productKey(product.supplierKey, product.supplierProductId)) || product;
    this.products.set(productKey(product.supplierKey, product.supplierProductId), { ...stored, variants });
  }

  async createSyncRun(request: CommerceSyncRequest) {
    this.syncRunCounter += 1;
    const run: CommerceSyncRun = {
      id: this.syncRunCounter,
      supplierKey: request.supplierKey || "unknown",
      status: "running",
      startedAt: new Date(0).toISOString(),
      productsSeen: 0,
      productsUpserted: 0,
      variantsSeen: 0,
      variantsUpserted: 0,
      metadata: request.metadata
    };
    this.syncRuns.set(run.id, run);
    return run;
  }

  async completeSyncRun(syncRunId: string | number, result: CommerceSyncResult) {
    const run = this.syncRuns.get(syncRunId);
    if (run) {
      this.syncRuns.set(syncRunId, {
        ...run,
        status: result.status,
        finishedAt: new Date(0).toISOString(),
        productsSeen: result.productsSeen,
        productsUpserted: result.productsUpserted,
        variantsSeen: result.variantsSeen,
        variantsUpserted: result.variantsUpserted,
        errorMessage: result.failures.join(" | ") || null
      });
    }
  }

  async failSyncRun(syncRunId: string | number, error: Error, partial: Partial<CommerceSyncResult> = {}) {
    const run = this.syncRuns.get(syncRunId);
    if (run) {
      this.syncRuns.set(syncRunId, {
        ...run,
        status: "failed",
        finishedAt: new Date(0).toISOString(),
        productsSeen: partial.productsSeen || 0,
        productsUpserted: partial.productsUpserted || 0,
        variantsSeen: partial.variantsSeen || 0,
        variantsUpserted: partial.variantsUpserted || 0,
        errorMessage: error.message
      });
    }
  }

  async listSupplierProducts(query: CommerceProductQuery = {}) {
    return Array.from(this.products.values()).filter((product) => {
      if (query.supplierKey && product.supplierKey !== query.supplierKey) {
        return false;
      }
      if (query.search && !product.title.toLowerCase().includes(query.search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }

  async getSupplierProduct(supplierKey: CommerceSupplierKey, supplierProductId: string) {
    return this.products.get(productKey(supplierKey, supplierProductId)) || null;
  }

  async upsertPublishedProduct(input: CommercePublicationInput) {
    const key = productKey(input.supplierKey, input.supplierProductId);
    const publication = { ...this.publications.get(key), ...input, id: this.publications.get(key)?.id || `pub-${this.publications.size + 1}` };
    this.publications.set(key, publication);
    return publication;
  }

  async publishProduct(supplierKey: CommerceSupplierKey, supplierProductId: string) {
    const key = productKey(supplierKey, supplierProductId);
    const current = this.publications.get(key);
    const publication = current || await this.upsertPublishedProduct({ supplierKey, supplierProductId, markupType: "percentage", markupValue: 60, isPublished: false });
    publication.isPublished = true;
    this.publications.set(key, publication);
    return publication;
  }

  async unpublishProduct(supplierKey: CommerceSupplierKey, supplierProductId: string) {
    const key = productKey(supplierKey, supplierProductId);
    const current = this.publications.get(key);
    const publication = current || await this.upsertPublishedProduct({ supplierKey, supplierProductId, markupType: "percentage", markupValue: 60, isPublished: false });
    publication.isPublished = false;
    this.publications.set(key, publication);
    return publication;
  }

  async listPublishedProducts() {
    return Array.from(this.publications.values()).flatMap((publication) => {
      const product = this.products.get(productKey(publication.supplierKey, publication.supplierProductId));
      return product ? [{ product, publication }] : [];
    });
  }

  async listStorefrontProducts() {
    const serializer = new StorefrontSerializer();
    const pairs = await this.listPublishedProducts();
    return pairs.flatMap(({ product, publication }) => serializer.serialize(product, publication));
  }
}

