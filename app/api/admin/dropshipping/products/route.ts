import { isAdminRequest } from "@/lib/admin-products";
import { isDropshippingEnabled } from "@/lib/dropshipping/config";
import { getDropshipProducts } from "@/lib/dropshipping/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function optionalBoolean(value: string | null) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return null;
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }
  if (!isDropshippingEnabled()) {
    return Response.json({ ok: false, message: "Dropshipping is disabled." }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const products = await getDropshipProducts({
      supplierKey: searchParams.get("supplierKey") || "dear-lover",
      search: searchParams.get("search") || searchParams.get("q") || "",
      category: searchParams.get("category") || "",
      page: Number(searchParams.get("page") || 1),
      pageSize: Number(searchParams.get("pageSize") || 30),
      published: optionalBoolean(searchParams.get("published")),
      inStock: optionalBoolean(searchParams.get("inStock"))
    });

    return Response.json({ ok: true, products }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load dropship products.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
