export type CommerceSupplierKey = string;

export type CommerceMarkupType = "percentage" | "fixed" | "manual";

export type CommerceSupplierCapabilities = {
  catalogSearch: boolean;
  catalogSync: boolean;
  inventorySync: boolean;
  orderSubmission: boolean;
  orderStatus: boolean;
  tracking: boolean;
};

export type CommerceSupplier = {
  key: CommerceSupplierKey;
  displayName: string;
  baseUrl?: string | null;
  isActive: boolean;
  capabilities: CommerceSupplierCapabilities;
};

export type CommerceImage = {
  url: string;
  altText?: string | null;
  sortOrder?: number;
  raw?: unknown;
};

export type CommerceCategory = {
  name: string;
  raw?: unknown;
};

export type CommerceInventoryRecord = {
  supplierKey: CommerceSupplierKey;
  supplierProductId: string;
  supplierVariantId?: string | null;
  sku?: string | null;
  quantity: number;
  isInStock: boolean;
  warehouseType?: string | null;
  syncedAt?: string | null;
};

export type CommerceVariant = {
  supplierKey: CommerceSupplierKey;
  supplierVariantId: string;
  supplierProductId: string;
  sku: string | null;
  barcode: string | null;
  title: string | null;
  sizeName: string | null;
  color: string | null;
  size: string | null;
  price: number | null;
  weight: number | null;
  inventoryQuantity: number;
  isInStock: boolean;
  raw?: unknown;
};

export type CommerceProduct = {
  supplierKey: CommerceSupplierKey;
  supplierProductId: string;
  supplierSku: string | null;
  title: string;
  description: string | null;
  categoryNames: string[];
  imageUrl: string | null;
  secondImageUrl: string | null;
  wholesalePrice: number | null;
  originalPrice: number | null;
  suggestedRetailPrice: number | null;
  shippingCost: number | null;
  currency: string | null;
  warehouseType: string | null;
  totalInventory: number;
  routeUrl: string | null;
  images: CommerceImage[];
  categories: CommerceCategory[];
  variants: CommerceVariant[];
  raw?: unknown;
};

export type CommercePublishedProduct = {
  id?: string;
  supplierKey: CommerceSupplierKey;
  supplierProductId: string;
  titleOverride?: string | null;
  descriptionOverride?: string | null;
  priceOverride?: number | null;
  markupType: CommerceMarkupType;
  markupValue: number | null;
  isPublished: boolean;
  collection?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type CommercePriceInput = {
  wholesalePrice?: number | null;
  shippingCost?: number | null;
  suggestedRetailPrice?: number | null;
  markupType?: CommerceMarkupType | null;
  markupValue?: number | null;
  priceOverride?: number | null;
};

export type CommercePriceResult = {
  retailPrice: number;
  floorPrice: number;
  rounded: boolean;
  source: "override" | "percentage" | "fixed" | "suggested" | "floor";
};

export type CommerceProductSearchRequest = {
  page?: number;
  pageSize?: number;
  sort?: string;
  filters?: string;
  keywords?: string;
};

export type CommerceProductSearchResult = {
  products: CommerceProduct[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  raw?: unknown;
};

export type CommerceProductDetail = CommerceProduct;

export type CommerceSyncRequest = {
  supplierKey?: CommerceSupplierKey;
  pages?: number;
  pageSize?: number;
  sort?: string;
  filters?: string;
  keywords?: string;
  metadata?: Record<string, unknown>;
};

export type CommerceSyncStatus = "running" | "success" | "partial" | "failed";

export type CommerceSyncResult = {
  supplierKey: CommerceSupplierKey;
  syncRunId?: string | number;
  status: CommerceSyncStatus;
  productsSeen: number;
  productsUpserted: number;
  variantsSeen: number;
  variantsUpserted: number;
  failures: string[];
  raw?: unknown;
};

export type CommerceSyncRun = {
  id: string | number;
  supplierKey: CommerceSupplierKey;
  status: CommerceSyncStatus;
  startedAt: string;
  finishedAt?: string | null;
  productsSeen: number;
  productsUpserted: number;
  variantsSeen: number;
  variantsUpserted: number;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
};

export type CommerceStorefrontProduct = {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  salePrice: string;
  stock: string;
  marketingTitle: string;
  marketingDescription: string | null;
  department: string;
  categorySlugs: string[];
  primaryImageUrl: string | null;
  primaryImageAlt: string;
  isDropship: true;
  supplierKey: CommerceSupplierKey;
  supplierProductId: string;
  supplierVariantId: string;
  variantLabel: string | null;
  warehouseType: string | null;
};

export type ConnectionResult = {
  ok: boolean;
  supplierKey: CommerceSupplierKey;
  message?: string;
};

export interface CommerceSupplierAdapter {
  key: CommerceSupplierKey;
  displayName: string;
  capabilities: CommerceSupplierCapabilities;
  testConnection(): Promise<ConnectionResult>;
  searchProducts(request: CommerceProductSearchRequest): Promise<CommerceProductSearchResult>;
  getProduct?(supplierProductId: string): Promise<CommerceProductDetail>;
  syncCatalog(request: CommerceSyncRequest): Promise<CommerceSyncResult>;
  normalizeProduct(raw: unknown): CommerceProduct;
  normalizeVariants(raw: unknown): CommerceVariant[];
}

export type CommerceOrderStatus = "draft" | "submitted" | "accepted" | "processing" | "shipped" | "delivered" | "cancelled" | "failed";

export type CommerceAddress = {
  name: string;
  company?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone?: string | null;
};

export type CommerceOrderItem = {
  supplierKey: CommerceSupplierKey;
  supplierProductId: string;
  supplierVariantId: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
};

export type CommerceOrder = {
  id: string;
  status: CommerceOrderStatus;
  items: CommerceOrderItem[];
  shipTo: CommerceAddress;
  createdAt: string;
};

export type CommerceFulfillment = {
  supplierKey: CommerceSupplierKey;
  supplierOrderId?: string | null;
  status: CommerceOrderStatus;
  trackingNumbers: string[];
  updatedAt: string;
};

export type CommerceTrackingEvent = {
  trackingNumber: string;
  carrier?: string | null;
  status: string;
  occurredAt: string;
  location?: string | null;
  message?: string | null;
};

export type CommerceOrderSubmissionResult = {
  ok: boolean;
  supplierKey: CommerceSupplierKey;
  supplierOrderId?: string | null;
  message?: string;
};

export interface CommerceOrderCapableAdapter {
  submitOrder(order: CommerceOrder): Promise<CommerceOrderSubmissionResult>;
  getOrderStatus(supplierOrderId: string): Promise<CommerceFulfillment>;
  getTracking(supplierOrderId: string): Promise<CommerceTrackingEvent[]>;
}

