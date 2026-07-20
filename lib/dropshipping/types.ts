export type MarkupType = "percentage" | "fixed" | "manual";

export type SupplierSearchParams = {
  page?: number;
  pageSize?: number;
  sort?: string;
  filters?: string;
  keywords?: string;
};

export type SupplierSearchResult = {
  products: NormalizedSupplierProduct[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  raw: unknown;
};

export type SupplierSyncParams = {
  pages?: number;
  pageSize?: number;
  sort?: string;
  filters?: string;
  keywords?: string;
};

export type SupplierSyncResult = {
  supplierKey: string;
  productsSeen: number;
  variantsSeen: number;
  raw?: unknown;
};

export type NormalizedSupplierImage = {
  url: string;
  altText?: string | null;
  sortOrder?: number;
  raw?: unknown;
};

export type NormalizedSupplierCategory = {
  name: string;
  raw?: unknown;
};

export type NormalizedSupplierVariant = {
  supplierKey: string;
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
  raw: unknown;
};

export type NormalizedSupplierProduct = {
  supplierKey: string;
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
  images: NormalizedSupplierImage[];
  categories: NormalizedSupplierCategory[];
  variants: NormalizedSupplierVariant[];
  raw: unknown;
};

export type SupplierProductDetail = NormalizedSupplierProduct;

export interface SupplierAdapter {
  supplierKey: string;
  searchProducts(params: SupplierSearchParams): Promise<SupplierSearchResult>;
  getProduct?(supplierProductId: string): Promise<SupplierProductDetail>;
  syncProducts(params?: SupplierSyncParams): Promise<SupplierSyncResult>;
  normalizeProduct(raw: unknown): NormalizedSupplierProduct;
  normalizeVariant(raw: unknown): NormalizedSupplierVariant[];
}
