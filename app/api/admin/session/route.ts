import { isAdminRequest } from "@/lib/admin-products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Invalid admin password." }, { status: 401 });
  }

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
