import { handleUpload } from "@vercel/blob/client";
import { ensureProductAdminTables, isAdminRequest } from "@/lib/admin-products";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function saveProductImage(id: string, url: string, pathname: string, altText: string | null) {
  await ensureProductAdminTables();

  const sql = getSql();
  await sql`
    UPDATE product_images
    SET is_primary = FALSE
    WHERE epos_product_id = ${id}
  `;

  const rows = await sql`
    INSERT INTO product_images (epos_product_id, url, pathname, alt_text, sort_order, is_primary)
    VALUES (${id}, ${url}, ${pathname}, ${altText || null}, 0, TRUE)
    RETURNING id, url, pathname, alt_text
  `;

  return rows[0];
}

export async function POST(request: Request, context: RouteContext) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) as { productId?: string } : {};

        if (payload.productId !== id || !pathname.startsWith(`products/${id}/`)) {
          throw new Error("Upload target does not match the selected product.");
        }

        return {
          allowedContentTypes: ["image/*"],
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true
        };
      }
    });

    return Response.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Blob upload could not be prepared.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const { id } = await context.params;
  const body = (await request.json()) as {
    url?: string;
    pathname?: string;
    altText?: string;
  };

  if (!body.url || !body.pathname) {
    return Response.json({ ok: false, message: "Uploaded image details are missing." }, { status: 400 });
  }

  if (!body.pathname.startsWith(`products/${id}/`)) {
    return Response.json({ ok: false, message: "Uploaded image does not belong to the selected product." }, { status: 400 });
  }

  try {
    const image = await saveProductImage(id, body.url, body.pathname, body.altText?.trim() || null);
    return Response.json({ ok: true, image }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Uploaded image could not be saved to the product.";
    console.error(message);
    return Response.json({ ok: false, message }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
