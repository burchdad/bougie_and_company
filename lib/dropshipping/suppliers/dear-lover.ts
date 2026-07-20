import type {
  NormalizedSupplierProduct,
  NormalizedSupplierVariant,
  SupplierAdapter,
  SupplierSearchParams,
  SupplierSearchResult,
  SupplierSyncParams,
  SupplierSyncResult
} from "../types";
import { getDearLoverAuthCookie, getDearLoverBaseUrl, isDropshippingFixtureEnabled } from "../config";
import { dearLoverFixtureEnvelope } from "../fixtures/dear-lover";

const supplierKey = "dear-lover";
const searchPath = "/h-dropship-searchProducts.json";
const supplierAuthenticationRequired = "SUPPLIER_AUTHENTICATION_REQUIRED";
const browserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

type DearLoverEnvelope = {
  data?: {
    list?: unknown[];
    page?: number;
    psize?: number;
    total?: number;
    total_page?: number;
    has_more?: boolean | number;
  };
};

function asRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitCategories(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeImageUrl(value: unknown) {
  const raw = asString(value);
  if (!raw) {
    return null;
  }

  return raw.startsWith("http://") ? raw.replace("http://", "https://") : raw;
}

function buildSearchUrl(params: SupplierSearchParams) {
  const url = new URL(searchPath, getDearLoverBaseUrl());
  url.searchParams.set("sort", params.sort || "");
  url.searchParams.set("page", String(params.page || 1));
  url.searchParams.set("psize", String(params.pageSize || 30));
  url.searchParams.set("filters", params.filters || "");
  if (params.keywords) {
    url.searchParams.set("keywords", params.keywords);
  }
  url.searchParams.set("_", String(Date.now()));
  return url;
}

function isLikelyAuthenticationFailure(value: unknown) {
  const record = asRecord(value);
  const status = String(record.status || "").toLowerCase();
  const message = String(record.msg || record.message || record.error || "").toLowerCase();

  return status === "false" || message.includes("login") || message.includes("auth") || message.includes("session") || message.includes("cookie");
}

function supplierAuthError(detail: string) {
  return new Error(`${supplierAuthenticationRequired}: ${detail}`);
}

function parseSupplierJson(text: string): DearLoverEnvelope | null {
  try {
    return JSON.parse(text) as DearLoverEnvelope;
  } catch {
    return null;
  }
}

function nonJsonSupplierError(response: Response, text: string) {
  const contentType = response.headers.get("content-type") || "unknown content type";
  const body = text.slice(0, 500).toLowerCase();

  if (body.includes("login") || body.includes("sign in") || body.includes("password")) {
    return supplierAuthError(`Dear-Lover returned login HTML instead of JSON (HTTP ${response.status}, ${contentType}). Refresh DEAR_LOVER_AUTH_COOKIE.`);
  }

  if (body.includes("cloudflare") || body.includes("cf-browser-verification") || body.includes("enable javascript")) {
    return supplierAuthError(`Dear-Lover returned a browser verification page instead of JSON (HTTP ${response.status}, ${contentType}). The supplier may be blocking server-side sync.`);
  }

  return supplierAuthError(`Dear-Lover returned ${contentType} instead of JSON from the catalog endpoint (HTTP ${response.status}). The supplier session may be missing, expired, or missing required browser cookies.`);
}

export const dearLoverAdapter: SupplierAdapter = {
  supplierKey,

  async searchProducts(params: SupplierSearchParams): Promise<SupplierSearchResult> {
    if (isDropshippingFixtureEnabled()) {
      const raw = dearLoverFixtureEnvelope();
      const data = raw.data;
      const products = data.list.map((item) => this.normalizeProduct(item));

      return {
        products,
        page: data.page,
        pageSize: data.psize,
        total: data.total,
        totalPages: data.total_page,
        hasMore: data.has_more,
        raw
      };
    }

    const authCookie = getDearLoverAuthCookie();
    const url = buildSearchUrl(params);
    const response = await fetch(url, {
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "accept-language": "en-US,en;q=0.9",
        referer: new URL("/h-dropship-publishList.html", getDearLoverBaseUrl()).toString(),
        "user-agent": browserUserAgent,
        "x-requested-with": "XMLHttpRequest",
        ...(authCookie ? { cookie: authCookie } : {})
      },
      cache: "no-store"
    });

    if (response.status === 401 || response.status === 403) {
      throw supplierAuthError(`Dear-Lover returned HTTP ${response.status}. Configure a server-only supplier authentication method or disable sync.`);
    }

    if (!response.ok) {
      throw new Error(`Dear-Lover search failed with HTTP ${response.status}.`);
    }

    const responseText = await response.text();
    const raw = parseSupplierJson(responseText);
    if (!raw) {
      throw nonJsonSupplierError(response, responseText);
    }

    if (isLikelyAuthenticationFailure(raw)) {
      throw supplierAuthError("Dear-Lover rejected the supplier request. Refresh server-side supplier authentication or disable sync.");
    }

    const data = raw.data || {};
    const list = Array.isArray(data.list) ? data.list : [];
    const products = list.map((item) => this.normalizeProduct(item));
    const page = Number(data.page || params.page || 1);
    const pageSize = Number(data.psize || params.pageSize || 30);
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

  async syncProducts(params?: SupplierSyncParams): Promise<SupplierSyncResult> {
    const pages = Math.max(1, Math.min(20, Math.trunc(Number(params?.pages || 1))));
    const pageSize = Math.max(1, Math.min(100, Math.trunc(Number(params?.pageSize || 30))));
    let productsSeen = 0;
    let variantsSeen = 0;

    for (let page = 1; page <= pages; page += 1) {
      const result = await this.searchProducts({ ...params, page, pageSize });
      productsSeen += result.products.length;
      variantsSeen += result.products.reduce((sum, product) => sum + product.variants.length, 0);
      if (!result.hasMore) {
        break;
      }
    }

    return { supplierKey, productsSeen, variantsSeen };
  },

  normalizeProduct(raw: unknown): NormalizedSupplierProduct {
    const product = asRecord(raw);
    const supplierProductId = String(product.id || "");
    const imageUrl = normalizeImageUrl(product.image_src);
    const secondImageUrl = normalizeImageUrl(product.second_image);
    const categoryNames = splitCategories(product.category_names);
    const images = [
      imageUrl ? { url: imageUrl, altText: asString(product.alt_text) || asString(product.title), sortOrder: 0, raw: { source: "image_src" } } : null,
      secondImageUrl ? { url: secondImageUrl, altText: asString(product.alt_text) || asString(product.title), sortOrder: 1, raw: { source: "second_image" } } : null
    ].filter(Boolean) as NonNullable<NormalizedSupplierProduct["images"]>;

    return {
      supplierKey,
      supplierProductId,
      supplierSku: asString(product.codeno),
      title: asString(product.title) || "Untitled dropship product",
      description: null,
      categoryNames,
      imageUrl,
      secondImageUrl,
      wholesalePrice: asNumber(product.sale_price),
      originalPrice: asNumber(product.original_price),
      suggestedRetailPrice: asNumber(product.suggest_price),
      shippingCost: asNumber(product.shipping_cost),
      currency: asString(product.currency),
      warehouseType: asString(product.warehouse_type),
      totalInventory: asNumber(product.inventory_quantity) ?? asNumber(product.total_qty) ?? 0,
      routeUrl: asString(product.route_url),
      images,
      categories: categoryNames.map((name) => ({ name })),
      variants: this.normalizeVariant(raw),
      raw
    };
  },

  normalizeVariant(raw: unknown): NormalizedSupplierVariant[] {
    const product = asRecord(raw);
    const supplierProductId = String(product.id || "");
    const variants = Array.isArray(product.variants) ? product.variants : [];

    return variants.map((item) => {
      const variant = asRecord(item);
      const colorSize = asRecord(variant.color_size);
      const inventoryQuantity = asNumber(variant.inventory_quantity) ?? 0;

      return {
        supplierKey,
        supplierVariantId: String(variant.id || variant.codeno || `${supplierProductId}-${variants.indexOf(item)}`),
        supplierProductId,
        sku: asString(variant.codeno),
        barcode: asString(variant.barcode),
        title: asString(variant.title),
        sizeName: asString(variant.size_name),
        color: asString(colorSize.color),
        size: asString(colorSize.size),
        price: asNumber(variant.price),
        weight: asNumber(variant.weight),
        inventoryQuantity,
        isInStock: Number(variant.is_instock) === 1 && inventoryQuantity > 0,
        raw: item
      };
    });
  }
};
