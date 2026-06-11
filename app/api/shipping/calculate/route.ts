import { calculateShipping, getShippingSettings } from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      address?: {
        address1?: string;
        city?: string;
        state?: string;
        postalCode?: string;
        country?: string;
      };
      subtotal?: number | string;
      itemCount?: number | string;
    };
    const settings = await getShippingSettings();
    const result = calculateShipping(settings, body.address || {}, Number(body.subtotal || 0), Number(body.itemCount || 0));

    return Response.json(result, { status: result.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shipping calculation failed.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
