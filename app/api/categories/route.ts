import { buildCategoryTree, listSiteCategories, seedDefaultCategoriesIfEmpty } from "@/lib/categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await seedDefaultCategoriesIfEmpty();
  const categories = await listSiteCategories();
  return Response.json({ ok: true, categories, menu: buildCategoryTree(categories) }, { headers: { "Cache-Control": "no-store" } });
}
