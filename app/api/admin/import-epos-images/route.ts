import { isAdminRequest } from "@/lib/admin-products";
import { importEposProductImages } from "@/lib/epos-product-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { skipExisting?: boolean; limit?: number };
    const result = await importEposProductImages({
      skipExisting: body.skipExisting !== false,
      limit: Number.isFinite(Number(body.limit)) ? Math.min(Math.max(Number(body.limit), 1), 50) : 25
    });
    return Response.json(
      {
        ok: true,
        message: `Epos image import checked ${result.productsScanned} product${result.productsScanned === 1 ? "" : "s"} and uploaded ${result.uploaded} image${result.uploaded === 1 ? "" : "s"}.`,
        result
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Epos image import failed.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
