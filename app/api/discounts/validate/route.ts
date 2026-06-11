import { validateDiscountCode } from "@/lib/discounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { code?: string; subtotal?: number | string };
    const code = body.code?.trim() || "";

    if (!code) {
      return Response.json({ ok: false, message: "Enter a discount code." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const result = await validateDiscountCode(code, Number(body.subtotal || 0));
    return Response.json(result, { status: result.ok ? 200 : 404, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discount validation failed.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
