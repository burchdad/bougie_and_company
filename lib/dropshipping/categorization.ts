function normalize(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(value: string) {
  return normalize(value).replace(/\s+/g, "-") || "category";
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

const footwearTitleTerms = ["shoes", "sneaker", "sneakers", "sandal", "sandals", "boot", "boots", "heel", "heels", "slipper", "slippers", "flip flop", "flip flops", "loafer", "loafers", "mule", "mules"];
const luggageTitleTerms = ["luggage", "weekender", "duffle", "duffel", "travel bag", "travel case", "makeup bag", "make up", "cosmetic bag", "toiletry", "organizer", "train case", "vanity case"];
const purseTitleTerms = ["purse", "handbag", "shoulder bag", "crossbody", "tote", "wallet", "clutch", "satchel", "hobo bag"];
const titleHiddenFromStorefront = [
  "High Rise Solid Color Open Front Lightweight Cardigan",
  "Brown Western Aztec Printed Open Front Long Cardigan"
];
const topTitleTerms = ["top", "blouse", "shirt", "tee", "t shirt", "t-shirt", "tank", "tunic", "polo", "hoodie", "sweatshirt", "pullover", "sweater", "vest"];
const cardiganTitleTerms = ["cardigan", "kimono", "duster"];
const bottomTitleTerms = ["bottom", "pant", "pants", "jean", "shorts", "skirt", "legging", "culotte"];
const supplierLeafCategorySlugsToIgnore = new Set([
  "bottoms",
  "cardigans",
  "dresses",
  "footwear",
  "pants",
  "shoes-and-bags",
  "tops",
  "women-shoes",
  "womens-footwear"
]);

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordRegex(term: string) {
  const words = normalize(term).split(/\s+/).filter(Boolean).map(escapeRegex);
  return `(^|[^a-z0-9])${words.join("[^a-z0-9]+")}([^a-z0-9]|$)`;
}

function hasKeyword(text: string, terms: string[]) {
  return terms.some((term) => new RegExp(keywordRegex(term)).test(text));
}

function footwearText(title: string) {
  return title.replace(/horse\s*shoe/g, "").replace(/horseshoe/g, "");
}

function dressText(title: string) {
  return title.replace(/dress\s+(pants?|trousers|slacks|shorts)/g, " ");
}

export function inferDropshipCategorySlugs(input: { title?: string | null; categoryNames?: string[] | null }) {
  const title = normalize(input.title || "");
  const categories = (input.categoryNames || []).map(normalize).filter(Boolean);
  const text = [title, ...categories].join(" ");
  const titleForFootwear = footwearText(title);
  const titleForDresses = dressText(title);
  const slugs = new Set<string>();
  const isFootwear = hasKeyword(titleForFootwear, footwearTitleTerms);
  const isLuggage = hasKeyword(title, luggageTitleTerms);
  const isPurse = !isLuggage && hasKeyword(title, purseTitleTerms);

  categories.forEach((category) => {
    const categorySlug = slugify(category);
    if (!supplierLeafCategorySlugsToIgnore.has(categorySlug)) {
      slugs.add(categorySlug);
    }
  });

  const looksLikeApparel = hasAny(text, [
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

  if (looksLikeApparel || isFootwear || isPurse || isLuggage) {
    slugs.add("womens-collection");
  }

  if (looksLikeApparel) {
    slugs.add("clothing");
  }

  if (hasKeyword(title, topTitleTerms)) {
    slugs.add("tops");
  }

  if (hasKeyword(title, cardiganTitleTerms)) {
    slugs.add("cardigans");
    slugs.add("tops");
  }

  if (hasKeyword(titleForDresses, ["dress", "dresses"])) {
    slugs.add("dresses");
  }

  if (hasKeyword(title, ["romper", "jumpsuit"])) {
    slugs.add("rompers-jumpsuits");
  }

  if (hasKeyword(title, bottomTitleTerms)) {
    slugs.add("bottoms");
    slugs.add("pants");
  }

  if (isPurse || isLuggage || isFootwear || hasKeyword(title, ["hat", "cap"])) {
    slugs.add("accessories");
  }

  if (isFootwear) {
    slugs.add("womens-footwear");
    slugs.add("footwear");
  }

  if (isLuggage) {
    slugs.add("luggage");
  }

  if (isPurse) {
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

  const priority = ["womens-collection", "clothing", "tops", "bottoms", "pants", "dresses", "cardigans", "rompers-jumpsuits", "womens-footwear", "footwear", "luggage", "accessories", "purses", "jewelry-headbands"];
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

export function getDropshipDepartmentForOverride(overrideSlug?: string | null) {
  const slug = slugify(overrideSlug || "");
  if (["purses", "luggage", "womens-footwear", "footwear"].includes(slug)) {
    return "womens-collection";
  }
  if (["jewelry", "jewelry-headbands", "necklaces", "bracelets", "fashion-earrings"].includes(slug)) {
    return "jewelry-headbands";
  }
  return "womens-collection";
}

export function applyDropshipCategoryOverride(inferredSlugs: string[], overrideSlug?: string | null) {
  const override = slugify(overrideSlug || "");
  if (!override || override === "dropshipping" || override === "drop-shipping") {
    return inferredSlugs;
  }

  const overrides: Record<string, string[]> = {
    tops: ["womens-collection", "clothing", "tops"],
    cardigans: ["womens-collection", "clothing", "tops", "cardigans"],
    bottoms: ["womens-collection", "clothing", "bottoms", "pants"],
    pants: ["womens-collection", "clothing", "bottoms", "pants"],
    dresses: ["womens-collection", "clothing", "dresses"],
    "rompers-jumpsuits": ["womens-collection", "clothing", "rompers-jumpsuits"],
    "womens-footwear": ["womens-collection", "accessories", "womens-footwear", "footwear"],
    footwear: ["womens-collection", "accessories", "womens-footwear", "footwear"],
    purses: ["womens-collection", "accessories", "purses"],
    luggage: ["womens-collection", "accessories", "luggage"],
    "jewelry-headbands": ["jewelry-headbands"],
    jewelry: ["jewelry-headbands", "jewelry"],
    necklaces: ["jewelry-headbands", "jewelry", "necklaces"],
    bracelets: ["jewelry-headbands", "jewelry", "bracelets"],
    "fashion-earrings": ["jewelry-headbands", "jewelry", "fashion-earrings"]
  };

  return overrides[override] || [override];
}

export function getHiddenDropshipStorefrontTitles() {
  return titleHiddenFromStorefront;
}

export function isHiddenDropshipStorefrontTitle(title: string) {
  const normalizedTitle = normalize(title);
  return titleHiddenFromStorefront.some((hiddenTitle) => normalize(hiddenTitle) === normalizedTitle);
}

export function getDropshipCategorySearchTerms(filterId: string) {
  const normalized = slugify(filterId);
  const terms: Record<string, string[]> = {
    accessories: ["purse", "handbag", "shoulder bag", "crossbody", "tote", "wallet", "clutch", "satchel", "luggage", "weekender", "duffle", "duffel", "travel bag", "makeup bag", "make up", "cosmetic bag", "toiletry", "organizer", "shoes", "sneaker", "sneakers", "sandal", "sandals", "boot", "boots", "hat", "cap"],
    bottoms: ["bottom", "pant", "pants", "jean", "shorts", "skirt", "legging", "culotte"],
    cardigans: ["cardigan", "kimono", "duster"],
    clothing: ["women clothing", "top", "blouse", "shirt", "tee", "t-shirt", "sweater", "dress", "romper", "jumpsuit", "bottom", "pant", "jean", "short", "skirt"],
    dresses: ["dress", "dresses"],
    "fashion-earrings": ["earring", "earrings"],
    jewelry: ["jewelry", "necklace", "bracelet", "earring", "earrings"],
    "jewelry-headbands": ["jewelry", "necklace", "bracelet", "earring", "earrings"],
    necklaces: ["necklace", "necklaces"],
    pants: ["bottom", "pant", "pants", "jean", "shorts", "skirt", "legging", "culotte"],
    luggage: ["luggage", "weekender", "duffle", "duffel", "travel bag", "travel case", "makeup bag", "make up", "cosmetic bag", "toiletry", "organizer", "train case", "vanity case"],
    purses: ["purse", "handbag", "shoulder bag", "crossbody", "tote", "wallet", "clutch", "satchel", "hobo bag"],
    "rompers-jumpsuits": ["romper", "jumpsuit"],
    tops: ["top", "blouse", "shirt", "tee", "t-shirt", "tank", "tunic", "polo", "hoodie", "sweatshirt", "pullover", "sweater", "vest"],
    footwear: footwearTitleTerms,
    "womens-footwear": footwearTitleTerms,
    "womens-collection": ["women clothing", "top", "blouse", "shirt", "tee", "t-shirt", "sweater", "cardigan", "dress", "romper", "jumpsuit", "bottom", "pant", "jean", "short", "skirt", "legging", ...footwearTitleTerms, ...luggageTitleTerms, ...purseTitleTerms]
  };

  return terms[normalized] || [];
}

export function getDropshipCategorySearchRegexes(filterId: string) {
  return getDropshipCategorySearchTerms(filterId).map(keywordRegex);
}

export function getDropshipCategoryExcludeRegexes(filterId: string) {
  const normalized = slugify(filterId);

  if (normalized === "dresses") {
    return ["(^|[^a-z0-9])dress[^a-z0-9]+(pants?|trousers|slacks|shorts)([^a-z0-9]|$)"];
  }

  return [];
}
