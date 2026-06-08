import { ensureProductAdminTables, getAdminProducts, isAdminRequest } from "@/lib/admin-products";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const products = await getAdminProducts(searchParams.get("q")?.trim() || "");
  return Response.json({ ok: true, products }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    eposProductId?: string;
    marketingTitle?: string;
    marketingDescription?: string;
    department?: string;
    isFeatured?: boolean;
    isHidden?: boolean;
  };

  if (!body.eposProductId) {
    return Response.json({ ok: false, message: "Missing product ID." }, { status: 400 });
  }

  await ensureProductAdminTables();

  const sql = getSql();
  await sql`
    INSERT INTO product_site_meta (
      epos_product_id,
      marketing_title,
      marketing_description,
      department,
      is_featured,
      is_hidden,
      updated_at
    )
    VALUES (
      ${body.eposProductId},
      ${body.marketingTitle?.trim() || null},
      ${body.marketingDescription?.trim() || null},
      ${body.department?.trim() || null},
      ${Boolean(body.isFeatured)},
      ${Boolean(body.isHidden)},
      NOW()
    )
    ON CONFLICT (epos_product_id)
    DO UPDATE SET
      marketing_title = EXCLUDED.marketing_title,
      marketing_description = EXCLUDED.marketing_description,
      department = EXCLUDED.department,
      is_featured = EXCLUDED.is_featured,
      is_hidden = EXCLUDED.is_hidden,
      updated_at = NOW()
  `;

  return Response.json({ ok: true, message: "Product website details saved." }, { headers: { "Cache-Control": "no-store" } });
}
