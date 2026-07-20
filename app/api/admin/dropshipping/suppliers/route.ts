import { isAdminRequest } from "@/lib/admin-products";
import { isDropshippingEnabled } from "@/lib/dropshipping/config";
import { listSuppliers } from "@/lib/dropshipping/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }
  if (!isDropshippingEnabled()) {
    return Response.json({ ok: false, message: "Dropshipping is disabled." }, { status: 404 });
  }

  try {
    const suppliers = await listSuppliers();
    return Response.json({ ok: true, suppliers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load dropship suppliers.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
