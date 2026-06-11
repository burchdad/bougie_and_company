import { isAdminRequest } from "@/lib/admin-products";
import { getOrderItems, listOrders } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const items = await getOrderItems(Number(id));
      return Response.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
    }

    const orders = await listOrders();
    return Response.json({ ok: true, orders }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Orders could not be loaded.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
