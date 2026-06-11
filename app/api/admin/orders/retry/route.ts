import { isAdminRequest } from "@/lib/admin-products";
import { retryOrderEposSync } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { orderId?: number | string };
    const orderId = Number(body.orderId);

    if (!Number.isInteger(orderId) || orderId < 1) {
      return Response.json({ ok: false, message: "A valid order ID is required." }, { status: 400 });
    }

    const result = await retryOrderEposSync(orderId);
    return Response.json(
      {
        ok: result.ok,
        message: result.message,
        eposOrderId: result.orderId,
        eposCustomerId: result.customerId
      },
      { status: result.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "EPOS order retry failed.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
