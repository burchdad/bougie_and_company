import { isAdminRequest } from "@/lib/admin-products";
import { updateDropshipPublication } from "@/lib/dropshipping/db";
import type { MarkupType } from "@/lib/dropshipping/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({})) as {
      titleOverride?: string | null;
      descriptionOverride?: string | null;
      markupType?: MarkupType;
      markupValue?: number | null;
      priceOverride?: number | null;
      collection?: string | null;
      isPublished?: boolean;
      seoTitle?: string | null;
      seoDescription?: string | null;
    };
    const result = await updateDropshipPublication(id, {
      titleOverride: body.titleOverride || null,
      descriptionOverride: body.descriptionOverride || null,
      markupType: body.markupType || "percentage",
      markupValue: Number.isFinite(Number(body.markupValue)) ? Number(body.markupValue) : null,
      priceOverride: Number.isFinite(Number(body.priceOverride)) ? Number(body.priceOverride) : null,
      collection: body.collection || null,
      isPublished: Boolean(body.isPublished),
      seoTitle: body.seoTitle || null,
      seoDescription: body.seoDescription || null
    });

    return Response.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update dropship publication.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
