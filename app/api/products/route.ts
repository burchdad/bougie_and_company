import { getAdminProducts } from "@/lib/admin-products";
import { isDropshippingEnabled } from "@/lib/dropshipping/config";
import { getPublishedDropshipStoreProductPage } from "@/lib/dropshipping/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductRow = {
  epos_product_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  sale_price: string | null;
  stock: string | null;
  storefront_stock_override: string | null;
  synced_at: string;
  marketing_title: string | null;
  marketing_description: string | null;
  department: string | null;
  category_ids: number[];
  category_slugs: string[];
  has_explicit_categories: boolean;
  is_featured: boolean | null;
  is_hidden: boolean | null;
  primary_image_url: string | null;
  primary_image_alt: string | null;
};

function getDisplayStock(product: ProductRow) {
  const eposStock = Number(product.stock || 0);
  const storefrontOverride = Number(product.storefront_stock_override || 0);
  return eposStock > 0 ? eposStock : storefrontOverride;
}

function booleanParam(value: string | null, fallback: boolean) {
  if (value === null) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function numberParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";
    const includeNative = booleanParam(searchParams.get("includeNative"), true);
    const includeDropship = booleanParam(searchParams.get("includeDropship"), true);
    const requestedLimit = Number(searchParams.get("limit") || 1000);
    const rows = includeNative ? await getAdminProducts(query, Number.isFinite(requestedLimit) ? requestedLimit : 1000) as ProductRow[] : [];
    let dropshipProducts: Awaited<ReturnType<typeof getPublishedDropshipStoreProductPage>>["products"] = [];
    let dropshipPagination: Awaited<ReturnType<typeof getPublishedDropshipStoreProductPage>>["pagination"] | null = null;

    if (includeDropship && isDropshippingEnabled()) {
      try {
        const dropshipPage = await getPublishedDropshipStoreProductPage({
          limit: numberParam(searchParams.get("dropshipLimit"), 48, 1, 96),
          offset: numberParam(searchParams.get("dropshipOffset"), 0, 0, 100000),
          search: query,
          collection: searchParams.get("dropshipCollection")?.trim() || ""
        });
        dropshipProducts = dropshipPage.products;
        dropshipPagination = dropshipPage.pagination;
      } catch (error) {
        console.error(error instanceof Error ? `Dropship products unavailable: ${error.message}` : "Dropship products unavailable.");
      }
    }
    const products = rows
      .filter((product) => !product.is_hidden)
      .map((product) => ({
        ...product,
        stock: String(getDisplayStock(product))
      }));

    return Response.json({
      ok: true,
      products: [...products, ...dropshipProducts],
      meta: {
        dropship: dropshipPagination
      }
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product catalog is not available yet.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
