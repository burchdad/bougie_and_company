import { syncSupplierProducts } from "@/lib/dropshipping/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, message: "Unauthorized cron request." }, { status: 401 });
  }

  try {
    const result = await syncSupplierProducts("dear-lover", { pages: 1, pageSize: 30 });
    return Response.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dropship cron sync failed.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
