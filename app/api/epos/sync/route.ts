import { syncEposCatalog } from "@/lib/epos-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SyncRequestBody = {
  importImages?: boolean;
  images?: boolean;
  imageLimit?: number;
  limit?: number;
  skipExistingImages?: boolean;
};

function isAuthorized(request: Request) {
  const syncSecret = process.env.EPOS_WEBHOOK_SECRET;

  if (!syncSecret) {
    return true;
  }

  const url = new URL(request.url);
  const providedSecret = url.searchParams.get("secret") || request.headers.get("x-epos-webhook-secret");
  return providedSecret === syncSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, message: "Invalid Epos sync secret." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as SyncRequestBody;
    const requestedImageLimit = body.imageLimit ?? body.limit;
    const imageLimit = Number.isFinite(Number(requestedImageLimit)) ? Math.min(Math.max(Number(requestedImageLimit), 1), 250) : 100;
    const result = await syncEposCatalog({
      importImages: body.importImages === true || body.images === true,
      imageLimit,
      skipExistingImages: body.skipExistingImages !== false
    });

    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Epos sync error.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shouldRun = url.searchParams.get("run") === "1" || url.searchParams.get("sync") === "1";

  if (shouldRun) {
    if (!isAuthorized(request)) {
      return Response.json({ ok: false, message: "Invalid Epos sync secret." }, { status: 401 });
    }

    try {
      const requestedImageLimit = url.searchParams.get("imageLimit") || url.searchParams.get("limit");
      const imageLimit = Number.isFinite(Number(requestedImageLimit)) ? Math.min(Math.max(Number(requestedImageLimit), 1), 250) : 100;
      const result = await syncEposCatalog({
        importImages: url.searchParams.get("images") === "1",
        imageLimit,
        skipExistingImages: url.searchParams.get("skipExistingImages") !== "false"
      });

      return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected Epos sync error.";
      console.error(message);
      return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
    }
  }

  return Response.json(
    {
      ok: true,
      message: "Use POST /api/epos/sync to pull products and stock from Epos into Neon. Include { importImages: true } to also import product images."
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
