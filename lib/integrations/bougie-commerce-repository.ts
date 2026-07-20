import { CommerceError } from "@/lib/ghost-commerce-engine/core/errors";
import type {
  CommerceProduct,
  CommercePublishedProduct,
  CommerceSupplier,
  CommerceSupplierKey,
  CommerceSyncRequest,
  CommerceSyncResult,
  CommerceSyncRun,
  CommerceVariant
} from "@/lib/ghost-commerce-engine/core/types";
import type { CommerceProductQuery, CommercePublicationInput, CommerceRepository } from "@/lib/ghost-commerce-engine/persistence/types";
import {
  ensureDropshippingTables,
  getPublishedDropshipStoreProducts,
  importDropshipProduct,
  listSuppliers,
  updateDropshipPublication
} from "@/lib/dropshipping/db";

function unsupported(method: string): never {
  throw new CommerceError("COMMERCE_REPOSITORY_ERROR", `BougieCommerceRepository.${method} is not wired yet. Use existing Bougie dropshipping database helpers for this app path.`);
}

export class BougieCommerceRepository implements CommerceRepository {
  async ensureStorage() {
    await ensureDropshippingTables();
  }

  async upsertSupplier(_supplier: CommerceSupplier) {
    unsupported("upsertSupplier");
  }

  async listSuppliers(): Promise<CommerceSupplier[]> {
    const rows = await listSuppliers();
    return rows.map((row) => ({
      key: String(row.key),
      displayName: String(row.name || row.key),
      baseUrl: row.base_url ? String(row.base_url) : null,
      isActive: Boolean(row.is_active),
      capabilities: {
        catalogSearch: true,
        catalogSync: true,
        inventorySync: true,
        orderSubmission: false,
        orderStatus: false,
        tracking: false
      }
    }));
  }

  async upsertProduct(_product: CommerceProduct) {
    unsupported("upsertProduct");
  }

  async upsertVariants(_product: CommerceProduct, _variants: CommerceVariant[]) {
    unsupported("upsertVariants");
  }

  async createSyncRun(request: CommerceSyncRequest): Promise<CommerceSyncRun> {
    return {
      id: "bougie-legacy-sync",
      supplierKey: request.supplierKey || "dear-lover",
      status: "running",
      startedAt: new Date().toISOString(),
      productsSeen: 0,
      productsUpserted: 0,
      variantsSeen: 0,
      variantsUpserted: 0,
      metadata: request.metadata
    };
  }

  async completeSyncRun(_syncRunId: string | number, _result: CommerceSyncResult) {}

  async failSyncRun(_syncRunId: string | number, error: Error) {
    throw new CommerceError("COMMERCE_REPOSITORY_ERROR", error.message, { cause: error });
  }

  async listSupplierProducts(_query: CommerceProductQuery = {}): Promise<CommerceProduct[]> {
    unsupported("listSupplierProducts");
  }

  async getSupplierProduct(_supplierKey: CommerceSupplierKey, _supplierProductId: string): Promise<CommerceProduct | null> {
    unsupported("getSupplierProduct");
  }

  async upsertPublishedProduct(input: CommercePublicationInput): Promise<CommercePublishedProduct> {
    const row = await importDropshipProduct({
      supplierKey: input.supplierKey,
      supplierProductId: input.supplierProductId,
      markupType: input.markupType,
      markupValue: input.markupValue,
      priceOverride: input.priceOverride,
      collection: input.collection,
      publish: input.isPublished
    });

    return { ...input, id: String(row.id) };
  }

  async publishProduct(_supplierKey: CommerceSupplierKey, _supplierProductId: string): Promise<CommercePublishedProduct> {
    unsupported("publishProduct");
  }

  async unpublishProduct(_supplierKey: CommerceSupplierKey, _supplierProductId: string): Promise<CommercePublishedProduct> {
    unsupported("unpublishProduct");
  }

  async updatePublication(id: string, input: Partial<CommercePublishedProduct>) {
    return updateDropshipPublication(id, {
      titleOverride: input.titleOverride,
      descriptionOverride: input.descriptionOverride,
      markupType: input.markupType,
      markupValue: input.markupValue,
      priceOverride: input.priceOverride,
      collection: input.collection,
      isPublished: input.isPublished,
      seoTitle: input.seoTitle,
      seoDescription: input.seoDescription
    });
  }

  async listPublishedProducts(): Promise<Array<{ product: CommerceProduct; publication: CommercePublishedProduct }>> {
    unsupported("listPublishedProducts");
  }

  async listStorefrontProducts() {
    const rows = await getPublishedDropshipStoreProducts();
    return rows.map((row) => ({
      id: String(row.epos_product_id),
      name: String(row.name),
      description: row.description ? String(row.description) : null,
      sku: row.sku ? String(row.sku) : null,
      barcode: row.barcode ? String(row.barcode) : null,
      salePrice: String(row.sale_price),
      stock: String(row.stock),
      marketingTitle: String(row.marketing_title),
      marketingDescription: row.marketing_description ? String(row.marketing_description) : null,
      department: String(row.department),
      categorySlugs: Array.isArray(row.category_slugs) ? row.category_slugs.map(String) : [],
      primaryImageUrl: row.primary_image_url ? String(row.primary_image_url) : null,
      primaryImageAlt: String(row.primary_image_alt),
      isDropship: true as const,
      supplierKey: String(row.supplier_key),
      supplierProductId: String(row.supplier_product_id),
      supplierVariantId: String(row.supplier_variant_id),
      variantLabel: row.dropship_variant_label ? String(row.dropship_variant_label) : null,
      warehouseType: row.dropship_warehouse_type ? String(row.dropship_warehouse_type) : null
    }));
  }
}

