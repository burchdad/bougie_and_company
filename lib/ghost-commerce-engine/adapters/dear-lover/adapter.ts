import type {
  CommerceProductSearchRequest,
  CommerceProductSearchResult,
  CommerceSupplierAdapter,
  CommerceSyncRequest,
  CommerceSyncResult
} from "../../core/types";
import { normalizeDearLoverProduct, normalizeDearLoverVariants } from "./normalizer";
import { DearLoverTransport } from "./transport";
import { dearLoverCapabilities, dearLoverSupplierKey, type DearLoverConfig } from "./types";

export function createDearLoverAdapter(config: DearLoverConfig): CommerceSupplierAdapter {
  const transport = new DearLoverTransport(config);

  return {
    key: dearLoverSupplierKey,
    displayName: "Dear-Lover",
    capabilities: dearLoverCapabilities,

    async testConnection() {
      await transport.searchProducts({ page: 1, pageSize: 1 });
      return { ok: true, supplierKey: dearLoverSupplierKey };
    },

    async searchProducts(request: CommerceProductSearchRequest): Promise<CommerceProductSearchResult> {
      const raw = await transport.searchProducts(request);
      const data = raw.data || {};
      const list = Array.isArray(data.list) ? data.list : [];
      const products = list.map((item) => normalizeDearLoverProduct(item));
      const page = Number(data.page || request.page || 1);
      const pageSize = Number(data.psize || request.pageSize || 30);
      const total = Number(data.total || products.length);
      const totalPages = Number(data.total_page || Math.ceil(total / pageSize) || 1);

      return {
        products,
        page,
        pageSize,
        total,
        totalPages,
        hasMore: Boolean(data.has_more) || page < totalPages,
        raw
      };
    },

    async syncCatalog(request: CommerceSyncRequest): Promise<CommerceSyncResult> {
      const pages = Math.max(1, Math.min(20, Math.trunc(Number(request.pages || 1))));
      const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(request.pageSize || 30))));
      let productsSeen = 0;
      let variantsSeen = 0;

      for (let page = 1; page <= pages; page += 1) {
        const result = await this.searchProducts({ ...request, page, pageSize });
        productsSeen += result.products.length;
        variantsSeen += result.products.reduce((sum, product) => sum + product.variants.length, 0);
        if (!result.hasMore) {
          break;
        }
      }

      return {
        supplierKey: dearLoverSupplierKey,
        status: "success",
        productsSeen,
        productsUpserted: 0,
        variantsSeen,
        variantsUpserted: 0,
        failures: []
      };
    },

    normalizeProduct: normalizeDearLoverProduct,
    normalizeVariants: normalizeDearLoverVariants
  };
}

