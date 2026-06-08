import { syncEposCatalog } from "@/lib/epos-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const result = await syncEposCatalog();
    return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Epos sync error.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET() {
  return Response.json(
    {
      ok: true,
      message: "Use POST /api/epos/sync to manually pull products and stock from Epos into Neon."
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
