import { isAdminRequest } from "@/lib/admin-products";
import { isDropshippingEnabled } from "@/lib/dropshipping/config";
import { importDropshipProduct } from "@/lib/dropshipping/db";
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
      supplierProductId?: string;
      markupType?: MarkupType;
      markupValue?: number;
      priceOverride?: number | null;
      collection?: string | null;
      publish?: boolean;
    };

    if (!body.supplierKey || !body.supplierProductId) {
      return Response.json({ ok: false, message: "Supplier and supplier product ID are required." }, { status: 400 });
    }

    const result = await importDropshipProduct({
      supplierKey: body.supplierKey,
      supplierProductId: body.supplierProductId,
      markupType: body.markupType || "percentage",
      markupValue: Number.isFinite(Number(body.markupValue)) ? Number(body.markupValue) : null,
      priceOverride: Number.isFinite(Number(body.priceOverride)) ? Number(body.priceOverride) : null,
      collection: body.collection || null,
      publish: Boolean(body.publish)
    });

    return Response.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import dropship product.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
