import { buildCategoryTree, listSiteCategories, seedDefaultCategoriesIfEmpty, slugify, syncCategoryToEpos } from "@/lib/categories";
import { isAdminRequest } from "@/lib/admin-products";
import { getSql } from "@/lib/db";
import type { SiteCategory } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  await seedDefaultCategoriesIfEmpty();
  const categories = await listSiteCategories();
  return Response.json({ ok: true, categories, menu: buildCategoryTree(categories) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    label?: string;
    href?: string;
    parentId?: number | null;
    sortOrder?: number;
    isHeader?: boolean;
    syncToEpos?: boolean;
  };
  const label = body.label?.trim();

  if (!label) {
    return Response.json({ ok: false, message: "Category name is required." }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    INSERT INTO site_categories (label, slug, href, parent_id, sort_order, is_header)
    VALUES (${label}, ${slugify(label)}, ${body.href?.trim() || `/shop#${slugify(label)}`}, ${body.parentId || null}, ${Number(body.sortOrder || 0)}, ${Boolean(body.isHeader)})
    RETURNING id::int, label, slug, href, parent_id::int, sort_order, is_header, epos_category_id
  `;

  if (body.syncToEpos) {
    const category = rows[0] as SiteCategory;
    const eposCategory = await syncCategoryToEpos(category, "create");
    const eposId = eposCategory && (eposCategory.Id || eposCategory.id);
    if (eposId) {
      await sql`UPDATE site_categories SET epos_category_id = ${String(eposId)}, updated_at = NOW() WHERE id = ${category.id}`;
    }
  }

  return Response.json({ ok: true, message: "Category added." }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: number;
    label?: string;
    href?: string;
    parentId?: number | null;
    sortOrder?: number;
    isHeader?: boolean;
    syncToEpos?: boolean;
  };

  if (!body.id || !body.label?.trim()) {
    return Response.json({ ok: false, message: "Category ID and name are required." }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    UPDATE site_categories
    SET label = ${body.label.trim()},
      slug = ${slugify(body.label)},
      href = ${body.href?.trim() || `/shop#${slugify(body.label)}`},
      parent_id = ${body.parentId || null},
      sort_order = ${Number(body.sortOrder || 0)},
      is_header = ${Boolean(body.isHeader)},
      updated_at = NOW()
    WHERE id = ${body.id}
    RETURNING id::int, label, slug, href, parent_id::int, sort_order, is_header, epos_category_id
  `;

  if (!rows.length) {
    return Response.json({ ok: false, message: "Category not found." }, { status: 404 });
  }

  if (body.syncToEpos) {
    await syncCategoryToEpos(rows[0] as SiteCategory, "update");
  }

  return Response.json({ ok: true, message: "Category saved." }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));

  if (!id) {
    return Response.json({ ok: false, message: "Category ID is required." }, { status: 400 });
  }

  const sql = getSql();
  const rows = await sql`
    DELETE FROM site_categories
    WHERE id = ${id}
    RETURNING id::int, label, slug, href, parent_id::int, sort_order, is_header, epos_category_id
  `;

  if (rows[0]) {
    await syncCategoryToEpos(rows[0] as SiteCategory, "delete");
  }

  return Response.json({ ok: true, message: "Category removed." }, { headers: { "Cache-Control": "no-store" } });
}
