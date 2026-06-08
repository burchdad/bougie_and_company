import { put } from "@vercel/blob";
import { ensureProductAdminTables, isAdminRequest } from "@/lib/admin-products";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const { id } = await context.params;
  const form = await request.formData();
  const file = form.get("file");
  const altText = String(form.get("altText") || "").trim();

  if (!(file instanceof File)) {
    return Response.json({ ok: false, message: "Choose an image to upload." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return Response.json({ ok: false, message: "Product photos must be image files." }, { status: 400 });
  }

  await ensureProductAdminTables();

  const safeName = file.name.replace(/[^a-z0-9._-]/gi, "-").toLowerCase();
  const blob = await put(`products/${id}/${Date.now()}-${safeName}`, file, {
    access: "public"
  });

  const sql = getSql();
  await sql`
    UPDATE product_images
    SET is_primary = FALSE
    WHERE epos_product_id = ${id}
  `;

  const rows = await sql`
    INSERT INTO product_images (epos_product_id, url, pathname, alt_text, sort_order, is_primary)
    VALUES (${id}, ${blob.url}, ${blob.pathname}, ${altText || null}, 0, TRUE)
    RETURNING id, url, pathname, alt_text
  `;

  return Response.json({ ok: true, image: rows[0] }, { headers: { "Cache-Control": "no-store" } });
}
