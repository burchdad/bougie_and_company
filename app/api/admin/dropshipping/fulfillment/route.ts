import { isAdminRequest } from "@/lib/admin-products";
import { listDropshipFulfillmentQueue, updateDropshipFulfillment } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") || 100);
    const fulfillments = await listDropshipFulfillmentQueue(limit);
    return Response.json({ ok: true, fulfillments }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dropship fulfillment queue could not be loaded.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) {
      return Response.json({ ok: false, message: "A valid fulfillment ID is required." }, { status: 400 });
    }

    const result = await updateDropshipFulfillment({
      id,
      status: String(body.status || "ready_for_supplier_order"),
      supplierOrderId: body.supplierOrderId ? String(body.supplierOrderId) : null,
      supplierOrderReference: body.supplierOrderReference ? String(body.supplierOrderReference) : null,
      fulfillmentNotes: body.fulfillmentNotes ? String(body.fulfillmentNotes) : null,
      trackingNumber: body.trackingNumber ? String(body.trackingNumber) : null,
      trackingCarrier: body.trackingCarrier ? String(body.trackingCarrier) : null,
      errorMessage: body.errorMessage ? String(body.errorMessage) : null
    });

    return Response.json({ ok: true, fulfillment: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dropship fulfillment could not be updated.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

