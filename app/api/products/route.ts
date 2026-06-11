import { getAdminProducts } from "@/lib/admin-products";

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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";
    const requestedLimit = Number(searchParams.get("limit") || 1000);
    const rows = (await getAdminProducts(query, Number.isFinite(requestedLimit) ? requestedLimit : 1000)) as ProductRow[];
    const products = rows
      .filter((product) => !product.is_hidden)
      .map((product) => ({
        ...product,
        stock: String(getDisplayStock(product))
      }));

    return Response.json({ ok: true, products }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Product catalog is not available yet.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
