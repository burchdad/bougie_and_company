import { isAdminRequest } from "@/lib/admin-products";
import { syncSupplierProducts } from "@/lib/dropshipping/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({})) as {
      supplierKey?: string;
      pages?: number;
      pageSize?: number;
      sort?: string;
      filters?: string;
      keywords?: string;
    };
    const supplierKey = body.supplierKey || "dear-lover";
    const result = await syncSupplierProducts(supplierKey, {
      pages: body.pages || 1,
      pageSize: body.pageSize || 30,
      sort: body.sort || "",
      filters: body.filters || "",
      keywords: body.keywords || ""
    });

    return Response.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dropship sync failed.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
