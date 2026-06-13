import { isAdminRequest } from "@/lib/admin-products";
import { hydrateExternalProductImages, importEposProductImages } from "@/lib/epos-product-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { hydrateExternalImages?: boolean; skipExisting?: boolean; limit?: number };
    const limit = Number.isFinite(Number(body.limit)) ? Math.min(Math.max(Number(body.limit), 1), 50) : 25;
    const hydration = body.hydrateExternalImages === false ? null : await hydrateExternalProductImages({ limit });
    const result = await importEposProductImages({
      skipExisting: body.skipExisting !== false,
      limit
    });
    return Response.json(
      {
        ok: true,
        message: `Epos image import checked ${result.productsScanned} product${result.productsScanned === 1 ? "" : "s"}, uploaded ${result.uploaded} image${result.uploaded === 1 ? "" : "s"}, hydrated ${hydration?.hydrated ?? 0} existing image link${hydration?.hydrated === 1 ? "" : "s"} into Blob, and removed ${hydration?.removedStale ?? 0} stale image link${hydration?.removedStale === 1 ? "" : "s"}.`,
        result,
        hydration
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Epos image import failed.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
