import { getSql } from "@/lib/db";
import { eposFetch } from "@/lib/epos";
import { defaultMenuItems } from "@/lib/category-defaults";
import type { CategoryMenuItem } from "@/lib/category-defaults";

export type SiteCategory = {
  id: number;
  label: string;
  slug: string;
  href: string;
  parent_id: number | null;
  sort_order: number;
  is_header: boolean;
  epos_category_id: string | null;
};


export async function ensureCategoryTables() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS site_categories (
      id BIGSERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      slug TEXT NOT NULL,
      href TEXT NOT NULL,
      parent_id BIGINT REFERENCES site_categories(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_header BOOLEAN NOT NULL DEFAULT FALSE,
      epos_category_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS site_categories_parent_idx ON site_categories (parent_id, sort_order ASC)`;
}

export function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "category";
}

function menuItemSlug(item: CategoryMenuItem) {
  const hrefSlug = item.href.split("#")[1];
  return hrefSlug ? slugify(hrefSlug) : slugify(item.label);
}

function categoryHref(category: SiteCategory) {
  return category.parent_id ? `/shop#${category.slug}` : category.href;
}

function cleanCategoryTree(items: CategoryMenuItem[], parentLabel = ""): CategoryMenuItem[] {
  return items
    .filter((item) => !(parentLabel === "" && item.label === "Tack"))
    .filter((item) => menuItemSlug(item) !== "dropshipping")
    .filter((item) => !(parentLabel === "Men's Collection" && item.label === "Bath Bombs"))
    .map((item) => ({
      ...item,
      ...(item.children?.length ? { children: cleanCategoryTree(item.children, item.label) } : {})
    }));
}

export async function listSiteCategories() {
  await ensureCategoryTables();
  const sql = getSql();
  return (await sql`SELECT id::int, label, slug, href, parent_id::int, sort_order, is_header, epos_category_id FROM site_categories ORDER BY parent_id NULLS FIRST, sort_order ASC, label ASC`) as SiteCategory[];
}

export function buildCategoryTree(categories: SiteCategory[]) {
  const byParent = new Map<number | null, SiteCategory[]>();
  categories.forEach((category) => {
    const key = category.parent_id ?? null;
    byParent.set(key, [...(byParent.get(key) || []), category]);
  });

  const build = (parentId: number | null): CategoryMenuItem[] =>
    (byParent.get(parentId) || []).map((category) => {
      const children = build(category.id);
      return {
        id: category.id,
        label: category.label,
        href: categoryHref(category),
        ...(children.length ? { children } : {})
      };
    });

  const headerCategories = categories.filter((category) => category.is_header && category.parent_id === null);
  const tree = headerCategories.length
    ? headerCategories.map((category) => {
        const children = build(category.id);
        return {
          id: category.id,
          label: category.label,
          href: categoryHref(category),
          ...(children.length ? { children } : {})
        };
      })
    : build(null);

  return cleanCategoryTree(tree);
}

export async function seedDefaultCategoriesIfEmpty() {
  await ensureCategoryTables();
  const sql = getSql();
  const countRows = await sql`SELECT COUNT(*)::int AS count FROM site_categories`;

  if (Number(countRows[0]?.count || 0) > 0) {
    const existingHeaderRows = await sql`SELECT slug FROM site_categories WHERE parent_id IS NULL AND is_header = TRUE`;
    const existingHeaderSlugs = new Set(existingHeaderRows.map((row) => String(row.slug)));
    const rows = await sql`SELECT COALESCE(MAX(sort_order), -1)::int AS sort_order FROM site_categories WHERE parent_id IS NULL`;
    let sortOrder = Number(rows[0]?.sort_order ?? -1) + 1;

    for (const item of defaultMenuItems) {
      const slug = menuItemSlug(item);
      if (existingHeaderSlugs.has(slug)) {
        continue;
      }

      await sql`
        INSERT INTO site_categories (label, slug, href, parent_id, sort_order, is_header)
        VALUES (${item.label}, ${slug}, ${item.href}, ${null}, ${sortOrder}, ${true})
      `;
      sortOrder += 1;
    }

    return;
  }

  async function insert(items: CategoryMenuItem[], parentId: number | null) {
    for (const [index, item] of items.entries()) {
      const slug = menuItemSlug(item);
      const rows = await sql`
        INSERT INTO site_categories (label, slug, href, parent_id, sort_order, is_header)
        VALUES (${item.label}, ${slug}, ${item.href}, ${parentId}, ${index}, ${parentId === null})
        RETURNING id
      `;
      await insert(item.children || [], Number(rows[0].id));
    }
  }

  await insert(defaultMenuItems, null);
}

export async function syncCategoryToEpos(category: SiteCategory, action: "create" | "update" | "delete") {
  try {
    if (action === "create") {
      return await eposFetch<Record<string, unknown>>("Category", {
        method: "POST",
        body: JSON.stringify({ Name: category.label, Description: category.label })
      });
    }

    if (category.epos_category_id && action === "update") {
      return await eposFetch<Record<string, unknown>>(`Category/${category.epos_category_id}`, {
        method: "PUT",
        body: JSON.stringify({ Id: Number(category.epos_category_id), Name: category.label, Description: category.label })
      });
    }

    if (category.epos_category_id && action === "delete") {
      return await eposFetch<Record<string, unknown>>(`Category/${category.epos_category_id}`, { method: "DELETE" });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Epos category sync failed.");
  }

  return null;
}
