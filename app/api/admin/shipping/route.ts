import { isAdminRequest } from "@/lib/admin-products";
import { getShippingSettings, saveShippingSettings, syncShippingProductToEpos } from "@/lib/shipping";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberFrom(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const settings = await getShippingSettings();
  return Response.json({ ok: true, settings }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      originPostalCode?: string;
      freeShippingThreshold?: string;
      baseRate?: string;
      perItemRate?: string;
      texasRate?: string;
      remoteRate?: string;
      syncToEpos?: boolean;
    };
    let settings = await saveShippingSettings({
      originPostalCode: String(body.originPostalCode || "75785").trim(),
      freeShippingThreshold: numberFrom(body.freeShippingThreshold, 150),
      baseRate: numberFrom(body.baseRate, 8.95),
      perItemRate: numberFrom(body.perItemRate, 1.25),
      texasRate: numberFrom(body.texasRate, 7.95),
      remoteRate: numberFrom(body.remoteRate, 19.95)
    });
    let eposMessage = "";

    if (body.syncToEpos !== false) {
      const sync = await syncShippingProductToEpos(settings);
      settings = await getShippingSettings();
      eposMessage = sync.eposId ? ` Epos shipping product ${sync.eposId} is ready for order line items.` : " Epos did not return a shipping product ID.";
    }

    return Response.json({ ok: true, message: `Shipping settings saved.${eposMessage}`, settings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shipping settings could not be saved.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
