import { toCommerceError } from "../core/errors";
import type { CommerceSupplierAdapter, CommerceSyncRequest, CommerceSyncResult } from "../core/types";
import type { CommerceLogger } from "../observability/logger";
import { noopCommerceLogger } from "../observability/logger";
import type { CommerceRepository } from "../persistence/types";

export class CatalogSyncService {
  private adapter: CommerceSupplierAdapter;
  private repository: CommerceRepository;
  private logger: CommerceLogger;

  constructor(input: { adapter: CommerceSupplierAdapter; repository: CommerceRepository; logger?: CommerceLogger }) {
    this.adapter = input.adapter;
    this.repository = input.repository;
    this.logger = input.logger || noopCommerceLogger;
  }

  async sync(request: CommerceSyncRequest = {}): Promise<CommerceSyncResult> {
    await this.repository.ensureStorage?.();
    const supplierKey = request.supplierKey || this.adapter.key;
    const syncRun = await this.repository.createSyncRun({ ...request, supplierKey });
    const pages = Math.max(1, Math.min(20, Math.trunc(Number(request.pages || 1))));
    const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(request.pageSize || 30))));
    let productsSeen = 0;
    let productsUpserted = 0;
    let variantsSeen = 0;
    let variantsUpserted = 0;
    const failures: string[] = [];

    this.logger.info("Commerce catalog sync started.", { supplierKey, syncRunId: syncRun.id });

    try {
      for (let page = 1; page <= pages; page += 1) {
        const result = await this.adapter.searchProducts({ ...request, page, pageSize });
        productsSeen += result.products.length;

        for (const product of result.products) {
          variantsSeen += product.variants.length;
          try {
            await this.repository.upsertProduct(product);
            await this.repository.upsertVariants(product, product.variants);
            productsUpserted += 1;
            variantsUpserted += product.variants.length;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            failures.push(`${product.supplierProductId}: ${message}`);
            this.logger.warn("Commerce product sync failed.", { supplierKey, supplierProductId: product.supplierProductId, message });
          }
        }

        if (!result.hasMore) {
          break;
        }
      }

      const output: CommerceSyncResult = {
        supplierKey,
        syncRunId: syncRun.id,
        status: failures.length ? "partial" : "success",
        productsSeen,
        productsUpserted,
        variantsSeen,
        variantsUpserted,
        failures
      };
      await this.repository.completeSyncRun(syncRun.id, output);
      this.logger.info("Commerce catalog sync completed.", { supplierKey, syncRunId: syncRun.id, status: output.status });
      return output;
    } catch (error) {
      const commerceError = toCommerceError(error, "COMMERCE_SYNC_FAILED");
      await this.repository.failSyncRun(syncRun.id, commerceError, {
        supplierKey,
        status: "failed",
        productsSeen,
        productsUpserted,
        variantsSeen,
        variantsUpserted,
        failures
      });
      this.logger.error("Commerce catalog sync failed.", { supplierKey, syncRunId: syncRun.id, code: commerceError.code, message: commerceError.message });
      throw commerceError;
    }
  }
}

