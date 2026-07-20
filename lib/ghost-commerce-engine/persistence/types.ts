import type {
  CommerceInventoryRecord,
  CommerceProduct,
  CommercePublishedProduct,
  CommerceStorefrontProduct,
  CommerceSupplier,
  CommerceSupplierKey,
  CommerceSyncRequest,
  CommerceSyncResult,
  CommerceSyncRun,
  CommerceVariant
} from "../core/types";

export type CommerceProductQuery = {
  supplierKey?: CommerceSupplierKey;
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  published?: boolean | null;
  inStock?: boolean | null;
};

export type CommercePublicationInput = Omit<CommercePublishedProduct, "id">;

export interface CommerceRepository {
  ensureStorage?(): Promise<void>;
  upsertSupplier(supplier: CommerceSupplier): Promise<void>;
  listSuppliers(): Promise<CommerceSupplier[]>;
  upsertProduct(product: CommerceProduct): Promise<void>;
  upsertVariants(product: CommerceProduct, variants: CommerceVariant[]): Promise<void>;
  upsertInventory?(records: CommerceInventoryRecord[]): Promise<void>;
  createSyncRun(request: CommerceSyncRequest): Promise<CommerceSyncRun>;
  completeSyncRun(syncRunId: string | number, result: CommerceSyncResult): Promise<void>;
  failSyncRun(syncRunId: string | number, error: Error, partial?: Partial<CommerceSyncResult>): Promise<void>;
  listSupplierProducts(query?: CommerceProductQuery): Promise<CommerceProduct[]>;
  getSupplierProduct(supplierKey: CommerceSupplierKey, supplierProductId: string): Promise<CommerceProduct | null>;
  upsertPublishedProduct(input: CommercePublicationInput): Promise<CommercePublishedProduct>;
  publishProduct(supplierKey: CommerceSupplierKey, supplierProductId: string): Promise<CommercePublishedProduct>;
  unpublishProduct(supplierKey: CommerceSupplierKey, supplierProductId: string): Promise<CommercePublishedProduct>;
  listPublishedProducts(): Promise<Array<{ product: CommerceProduct; publication: CommercePublishedProduct }>>;
  listStorefrontProducts?(): Promise<CommerceStorefrontProduct[]>;
}

