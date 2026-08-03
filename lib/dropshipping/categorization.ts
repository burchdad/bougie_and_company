function normalize(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(value: string) {
  return normalize(value).replace(/\s+/g, "-") || "category";
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

export function inferDropshipCategorySlugs(input: { title?: string | null; categoryNames?: string[] | null }) {
  const title = normalize(input.title || "");
  const categories = (input.categoryNames || []).map(normalize).filter(Boolean);
  const text = [title, ...categories].join(" ");
  const slugs = new Set<string>();

  categories.forEach((category) => slugs.add(slugify(category)));

  const looksLikeApparel = hasAny(text, [
    "women",
    "clothing",
    "top",
    "blouse",
    "shirt",
    "tee",
    "sweater",
    "cardigan",
    "dress",
    "romper",
    "jumpsuit",
    "bottom",
    "pant",
    "jean",
    "short",
    "skirt",
    "legging",
    "swim"
  ]);

  if (looksLikeApparel) {
    slugs.add("clothing");
    slugs.add("womens-collection");
  }

  if (hasAny(text, ["top", "blouse", "shirt", "tee", "t shirt", "tank", "tunic", "polo", "hoodie", "sweatshirt", "pullover", "vest"])) {
    slugs.add("tops");
  }

  if (hasAny(text, ["cardigan", "kimono", "duster"])) {
    slugs.add("cardigans");
    slugs.add("tops");
  }

  if (hasAny(text, ["dress"])) {
    slugs.add("dresses");
  }

  if (hasAny(text, ["romper", "jumpsuit"])) {
    slugs.add("rompers-jumpsuits");
  }

  if (hasAny(text, ["bottom", "pant", "pants", "jean", "short", "shorts", "skirt", "legging", "culotte"])) {
    slugs.add("bottoms");
    slugs.add("pants");
  }

  if (hasAny(text, ["purse", "bag", "handbag", "tote", "wallet", "shoe", "shoes", "sandal", "boot", "hat", "cap"])) {
    slugs.add("accessories");
  }

  if (hasAny(text, ["purse", "bag", "handbag", "tote", "wallet"])) {
    slugs.add("purses");
  }

  if (hasAny(text, ["jewelry", "necklace", "bracelet", "earring", "earrings"])) {
    slugs.add("jewelry-headbands");
    slugs.add("jewelry");
  }

  if (hasAny(text, ["necklace"])) {
    slugs.add("necklaces");
  }

  if (hasAny(text, ["bracelet"])) {
    slugs.add("bracelets");
  }

  if (hasAny(text, ["earring", "earrings"])) {
    slugs.add("fashion-earrings");
  }

  const priority = ["womens-collection", "clothing", "tops", "bottoms", "pants", "dresses", "cardigans", "rompers-jumpsuits", "accessories", "purses", "jewelry-headbands"];
  return [...slugs]
    .filter((slug) => slug !== "dropshipping" && slug !== "drop-shipping")
    .sort((a, b) => {
      const left = priority.indexOf(a);
      const right = priority.indexOf(b);
      return (left === -1 ? Number.MAX_SAFE_INTEGER : left) - (right === -1 ? Number.MAX_SAFE_INTEGER : right);
    });
}

export function getDropshipDepartmentSlug(input: { title?: string | null; categoryNames?: string[] | null }) {
  const slugs = inferDropshipCategorySlugs(input);
  return slugs.find((slug) => ["womens-collection", "clothing", "accessories", "jewelry-headbands"].includes(slug)) || "womens-collection";
}

export function getDropshipCategorySearchTerms(filterId: string) {
  const normalized = slugify(filterId);
  const terms: Record<string, string[]> = {
    accessories: ["purse", "bag", "handbag", "tote", "wallet", "shoe", "shoes", "sandal", "boot", "hat", "cap"],
    bottoms: ["bottom", "pant", "pants", "jean", "short", "shorts", "skirt", "legging", "culotte"],
    cardigans: ["cardigan", "kimono", "duster"],
    clothing: ["women clothing", "top", "blouse", "shirt", "tee", "t-shirt", "sweater", "dress", "romper", "jumpsuit", "bottom", "pant", "jean", "short", "skirt"],
    dresses: ["dress", "dresses"],
    "fashion-earrings": ["earring", "earrings"],
    jewelry: ["jewelry", "necklace", "bracelet", "earring", "earrings"],
    "jewelry-headbands": ["jewelry", "necklace", "bracelet", "earring", "earrings"],
    necklaces: ["necklace", "necklaces"],
    pants: ["bottom", "pant", "pants", "jean", "short", "shorts", "skirt", "legging", "culotte"],
    purses: ["purse", "bag", "handbag", "tote", "wallet"],
    "rompers-jumpsuits": ["romper", "jumpsuit"],
    tops: ["top", "blouse", "shirt", "tee", "t-shirt", "tank", "tunic", "polo", "hoodie", "sweatshirt", "pullover", "sweater", "vest"],
    "womens-collection": ["women clothing", "top", "blouse", "shirt", "tee", "t-shirt", "sweater", "cardigan", "dress", "romper", "jumpsuit", "bottom", "pant", "jean", "short", "skirt", "legging"]
  };

  return terms[normalized] || [];
}
