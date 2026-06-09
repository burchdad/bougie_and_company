import { shopDepartments } from "@/lib/data";

export const departmentKeywords: Record<string, string[]> = {
  clothing: ["shirt", "tee", "t-shirt", "top", "bottom", "dress", "romper", "jumpsuit", "cardigan", "jean", "short", "pant", "skirt"],
  "equine-jewelry": ["equine", "horse", "rein", "snaffle", "necklace", "bracelet", "earring"],
  tack: ["tack", "halter", "lead rope", "bridle", "bit", "reins", "saddle", "spur"],
  accessories: ["purse", "bag", "luggage", "weekender", "coozie", "koozie", "coaster", "infusion", "cocktail", "cap", "hat"],
  "bath-body": ["bath", "body", "scrub", "salt", "bomb", "chap", "mask", "lotion", "soap", "beard", "spray", "week from hell", "shampoo"],
  "home-collection": ["candle", "wax", "melt", "tea towel", "pillow", "coaster", "mixer", "outdoor"],
  "mens-collection": ["men", "beard", "mechanic", "cap", "t-shirt", "body spray", "shampoo"],
  "womens-collection": ["women", "dress", "romper", "jumpsuit", "purse", "bath bomb", "body spray", "week from hell"],
  "kitchen-selection": ["dish soap", "foaming hand", "kitchen"],
  "gift-collection": ["gift", "certificate", "set"],
  "jewelry-headbands": ["jewelry", "headband", "earring", "bracelet", "necklace"]
};

export function inferDepartment(product: { department?: string | null; name?: string | null; description?: string | null; sku?: string | null; category_slug?: string | null; parent_category_slug?: string | null }) {
  if (product.department) {
    return product.department;
  }

  const categorySlug = product.parent_category_slug || product.category_slug;
  if (categorySlug && shopDepartments.some((department) => department.id === categorySlug)) {
    return categorySlug;
  }

  const haystack = `${product.name || ""} ${product.description || ""} ${product.sku || ""}`.toLowerCase();
  const match = shopDepartments.find((department) => departmentKeywords[department.id]?.some((keyword) => haystack.includes(keyword)));
  return match?.id || null;
}

export function departmentTitle(id: string | null) {
  return shopDepartments.find((department) => department.id === id)?.title || "All Products";
}
