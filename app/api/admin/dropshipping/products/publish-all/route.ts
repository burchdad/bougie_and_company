import { isAdminRequest } from "@/lib/admin-products";
import { isDropshippingEnabled } from "@/lib/dropshipping/config";
import { publishAllSyncedDropshipProducts } from "@/lib/dropshipping/db";
import type { MarkupType } from "@/lib/dropshipping/types";

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
    const body = await request.json().catch(() => ({})) as {
      supplierKey?: string;
      markupType?: MarkupType;
      markupValue?: number | null;
      collection?: string | null;
    };
    const result = await publishAllSyncedDropshipProducts({
      supplierKey: body.supplierKey || "dear-lover",
      markupType: body.markupType || "percentage",
      markupValue: Number.isFinite(Number(body.markupValue)) ? Number(body.markupValue) : null,
      collection: body.collection || "dropshipping"
    });

    return Response.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not publish synced dropship products.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
