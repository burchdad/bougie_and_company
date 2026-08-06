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

function footwearText(title: string) {
  return title.replace(/horse\s*shoe/g, "").replace(/horseshoe/g, "");
}

export function inferDropshipCategorySlugs(input: { title?: string | null; categoryNames?: string[] | null }) {
  const title = normalize(input.title || "");
  const categories = (input.categoryNames || []).map(normalize).filter(Boolean);
  const text = [title, ...categories].join(" ");
  const titleForFootwear = footwearText(title);
  const slugs = new Set<string>();
  const isFootwear = hasAny(titleForFootwear, footwearTitleTerms);
  const isLuggage = hasAny(title, luggageTitleTerms);
  const isPurse = !isLuggage && hasAny(title, purseTitleTerms);

  categories.forEach((category) => slugs.add(slugify(category)));

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

  if (hasAny(text, ["bottom", "pant", "pants", "jean", "shorts", "skirt", "legging", "culotte"])) {
    slugs.add("bottoms");
    slugs.add("pants");
  }

  if (isPurse || isLuggage || isFootwear || hasAny(title, ["hat", "cap"])) {
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
