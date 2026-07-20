import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { CatalogSyncService } from "../lib/ghost-commerce-engine/catalog";
import { createDearLoverAdapter, normalizeDearLoverProduct } from "../lib/ghost-commerce-engine/adapters";
import { CommerceError } from "../lib/ghost-commerce-engine/core";
import { ghostCommerceEngineMetadata } from "../lib/ghost-commerce-engine/core/metadata";
import { PricingService } from "../lib/ghost-commerce-engine/pricing";
import { PublishingService, StorefrontSerializer } from "../lib/ghost-commerce-engine/publishing";
import { commerceProductFactory, FixtureCommerceAdapter, InMemoryCommerceRepository } from "../lib/ghost-commerce-engine/testing";
import { isDropshippingEnabled, isDropshippingFixtureEnabled } from "../lib/dropshipping/config";
import { calculateDropshipRetailPrice } from "../lib/dropshipping/pricing";
import { dearLoverAdapter } from "../lib/dropshipping/suppliers/dear-lover";

async function withEnv<T>(values: Record<string, string | undefined>, fn: () => T | Promise<T>) {
  const previous = new Map<string, string | undefined>();
  Object.keys(values).forEach((key) => {
    previous.set(key, process.env[key]);
    const value = values[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });

  try {
    return await fn();
  } finally {
    previous.forEach((value, key) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}

test("calculateDropshipRetailPrice handles percentage markup and .99 rounding", () => {
  const retail = calculateDropshipRetailPrice({
    wholesalePrice: 12.29,
    shippingCost: 10.3,
    markupType: "percentage",
    markupValue: 50
  });

  assert.equal(retail, 33.99);
});

test("calculateDropshipRetailPrice handles fixed markup and manual override floor", () => {
  assert.equal(calculateDropshipRetailPrice({ wholesalePrice: 12.29, shippingCost: 10.3, markupType: "fixed", markupValue: 8 }), 30.99);
  assert.equal(calculateDropshipRetailPrice({ wholesalePrice: 12.29, shippingCost: 10.3, priceOverride: 15 }), 22.99);
});

test("calculateDropshipRetailPrice safely normalizes invalid or negative markup", () => {
  assert.equal(calculateDropshipRetailPrice({ wholesalePrice: 12.29, shippingCost: 10.3, markupType: "fixed", markupValue: -50 }), 22.99);
  assert.equal(calculateDropshipRetailPrice({ wholesalePrice: 12.29, shippingCost: 10.3, markupType: "percentage", markupValue: Number.NaN }), 22.99);
});

test("feature flags default off and fixture is never enabled in production", async () => {
  await withEnv({ DROPSHIPPING_ENABLED: undefined, DROPSHIPPING_USE_FIXTURE: "true", VERCEL_ENV: "production" }, () => {
    assert.equal(isDropshippingEnabled(), false);
    assert.equal(isDropshippingFixtureEnabled(), false);
  });

  await withEnv({ DROPSHIPPING_ENABLED: "true", DROPSHIPPING_USE_FIXTURE: "true", VERCEL_ENV: "preview" }, () => {
    assert.equal(isDropshippingEnabled(), true);
    assert.equal(isDropshippingFixtureEnabled(), true);
  });
});

test("Dear-Lover fixture uses the adapter normalizer and sanitized test records", async () => {
  await withEnv({ DROPSHIPPING_USE_FIXTURE: "true", VERCEL_ENV: "preview", DROPSHIPPING_FIXTURE_STOCK_REVISION: "1" }, async () => {
    const result = await dearLoverAdapter.searchProducts({ page: 1, pageSize: 2 });
    assert.equal(result.products.length, 2);
    assert.equal(result.products[0].supplierKey, "dear-lover");
    assert.equal(result.products[0].supplierProductId, "900001");
    assert.equal(result.products[0].warehouseType, "fixture");
    assert.match(result.products[0].title, /^\[Fixture\]/);
    assert.equal(result.products[0].variants.length, 2);
    assert.equal(result.products[0].variants[0].color, "Rose");
    assert.equal(result.products[0].variants[0].size, "Small");
    assert.equal(result.products[1].variants[0].inventoryQuantity, 0);
  });
});

test("Dear-Lover fixture can simulate inventory updates for upsert validation", async () => {
  await withEnv({ DROPSHIPPING_USE_FIXTURE: "true", VERCEL_ENV: "preview", DROPSHIPPING_FIXTURE_STOCK_REVISION: "2" }, async () => {
    const result = await dearLoverAdapter.searchProducts({ page: 1, pageSize: 2 });
    const first = result.products[0];
    assert.equal(first.totalInventory, 7);
    assert.equal(first.variants[0].inventoryQuantity, 7);
    assert.equal(first.variants[1].inventoryQuantity, 0);
    assert.equal(first.variants[1].isInStock, false);
  });
});

test("Dear-Lover unauthenticated HTML responses fail safely", async () => {
  await withEnv({ DROPSHIPPING_USE_FIXTURE: "false", VERCEL_ENV: "preview", DEAR_LOVER_AUTH_COOKIE: undefined }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("<html>login</html>", { status: 200, headers: { "content-type": "text/html" } });

    try {
      await assert.rejects(
        () => dearLoverAdapter.searchProducts({ page: 1, pageSize: 1 }),
        /SUPPLIER_AUTHENTICATION_REQUIRED/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("Dear-Lover parses JSON bodies even when content type is text/html", async () => {
  await withEnv({ DROPSHIPPING_USE_FIXTURE: "false", VERCEL_ENV: "preview", DEAR_LOVER_AUTH_COOKIE: "session=test" }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      status: true,
      msg: "success",
      data: {
        page: 1,
        psize: 1,
        total: 1,
        total_page: 1,
        has_more: false,
        list: [
          {
            codeno: "LIVE-001",
            id: 1001,
            title: "Live Supplier Dress",
            image_src: "https://us01-imgcdn.dear-lover.com/test.jpg",
            sale_price: "19.50",
            suggest_price: "49.00",
            shipping_cost: "7.25",
            category_names: "Dresses",
            inventory_quantity: 3,
            variants: [{ id: 2001, codeno: "LIVE-001-S", inventory_quantity: 3, is_instock: 1, color_size: { color: "Black", size: "Small" } }]
          }
        ]
      }
    }), { status: 200, headers: { "content-type": "text/html; charset=UTF-8" } });

    try {
      const result = await dearLoverAdapter.searchProducts({ page: 1, pageSize: 1 });
      assert.equal(result.products.length, 1);
      assert.equal(result.products[0].supplierProductId, "1001");
      assert.equal(result.products[0].variants[0].isInStock, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("public dropship serialization excludes raw supplier/private pricing fields", async () => {
  await withEnv({ DROPSHIPPING_USE_FIXTURE: "true", VERCEL_ENV: "preview" }, async () => {
    const result = await dearLoverAdapter.searchProducts({ page: 1, pageSize: 2 });
    const product = result.products[0];
    const publicProduct = {
      epos_product_id: `dropship:${product.supplierKey}:${product.variants[0].supplierVariantId}`,
      name: product.title,
      sale_price: "33.99",
      stock: String(product.variants[0].inventoryQuantity),
      primary_image_url: product.imageUrl,
      is_dropship: true,
      supplier_key: product.supplierKey,
      supplier_product_id: product.supplierProductId,
      supplier_variant_id: product.variants[0].supplierVariantId,
      dropship_variant_label: [product.variants[0].color, product.variants[0].size].filter(Boolean).join(" / ")
    };
    const serialized = JSON.stringify(publicProduct);

    assert.equal(serialized.includes("raw"), false);
    assert.equal(serialized.includes("wholesale"), false);
    assert.equal(serialized.includes("shippingCost"), false);
    assert.equal(serialized.includes("cookie"), false);
  });
});

test("Ghost Commerce Engine pricing service preserves existing retail pricing behavior", () => {
  const service = new PricingService();
  const result = service.calculate({
    wholesalePrice: 12.29,
    shippingCost: 10.3,
    markupType: "percentage",
    markupValue: 50
  });

  assert.equal(result.retailPrice, calculateDropshipRetailPrice({ wholesalePrice: 12.29, shippingCost: 10.3, markupType: "percentage", markupValue: 50 }));
  assert.equal(result.source, "percentage");
});

test("Ghost Commerce Engine fixture adapter satisfies supplier contract and exposes capabilities", async () => {
  const adapter = new FixtureCommerceAdapter();
  const connection = await adapter.testConnection();
  const result = await adapter.searchProducts({ page: 1, pageSize: 1 });

  assert.equal(connection.ok, true);
  assert.equal(adapter.capabilities.catalogSync, true);
  assert.equal(adapter.capabilities.orderSubmission, false);
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0].supplierKey, "fixture");
});

test("Dear-Lover engine normalizer keeps supplier fields inside generic commerce product model", () => {
  const product = normalizeDearLoverProduct({
    codeno: "DL-001",
    id: 1001,
    title: "Dear Lover Dress",
    image_src: "http://example.test/dress.jpg",
    sale_price: "19.50",
    suggest_price: "49.00",
    shipping_cost: "7.25",
    category_names: "Dresses, Women Clothing",
    inventory_quantity: 3,
    variants: [{ id: 2001, codeno: "DL-001-S", inventory_quantity: 3, is_instock: 1, color_size: { color: "Black", size: "Small" } }]
  });

  assert.equal(product.supplierKey, "dear-lover");
  assert.equal(product.imageUrl, "https://example.test/dress.jpg");
  assert.deepEqual(product.categoryNames, ["Dresses", "Women Clothing"]);
  assert.equal(product.variants[0].isInStock, true);
  assert.equal("dearLoverProductId" in product, false);
});

test("Dear-Lover engine transport maps login HTML to typed commerce authentication error", async () => {
  const adapter = createDearLoverAdapter({
    baseUrl: "https://ds.dear-lover.test",
    fetchImpl: async () => new Response("<html>login</html>", { status: 200, headers: { "content-type": "text/html" } })
  });

  await assert.rejects(
    () => adapter.searchProducts({ page: 1, pageSize: 1 }),
    (error) => error instanceof CommerceError && error.code === "COMMERCE_AUTHENTICATION_REQUIRED"
  );
});

test("CatalogSyncService upserts repeatedly without duplicating products or variants", async () => {
  const product = commerceProductFactory();
  const adapter = new FixtureCommerceAdapter([product]);
  const repository = new InMemoryCommerceRepository();
  const service = new CatalogSyncService({ adapter, repository });

  const first = await service.sync({ pages: 1, pageSize: 1 });
  const second = await service.sync({ pages: 1, pageSize: 1 });

  assert.equal(first.status, "success");
  assert.equal(second.status, "success");
  assert.equal(repository.products.size, 1);
  assert.equal((await repository.getSupplierProduct("fixture", "product-1"))?.variants.length, 1);
  assert.equal(repository.syncRuns.size, 2);
});

test("PublishingService imports, publishes, unpublishes, and storefront serialization stays public-safe", async () => {
  const repository = new InMemoryCommerceRepository();
  const product = commerceProductFactory();
  await repository.upsertProduct(product);
  await repository.upsertVariants(product, product.variants);

  const publishing = new PublishingService(repository);
  const imported = await publishing.importSupplierProduct({
    supplierKey: product.supplierKey,
    supplierProductId: product.supplierProductId,
    markupType: "percentage",
    markupValue: 60,
    collection: "dropshipping",
    publish: true
  });
  const storefront = new StorefrontSerializer().serialize(product, imported);

  assert.equal(imported.isPublished, true);
  assert.equal(storefront.length, 1);
  assert.equal(storefront[0].salePrice, "36.99");
  assert.equal(JSON.stringify(storefront).includes("wholesale"), false);
  assert.equal(JSON.stringify(storefront).includes("raw"), false);

  const unpublished = await publishing.unpublishProduct(product.supplierKey, product.supplierProductId);
  assert.equal(unpublished.isPublished, false);
});

test("Ghost Commerce Engine metadata advertises v0.2 alpha and non-checkout supplier capability", () => {
  assert.equal(ghostCommerceEngineMetadata.version, "0.2.0-alpha");
  assert.deepEqual(ghostCommerceEngineMetadata.supportedSupplierKeys, ["dear-lover"]);
  assert.equal(ghostCommerceEngineMetadata.adapterCapabilities["dear-lover"].orderSubmission, false);
});

test("Ghost Commerce Engine core files do not import Bougie app, components, or Next route layers", () => {
  const root = join(process.cwd(), "lib", "ghost-commerce-engine");
  const banned = [
    "@/app",
    "@/components",
    "@/lib/integrations",
    "next/",
    "next/server",
    "../../dropshipping",
    "../dropshipping"
  ];
  const files: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
      } else if (fullPath.endsWith(".ts")) {
        files.push(fullPath);
      }
    }
  }

  walk(root);

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const pattern of banned) {
      assert.equal(source.includes(pattern), false, `${file} imports banned pattern ${pattern}`);
    }
  }
});
