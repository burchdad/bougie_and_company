import { recordEposSyncEvent, syncEposCatalog, updateEposSyncEvent } from "@/lib/epos-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const webhookSecret = process.env.EPOS_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return true;
  }

  const url = new URL(request.url);
  const providedSecret = url.searchParams.get("secret") || request.headers.get("x-epos-webhook-secret");
  return providedSecret === webhookSecret;
}

function getEventType(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "Batch Update";
  }

  const body = payload as Record<string, unknown>;
  const event = body.Event ?? body.event ?? body.EventName ?? body.eventName;
  return typeof event === "string" && event.trim() ? event.trim() : "Batch Update";
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ ok: false, message: "Invalid Epos webhook secret." }, { status: 401 });
  }

  let payload: unknown = {};

  try {
    const text = await request.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: "Webhook payload was not valid JSON." };
  }

  let eventId: number | undefined;

  try {
    eventId = await recordEposSyncEvent(getEventType(payload), payload);
    const result = await syncEposCatalog();

    if (eventId) {
      await updateEposSyncEvent(eventId, "processed");
    }

    return Response.json({ ok: true, eventId, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Epos webhook error.";
    console.error(message);

    if (eventId) {
      await updateEposSyncEvent(eventId, "failed", message);
    }

    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
