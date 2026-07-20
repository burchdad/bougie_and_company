import { isAdminRequest } from "@/lib/admin-products";
import { isDropshippingEnabled } from "@/lib/dropshipping/config";
import { ensureDropshippingTables } from "@/lib/dropshipping/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }
  if (!isDropshippingEnabled()) {
    return Response.json({ ok: false, message: "Dropshipping is disabled." }, { status: 404 });
  }

  try {
    await ensureDropshippingTables();
    return Response.json({ ok: true, message: "Dropshipping tables are ready." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not initialize dropshipping tables.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
