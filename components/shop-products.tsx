"use client";

import Image from "next/image";
import { ShoppingBag, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { readFormResponse } from "@/lib/form-response";
import { departmentTitle, inferDepartment } from "@/lib/product-categorization";

type Product = {
  epos_product_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  category_id: string | null;
  sale_price: string | null;
  stock: string | null;
  synced_at: string;
  marketing_title: string | null;
  marketing_description: string | null;
  department: string | null;
  category_slugs: string[];
  has_explicit_categories: boolean;
  is_featured: boolean | null;
  is_hidden: boolean | null;
  primary_image_url: string | null;
  primary_image_alt: string | null;
};

type ProductResponse = {
  ok: boolean;
  products?: Product[];
  message?: string;
};

type ProductGroup = {
  key: string;
  title: string;
  products: Product[];
};

type WomensApparelSizeOption = {
  label: WomensApparelSize;
  product?: Product;
};

type DetailProduct = {
  product: Product;
  imageProduct: Product;
  title: string;
  group?: ProductGroup;
};

const mensTshirtSizes = ["Medium", "Large", "X-Large"];
const womensApparelSizes = ["Small", "Medium", "Large", "X-Large"] as const;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const homemadeSoapDisclaimer = "Handmade soap colors may vary slightly from batch to batch depending on when each bar is made.";

function GiftBasketRequestForm() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "error" | "success">("idle");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();
    const email = String(form.get("email") || "").trim();
    const phone = String(form.get("phone") || "").trim();
    const occasion = String(form.get("occasion") || "").trim();
    const budget = String(form.get("budget") || "").trim();
    const recipient = String(form.get("recipient") || "").trim();
    const details = String(form.get("details") || "").trim();

    if (!firstName || !lastName || !email || !occasion || !budget || !details) {
      setStatus("error");
      setMessage("Please fill out the required fields.");
      return;
    }

    if (!emailPattern.test(email)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          subject: "Custom gift basket request",
          source: "gift-collection",
          message: [
            "Custom gift basket request",
            "",
            `Occasion: ${occasion}`,
            `Budget: ${budget}`,
            recipient ? `Recipient: ${recipient}` : "",
            "",
            details
          ].filter(Boolean).join("\n")
        })
      });
      const result = await readFormResponse(response, "Thank you. Your gift basket request has been sent.");

      if (!result.ok) {
        setStatus("error");
        setMessage(result.message || "We could not send your request yet.");
        return;
      }

      formElement.reset();
      setStatus("success");
      setMessage(result.message || "Thank you. Your gift basket request has been sent.");
    } catch {
      setStatus("error");
      setMessage("We could not send your request right now. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4 text-left" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-espresso">
          First name
          <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-ivory px-3 font-normal" name="firstName" required />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-espresso">
          Last name
          <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-ivory px-3 font-normal" name="lastName" required />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-espresso">
          Email
          <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-ivory px-3 font-normal" name="email" required type="email" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-espresso">
          Phone
          <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-ivory px-3 font-normal" name="phone" />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-espresso">
          Occasion
          <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-ivory px-3 font-normal" name="occasion" placeholder="Birthday, thank you..." required />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-espresso">
          Budget
          <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-ivory px-3 font-normal" name="budget" placeholder="$50, $100..." required />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-espresso">
          Recipient
          <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-ivory px-3 font-normal" name="recipient" placeholder="For her, teacher..." />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-semibold text-espresso">
        What should we include?
        <textarea className="focus-ring min-h-32 rounded-md border border-saddle/20 bg-ivory px-3 py-3 font-normal" name="details" placeholder="Tell us preferred scents, colors, items, allergies, pickup/shipping timing, or anything special." required />
      </label>
      <button className="focus-ring justify-self-start rounded-md bg-ink px-6 py-4 text-sm font-bold uppercase tracking-[0.18em] text-ivory hover:bg-saddle disabled:opacity-60" disabled={submitting} type="submit">
        {submitting ? "Sending..." : "Request Gift Basket"}
      </button>
      {message ? <p className={`text-sm font-semibold ${status === "success" ? "text-saddle" : "text-ember"}`}>{message}</p> : null}
    </form>
  );
}

function ProductPhotoFallback({ large = false }: { large?: boolean }) {
  const logoClassName = large ? "h-36 w-36 p-4" : "h-24 w-24 p-3";
  const textClassName = large ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl";

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-espresso via-saddle to-ember">
      <div className="absolute inset-0 opacity-30 mix-blend-soft-light luxury-pattern" />
      <div className="absolute inset-0 grid place-items-center px-8">
        <div className={`${logoClassName} rounded-full bg-ivory/95 shadow-luxe ring-1 ring-champagne/45`}>
          <Image alt="Bougie & Company logo" className="h-full w-full object-contain" height={144} src="/images/logo.png" width={144} />
        </div>
      </div>
      <div className="absolute left-1/2 top-1/2 w-[135%] -translate-x-1/2 -translate-y-1/2 -rotate-12 border-y border-champagne/80 bg-ink/90 py-3 text-center shadow-luxe">
        <span className={`${textClassName} font-black uppercase tracking-[0.22em] text-champagne`}>Photo Coming Soon</span>
      </div>
    </div>
  );
}

const variantWords = [
  "xxs",
  "xs",
  "small",
  "medium",
  "large",
  "x-small",
  "x-large",
  "xlarge",
  "xl",
  "xxl",
  "xxxl",
  "s",
  "m",
  "l",
  "2x",
  "3x",
  "4x",
  "5x",
  "one size",
  "os"
];

const apparelColorWords = [
  "aqua",
  "beige",
  "black",
  "blue",
  "brown",
  "camel",
  "charcoal",
  "coral",
  "cream",
  "dusty",
  "espresso",
  "fuchsia",
  "gold",
  "graphite",
  "gray",
  "green",
  "grey",
  "ivory",
  "khaki",
  "lavender",
  "lime",
  "magenta",
  "maroon",
  "mint",
  "moss",
  "mustard",
  "navy",
  "olive",
  "orange",
  "pink",
  "purple",
  "red",
  "rose",
  "rust",
  "skye",
  "tan",
  "taupe",
  "teal",
  "turquoise",
  "white",
  "wine",
  "yellow"
];

const apparelCategorySlugs = new Set([
  "womens-collection",
  "mens-collection",
  "clothing",
  "dresses",
  "tops",
  "bottoms",
  "pants",
  "cardigans",
  "rompers-jumpsuits",
  "t-shirts"
]);
const womensApparelCategorySlugs = new Set(["clothing", "dresses", "tops", "bottoms", "pants", "cardigans", "rompers-jumpsuits"]);
type WomensApparelSize = (typeof womensApparelSizes)[number];

const categoryKeywordMap: Record<string, string[]> = {
  accessories: ["purse", "bag", "luggage", "weekender", "coozie", "koozie", "coaster", "infusion", "cocktail", "cap", "hat"],
  "bath-body": ["bath", "body", "scrub", "salt", "bomb", "chap", "mask", "lotion", "soap", "beard", "spray", "week from hell", "shampoo"],
  "bath-bombs": ["bath bomb"],
  "bath-salts": ["bath salt", "bath salts"],
  "beard-products": ["beard"],
  "body-butter-lotion": ["body butter", "lotion"],
  "body-scrubs": ["body scrub", "bath scrub", "scrub"],
  "body-spray": ["body spray", "body sprays"],
  "body-sprays": ["body spray", "body sprays"],
  bottoms: ["pant", "wideleg", "wide leg", "bottom", "short", "skirt"],
  bracelets: ["bracelet", "wrist", "wrap", "magnet"],
  "chap-stick": ["chap stick", "chapstick"],
  cardigans: ["cardigan", "duster"],
  candles: ["candle"],
  "clay-masks": ["clay mask"],
  clothing: ["shirt", "tee", "t-shirt", "top", "bottom", "dress", "romper", "jumpsuit", "cardigan", "jean", "short", "pant", "skirt"],
  "cocktail-infusions": ["cocktail", "infusion", "mixer"],
  "cocktail-mixers": ["cocktail", "mixer"],
  coasters: ["coaster"],
  coozies: ["coozie", "koozie"],
  dresses: ["dress"],
  earrings: ["earring"],
  "equine-earrings": ["earring", "ear ring"],
  "equine-jewelry": ["equine", "horse", "rein", "snaffle", "necklace", "bracelet", "earring", "ear ring"],
  "fashion-earrings": ["earring", "ear ring"],
  "foaming-hand-soap": ["foaming hand"],
  "hand-soaps": ["hand soap", "handmade soap", "homemade soap", "dish soap"],
  "gift-certificates": ["gift certificate"],
  "gift-basket": ["gift basket"],
  "gift-cards": ["gift card", "gift certificate"],
  "gift-collection": ["gift card", "gift certificate"],
  "gift-sets": ["gift set"],
  "handmade-soaps": ["handmade soap", "homemade soap"],
  headbands: ["headband"],
  "home-collection": ["candle", "wax", "melt", "tea towel", "pillow", "coaster", "mixer", "outdoor"],
  homemade: ["homemade"],
  "homemade-dish-soap": ["dish soap"],
  "kitchen-selection-dish-soap": ["dish soap"],
  "kitchen-selection-foaming-hand-soap": ["foaming hand"],
  "kitchen-selection-homemade-dish-soap": ["dish soap"],
  "homemade-mechanic-soaps": ["mechanic soap", "mechanic soaps"],
  "jewelry-headbands": ["jewelry", "headband", "earring", "bracelet", "necklace"],
  "kitchen-collection": ["dish soap", "foaming hand", "hand soap", "handmade soap", "homemade soap", "kitchen"],
  "kitchen-selection": ["dish soap", "foaming hand", "hand soap", "handmade soap", "homemade soap", "kitchen"],
  "leather-coasters": ["leather coaster"],
  luggage: ["luggage", "weekender", "duffle", "travel"],
  "mens-care": ["men", "beard", "mechanic", "shave", "shaving", "body spray", "shampoo", "chap"],
  "mens-collection": ["men", "beard", "mechanic", "shave", "shaving", "cap", "t-shirt", "body spray", "shampoo"],
  necklaces: ["necklace"],
  "outdoor-items": ["outdoor"],
  outdoor: ["outdoor"],
  pants: ["pant", "wideleg", "wide leg", "bottom", "short", "skirt"],
  purses: ["purse", "bag"],
  "farm-eggs": ["farm fresh egg", "farm eggs"],
  regular: ["regular coaster"],
  "regular-coasters": ["coaster"],
  "rompers-jumpsuits": ["romper", "jumpsuit"],
  "candles-soy-9oz": ["9oz", "9 oz"],
  "candles-soy-wax-melts": ["wax melt", "wax melts"],
  "soy-9oz": ["9oz", "9 oz"],
  "soy-wax-melts": ["wax melt", "wax melts"],
  soaps: ["soap"],
  tack: ["tack", "halter", "lead rope", "bridle", "bit", "reins", "saddle", "spur"],
  "t-shirts": ["t-shirt", "tee", "shirt"],
  "tea-towels-pillows": ["tea towel", "pillow"],
  "week-from-hell": ["week from hell"],
  "womens-care": ["women", "week from hell", "bath salt", "body scrub", "bath bomb", "body spray", "chap"],
  "womens-collection": ["women", "dress", "romper", "jumpsuit", "purse", "bath bomb", "body spray", "week from hell"]
};

function money(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `$${parsed.toFixed(2)}` : "Price in store";
}

function isFarmEggProduct(product: Product) {
  const haystack = productSearchText(product);
  return product.category_slugs?.includes("farm-eggs") || haystack.includes("farm fresh egg");
}

function isHomemadeSoapProduct(product: Product) {
  const haystack = productSearchText(product);
  return product.category_slugs?.includes("handmade-soap") || haystack.includes("handmade soap") || haystack.includes("homemade soap");
}

function isShaveSoapProduct(product: Product) {
  const haystack = productSearchText(product);
  return haystack.includes("shave soap") || haystack.includes("shaving soap");
}

function isFoamingHandSoapProduct(product: Product) {
  const haystack = productSearchText(product);
  return product.category_slugs?.includes("foaming-hand-soap") || haystack.includes("foaming hand");
}

function isHandmadeSoapFilterProduct(product: Product) {
  return isHomemadeSoapProduct(product) && !isShaveSoapProduct(product);
}

function isGiftCardProduct(product: Product) {
  const haystack = productSearchText(product);
  return product.category_slugs?.includes("gift-cards") || haystack.includes("gift card") || haystack.includes("gift certificate");
}

function giftCardDisplayPrice(product: Product) {
  const text = `${product.marketing_title || product.name} ${product.marketing_description || ""} ${product.description || ""}`;
  const match = text.match(/\b(\d+(?:\.\d{1,2})?)\b/);
  const amount = match?.[1] ? Number(match[1]) : null;
  return amount && Number.isFinite(amount) && amount > 0 ? `$${amount.toFixed(2)}` : null;
}

function displayPrice(product: Product) {
  if (isGiftCardProduct(product)) {
    return giftCardDisplayPrice(product) || money(product.sale_price);
  }

  return isFarmEggProduct(product) ? "$4.00 / dozen" : money(product.sale_price);
}

function stockCount(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasAvailableStock(product: Product) {
  return stockCount(product.stock) > 0;
}

function isPurchasableProduct(product: Product) {
  return isGiftCardProduct(product) || hasAvailableStock(product);
}

function isMensTshirtProduct(product: Product) {
  const slugs = product.category_slugs || [];
  const text = `${product.name} ${product.marketing_title || ""} ${product.sku || ""}`.toLowerCase();
  return slugs.includes("t-shirts") || (slugs.includes("mens-collection") && /\b(t-shirt|tee)\b/i.test(text));
}

function isWomensApparelProduct(product: Product) {
  const slugs = product.category_slugs || [];
  return slugs.includes("womens-collection") && slugs.some((slug) => womensApparelCategorySlugs.has(slug));
}

function isWomensApparelGroup(group?: ProductGroup) {
  return Boolean(group?.products.some(isWomensApparelProduct));
}

function productVariantScore(product: Product) {
  return Number(hasAvailableStock(product)) * 2 + Number(Boolean(product.primary_image_url));
}

function cartProductName(product: Product, option?: string) {
  const name = product.marketing_title || product.name;
  return option ? `${name} - ${option}` : name;
}

function getProductDepartment(product: Product) {
  return inferDepartment(product) || "all";
}

function productSearchText(product: Product) {
  return `${product.name} ${product.marketing_title || ""} ${product.description || ""} ${product.marketing_description || ""} ${product.sku || ""}`.toLowerCase();
}

function isBathSaltProductMatch(product: Product) {
  return /\bsalts?\b/.test(productSearchText(product));
}

function isBodyScrubProductMatch(product: Product) {
  return /\bscrubs?\b/.test(productSearchText(product));
}

function categoryKeywords(filterId: string) {
  const direct = categoryKeywordMap[filterId];
  if (direct) {
    return direct;
  }

  const segments = filterId.split("-");
  for (let index = 0; index < segments.length; index += 1) {
    const possible = segments.slice(index).join("-");
    if (categoryKeywordMap[possible]) {
      return categoryKeywordMap[possible];
    }
  }

  return [filterId.replace(/-/g, " ")];
}

function productMatchesFilter(product: Product, filterId: string) {
  if (filterId === "all") {
    return true;
  }

  if (filterId === "tack") {
    return false;
  }

  if (filterId === "gift-basket" || filterId === "gift-baskets" || filterId === "gift-sets") {
    return false;
  }

  if (filterId === "bath-salts" || filterId === "body-scrubs") {
    const slugs = product.category_slugs || [];
    if (slugs.includes(filterId)) {
      return true;
    }

    if (slugs.includes("bath-salts-scrubs")) {
      return filterId === "bath-salts" ? isBathSaltProductMatch(product) : isBodyScrubProductMatch(product);
    }
  }

  if (filterId === "gift-collection" || filterId === "gift-cards" || filterId === "gift-certificates") {
    const haystack = productSearchText(product);
    return product.category_slugs?.includes("gift-cards") || haystack.includes("gift card") || haystack.includes("gift certificate");
  }

  if (filterId === "handmade-soaps") {
    return isHandmadeSoapFilterProduct(product);
  }

  if (filterId === "soaps") {
    const slugs = product.category_slugs || [];
    const haystack = productSearchText(product);
    return (
      !slugs.includes("mens-care") &&
      !isShaveSoapProduct(product) &&
      (slugs.includes("soaps") || isHandmadeSoapFilterProduct(product) || isFoamingHandSoapProduct(product) || haystack.includes("hand soap"))
    );
  }

  if (filterId === "soy-9oz" || filterId === "candles-soy-9oz") {
    const haystack = productSearchText(product);
    return product.category_slugs?.includes("candles") && (haystack.includes("9oz") || haystack.includes("9 oz")) && !haystack.includes("wax melt");
  }

  if (filterId === "soy-wax-melts" || filterId === "candles-soy-wax-melts") {
    const haystack = productSearchText(product);
    return product.category_slugs?.includes("candles") && (haystack.includes("wax melt") || haystack.includes("wax melts"));
  }

  if (filterId === "homemade-dish-soap" || filterId === "kitchen-selection-dish-soap" || filterId === "kitchen-selection-homemade-dish-soap") {
    const haystack = productSearchText(product);
    return product.category_slugs?.includes("kitchen-selection") && haystack.includes("dish soap") && !haystack.includes("foaming hand");
  }

  if (filterId === "hand-soaps") {
    const slugs = product.category_slugs || [];
    const haystack = productSearchText(product);
    return slugs.includes("soaps") && !slugs.includes("mens-care") && haystack.includes("soap") && !haystack.includes("foaming hand") && !isShaveSoapProduct(product);
  }

  if (filterId === "foaming-hand-soap" || filterId === "kitchen-selection-foaming-hand-soap") {
    const haystack = productSearchText(product);
    return product.category_slugs?.includes("kitchen-selection") && haystack.includes("foaming hand");
  }

  if (filterId === "bottoms") {
    return product.category_slugs?.includes("pants") || product.category_slugs?.includes("bottoms");
  }

  if (filterId === "regular-coasters") {
    const slugs = product.category_slugs || [];
    if (slugs.includes("regular-coasters")) {
      return true;
    }

    if (product.has_explicit_categories) {
      return false;
    }

    const haystack = productSearchText(product);
    return haystack.includes("coaster") && !haystack.includes("leather");
  }

  if (product.category_slugs?.includes(filterId)) {
    return true;
  }

  if (product.has_explicit_categories) {
    return false;
  }

  if (getProductDepartment(product) === filterId) {
    return true;
  }

  const haystack = productSearchText(product);
  return categoryKeywords(filterId).some((keyword) => haystack.includes(keyword));
}

function cleanProductTitle(product: Product) {
  return (product.marketing_title || product.name).replace(/\s+/g, " ").trim();
}

function titleWordsWithoutSku(title: string) {
  return title.replace(/^[A-Z]{2,}\d+[A-Z0-9-]*\s+/i, "").trim().split(/\s+/).filter(Boolean);
}

function displaySize(value: string) {
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, "");
  const labels: Record<string, string> = {
    xxs: "XXS",
    xs: "XS",
    xsmall: "XS",
    small: "Small",
    s: "Small",
    medium: "Medium",
    m: "Medium",
    large: "Large",
    l: "Large",
    xlarge: "X-Large",
    xl: "X-Large",
    xxl: "XXL",
    xxxl: "XXXL",
    os: "One Size",
    onesize: "One Size"
  };

  return labels[normalized] || value.toUpperCase();
}

function variantSizeLabel(title: string, sku: string) {
  const lowerTitle = title.toLowerCase();
  const explicitSize = lowerTitle.match(/\b(xxs|xs|x-small|small|medium|large|x-large|xlarge|xl|xxl|xxxl|s|m|l|2x|3x|4x|5x|one size|os)\b/);
  if (explicitSize?.[1]) {
    return displaySize(explicitSize[1]);
  }

  const compactSkuSize = sku.match(/(xxs|xs|x-small|small|medium|x-large|xlarge|large|xl|xxl|xxxl|2x|3x|4x|5x|os)$/i);
  if (compactSkuSize?.[1]) {
    return displaySize(compactSkuSize[1]);
  }

  const skuSize = sku.match(/(?:^|[-_\s])(xxs|xs|x-small|small|medium|large|x-large|xlarge|s|m|l|xl|xxl|xxxl|2x|3x|4x|5x|os)(?:$|[-_\s])/i);
  if (skuSize?.[1]) {
    return displaySize(skuSize[1]);
  }

  return "";
}

function womensApparelSizeLabel(product: Product): WomensApparelSize | "" {
  const size = variantSizeLabel(cleanProductTitle(product), product.sku || "");
  const normalized = size.toLowerCase().replace(/[\s_-]+/g, "");
  const labels: Record<string, WomensApparelSize> = {
    s: "Small",
    small: "Small",
    m: "Medium",
    medium: "Medium",
    l: "Large",
    large: "Large",
    xl: "X-Large",
    xlarge: "X-Large"
  };

  return labels[normalized] || "";
}

function variantColorLabel(title: string) {
  const titleWords = titleWordsWithoutSku(title);
  const leadingColors: string[] = [];
  for (const word of titleWords) {
    if (!apparelColorWords.includes(word.toLowerCase())) {
      break;
    }
    leadingColors.push(word);
  }

  const trailingColors: string[] = [];
  for (let index = titleWords.length - 1; index >= 0; index -= 1) {
    const word = titleWords[index];
    if (!apparelColorWords.includes(word.toLowerCase())) {
      break;
    }
    trailingColors.unshift(word);
  }

  const colorWords = leadingColors.length ? leadingColors : trailingColors;
  return colorWords.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function variantLabel(product: Product) {
  const title = cleanProductTitle(product);
  const sku = product.sku || "";
  const size = variantSizeLabel(title, sku);
  const color = variantColorLabel(title);

  if (color && size) {
    return `${color} / ${size}`;
  }

  if (size) {
    return size;
  }

  if (color) {
    return color;
  }

  return sku || product.epos_product_id;
}

function titleWithoutLeadingSku(title: string) {
  return title.replace(/^[A-Z]{2,}\d+[A-Z0-9-]*\s+/i, "").trim();
}

function normalizedVariantBaseTitle(product: Product) {
  let title = titleWithoutLeadingSku(cleanProductTitle(product)).toLowerCase();
  title = title.replace(/\b(size|sz)\s*[:#-]?\s*/g, " ");
  variantWords.forEach((word) => {
    title = title.replace(new RegExp(`\\b${word.replace(" ", "\\s+")}\\b`, "gi"), " ");
  });

  const words = title.split(/\s+/).filter(Boolean);
  while (words.length > 1 && apparelColorWords.includes(words[0])) {
    words.shift();
  }
  while (words.length > 1 && apparelColorWords.includes(words[words.length - 1])) {
    words.pop();
  }

  title = words.join(" ");
  title = title.replace(/\b\d+x\b/g, " ");
  title = title.replace(/\s*[-|/]\s*$/g, " ");
  return title.replace(/[^a-z0-9]+/g, " ").trim();
}

function hasVariantSignal(product: Product) {
  const slugs = product.category_slugs || [];
  if (!slugs.some((slug) => apparelCategorySlugs.has(slug))) {
    return false;
  }

  const text = `${cleanProductTitle(product)} ${product.sku || ""}`.toLowerCase();
  const sizePattern = /\b(size|sz|xxs|xs|small|medium|large|xl|xxl|xxxl|2x|3x|4x|5x|one size|os)\b/i;
  const hasColor = apparelColorWords.some((word) => new RegExp(`\\b${word}\\b`, "i").test(text));
  return sizePattern.test(text) || hasColor;
}

function groupKey(product: Product) {
  if (!hasVariantSignal(product)) {
    return product.epos_product_id;
  }

  return normalizedVariantBaseTitle(product) || product.epos_product_id;
}

function groupTitle(product: Product) {
  if (!hasVariantSignal(product)) {
    return titleWithoutLeadingSku(cleanProductTitle(product)).trim();
  }

  const baseTitle = normalizedVariantBaseTitle(product);
  if (!baseTitle || baseTitle === product.epos_product_id) {
    return titleWithoutLeadingSku(cleanProductTitle(product)).replace(/\b(Size|SZ)\b\s*[:#-]?\s*/gi, "").trim();
  }

  return baseTitle.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function womensApparelSizeOptions(group?: ProductGroup): WomensApparelSizeOption[] {
  if (!isWomensApparelGroup(group)) {
    return [];
  }

  const productsBySize = new Map<WomensApparelSize, Product>();
  group!.products.forEach((product) => {
    if (!isWomensApparelProduct(product)) {
      return;
    }

    const size = womensApparelSizeLabel(product);
    if (!size) {
      return;
    }

    const existing = productsBySize.get(size);
    if (!existing || productVariantScore(product) > productVariantScore(existing)) {
      productsBySize.set(size, product);
    }
  });

  return womensApparelSizes.map((label) => ({
    label,
    product: productsBySize.get(label)
  }));
}

function womensApparelOptionLabel(product: Product) {
  return variantColorLabel(cleanProductTitle(product));
}

function womensApparelVariantScore(product: Product, selectedSize?: string) {
  const size = womensApparelSizeLabel(product);
  const hasExactSize = Boolean(selectedSize && size === selectedSize);
  const hasFlexibleSize = !size;
  return Number(hasExactSize) * 4 + Number(hasFlexibleSize) * 2 + productVariantScore(product);
}

function womensApparelVariantOptions(group?: ProductGroup, selectedSize?: string) {
  if (!isWomensApparelGroup(group)) {
    return [];
  }

  const productsByOption = new Map<string, Product>();
  group!.products.forEach((product) => {
    if (!isWomensApparelProduct(product)) {
      return;
    }

    const label = womensApparelOptionLabel(product);
    if (!label) {
      return;
    }

    const existing = productsByOption.get(label);
    if (!existing || womensApparelVariantScore(product, selectedSize) > womensApparelVariantScore(existing, selectedSize)) {
      productsByOption.set(label, product);
    }
  });

  return [...productsByOption.entries()].map(([label, product]) => ({ label, product }));
}

function hasOnlyWomensSizeVariants(group?: ProductGroup) {
  return Boolean(
    group &&
      isWomensApparelGroup(group) &&
      group.products.length > 1 &&
      group.products.every((product) => Boolean(womensApparelSizeLabel(product)))
  );
}

function groupProducts(products: Product[]) {
  const groups = new Map<string, ProductGroup>();

  products.forEach((product) => {
    const key = groupKey(product);
    const existing = groups.get(key);

    if (existing) {
      existing.products.push(product);
      return;
    }

    groups.set(key, {
      key,
      title: groupTitle(product),
      products: [product]
    });
  });

  return [...groups.values()].map((group) => {
    const variantsByLabel = new Map<string, Product>();
    group.products.forEach((product) => {
      const label = variantLabel(product);
      const existing = variantsByLabel.get(label);
      if (!existing) {
        variantsByLabel.set(label, product);
        return;
      }

      const existingScore = Number(hasAvailableStock(existing)) + Number(Boolean(existing.primary_image_url));
      const nextScore = Number(hasAvailableStock(product)) + Number(Boolean(product.primary_image_url));
      if (nextScore > existingScore) {
        variantsByLabel.set(label, product);
      }
    });

    return {
      ...group,
      products: [...variantsByLabel.values()].sort((a, b) => {
        const stockSort = Number(hasAvailableStock(b)) - Number(hasAvailableStock(a));
        return stockSort || variantLabel(a).localeCompare(variantLabel(b), undefined, { numeric: true });
      })
    };
  });
}

export function ShopProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeDepartment, setActiveDepartment] = useState("all");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [detailProduct, setDetailProduct] = useState<DetailProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadProducts() {
      setLoading(true);
      setMessage("");

      try {
        const response = await fetch("/api/products", { cache: "no-store" });
        const result = (await response.json()) as ProductResponse;

        if (!response.ok || !result.ok) {
          setMessage(result.message || "The shop is still getting ready. Please check back shortly.");
          return;
        }

        if (!ignore) {
          setProducts(result.products || []);
        }
      } catch {
        if (!ignore) {
          setMessage("We could not load the shop right now. Please try again shortly.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadProducts();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    function applyHash() {
      const nextDepartment = window.location.hash.replace("#", "");
      if (!nextDepartment) {
        setActiveDepartment("all");
        return;
      }

      if (nextDepartment) {
        setActiveDepartment(nextDepartment);
      }
    }

    applyHash();
    function applyCategoryEvent(event: Event) {
      const categoryId = (event as CustomEvent<{ categoryId?: string }>).detail?.categoryId || "all";
      setActiveDepartment(categoryId);
      window.history.replaceState(null, "", categoryId === "all" ? "/shop" : `/shop#${categoryId}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    window.addEventListener("hashchange", applyHash);
    window.addEventListener("bougie:shop-category", applyCategoryEvent);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("bougie:shop-category", applyCategoryEvent);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      return productMatchesFilter(product, activeDepartment);
    });
  }, [activeDepartment, products]);

  const filteredGroups = useMemo(() => groupProducts(filteredProducts), [filteredProducts]);
  const isGiftBasketCategory = activeDepartment === "gift-basket" || activeDepartment === "gift-baskets";

  function addToCart(product: Product, option?: string) {
    if (!isPurchasableProduct(product) || isFarmEggProduct(product)) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("bougie:add-to-cart", {
        detail: {
          id: product.epos_product_id,
          name: cartProductName(product, option),
          price: displayPrice(product),
          category: departmentTitle(getProductDepartment(product))
        }
      })
    );
  }

  function openProduct(product: Product, title: string, imageProduct = product, group?: ProductGroup) {
    setDetailProduct({ product, imageProduct, title, group });
  }

  function closeProduct() {
    setDetailProduct(null);
  }

  const detailPrice = detailProduct ? displayPrice(detailProduct.product) : "";
  const detailAvailable = detailProduct ? isPurchasableProduct(detailProduct.product) : false;
  const detailIsFarmEgg = Boolean(detailProduct && isFarmEggProduct(detailProduct.product));
  const detailIsHomemadeSoap = Boolean(detailProduct && isHomemadeSoapProduct(detailProduct.product));
  const detailWomensSizeOptions = detailProduct?.group ? womensApparelSizeOptions(detailProduct.group) : [];
  const detailHasWomensSizeOptions = detailWomensSizeOptions.length > 0;
  const detailGroupKey = detailProduct?.group?.key || detailProduct?.product.epos_product_id || "";
  const detailHasTshirtSizes = Boolean(detailProduct && isMensTshirtProduct(detailProduct.product));
  const selectedDetailTshirtSize = selectedSizes[detailGroupKey] || mensTshirtSizes[0];
  const selectedDetailWomensSize =
    selectedSizes[detailGroupKey] ||
    detailWomensSizeOptions.find((option) => option.product?.epos_product_id === detailProduct?.product.epos_product_id)?.label ||
    detailWomensSizeOptions[0]?.label;
  const detailWomensVariantOptions = detailProduct?.group ? womensApparelVariantOptions(detailProduct.group, selectedDetailWomensSize) : [];
  const detailHasWomensVariantOptions = detailWomensVariantOptions.length > 1;
  const selectedDetailWomensVariantLabel =
    selectedVariants[detailGroupKey] ||
    (detailProduct ? womensApparelOptionLabel(detailProduct.product) : "") ||
    detailWomensVariantOptions[0]?.label;
  const detailHasVariants = Boolean(
    detailProduct?.group &&
      (detailHasWomensVariantOptions || (!isWomensApparelGroup(detailProduct.group) && detailProduct.group.products.length > 1 && !hasOnlyWomensSizeVariants(detailProduct.group)))
  );

  return (
    <div className="mt-10">
      <div>
        {message ? (
          <div className="mt-5 rounded-lg border border-ember/20 bg-ember/10 p-5 text-sm font-semibold text-ember">{message}</div>
        ) : null}

        {loading ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="h-72 animate-pulse rounded-lg bg-white/80 shadow-sm" key={index} />
            ))}
          </div>
        ) : null}

        {!loading && !filteredGroups.length && !message ? (
          <div className="mt-5 rounded-lg border border-dashed border-saddle/25 bg-white p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-saddle" />
            <p className="mt-3 font-display text-3xl text-ink">{isGiftBasketCategory ? "Build your own gift basket." : "No products found here yet."}</p>
            <p className="mt-2 text-espresso/70">
              {isGiftBasketCategory
                ? "Please contact us and we will help create a custom gift basket for your occasion."
                : "Try another category from the shop menu."}
            </p>
            {isGiftBasketCategory ? <GiftBasketRequestForm /> : null}
          </div>
        ) : null}

        {!loading && filteredGroups.length ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredGroups.map((group) => {
              const selectedProductId = selectedVariants[group.key];
              const womensSizeOptions = womensApparelSizeOptions(group);
              const hasWomensSizeOptions = womensSizeOptions.length > 0;
              const selectedWomensSize = selectedSizes[group.key] || womensSizeOptions[0]?.label;
              const selectedWomensSizeOption = womensSizeOptions.find((option) => option.label === selectedWomensSize);
              const womensVariantOptions = womensApparelVariantOptions(group, selectedWomensSize);
              const hasWomensVariantOptions = womensVariantOptions.length > 1;
              const defaultWomensVariantLabel = womensApparelOptionLabel(selectedWomensSizeOption?.product || group.products[0]) || womensVariantOptions[0]?.label;
              const selectedWomensVariantLabel = selectedVariants[group.key] || defaultWomensVariantLabel;
              const selectedWomensVariantOption = womensVariantOptions.find((option) => option.label === selectedWomensVariantLabel);
              const selectedVariantProduct = group.products.find((variant) => variant.epos_product_id === selectedProductId);
              const defaultProduct = group.products.find(hasAvailableStock) || group.products[0];
              const product =
                selectedWomensVariantOption?.product ||
                selectedWomensSizeOption?.product ||
                selectedVariantProduct ||
                defaultProduct;
              const imageProduct = product.primary_image_url ? product : group.products.find((variant) => variant.primary_image_url) || product;
              const price = displayPrice(product);
              const hasVariants = hasWomensVariantOptions || (!isWomensApparelGroup(group) && group.products.length > 1 && !hasOnlyWomensSizeVariants(group));
              const hasTshirtSizes = group.products.some(isMensTshirtProduct);
              const selectedTshirtSize = selectedSizes[group.key] || mensTshirtSizes[0];
              const isOutOfStock = !isPurchasableProduct(product);
              const isFarmEgg = isFarmEggProduct(product);
              const isHomemadeSoap = isHomemadeSoapProduct(product);

              return (
                <article className={`group overflow-hidden rounded-lg border border-saddle/15 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-luxe ${isOutOfStock ? "opacity-90" : ""}`} key={group.key}>
                  <button className="relative block aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-espresso via-saddle to-ember text-left" onClick={() => openProduct(product, group.title, imageProduct, group)} type="button">
                    <div className="absolute inset-0 opacity-30 mix-blend-soft-light luxury-pattern" />
                    {imageProduct.primary_image_url ? (
                      <Image
                        alt={imageProduct.primary_image_alt || imageProduct.marketing_title || imageProduct.name}
                        className="absolute inset-0 h-full w-full object-contain transition duration-500 group-hover:scale-105"
                        height={600}
                        quality={92}
                        sizes="(min-width: 1280px) 28vw, (min-width: 768px) 42vw, 92vw"
                        src={imageProduct.primary_image_url}
                        width={800}
                      />
                    ) : (
                      <ProductPhotoFallback />
                    )}
                    {imageProduct.primary_image_url ? <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" /> : null}
                    {isOutOfStock ? (
                      <div className="absolute inset-0 z-10 grid place-items-center bg-ink/55 px-6 text-center backdrop-blur-[1px]">
                        <span className="rotate-[-8deg] rounded-md border-2 border-champagne bg-ink/85 px-5 py-3 text-sm font-black uppercase tracking-[0.24em] text-champagne shadow-luxe">
                          Out of Stock
                        </span>
                      </div>
                    ) : null}
                  </button>
                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-saddle">{departmentTitle(getProductDepartment(product))}</p>
                    <button className="mt-2 block text-left" onClick={() => openProduct(product, group.title, imageProduct, group)} type="button">
                      <h3 className="line-clamp-2 min-h-14 font-display text-2xl leading-tight text-ink hover:text-saddle">{group.title}</h3>
                    </button>
                    {hasWomensSizeOptions ? (
                      <label className="mt-4 grid gap-2 text-sm font-semibold text-espresso">
                        Select size
                        <select
                          className="focus-ring min-h-11 rounded-md border border-saddle/20 bg-ivory px-3 font-normal"
                          onChange={(event) => setSelectedSizes((current) => ({ ...current, [group.key]: event.target.value }))}
                          value={selectedWomensSize}
                        >
                          {womensSizeOptions.map((option) => (
                            <option key={option.label} value={option.label}>
                              {option.label} / {money((option.product || product).sale_price)}
                              {option.product && !hasAvailableStock(option.product) ? " / Out of stock" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {hasVariants ? (
                      <label className="mt-4 grid gap-2 text-sm font-semibold text-espresso">
                        Select option
                        <select
                          className="focus-ring min-h-11 rounded-md border border-saddle/20 bg-ivory px-3 font-normal"
                          onChange={(event) => setSelectedVariants((current) => ({ ...current, [group.key]: event.target.value }))}
                          value={hasWomensVariantOptions ? selectedWomensVariantLabel : product.epos_product_id}
                        >
                          {hasWomensVariantOptions
                            ? womensVariantOptions.map((option) => (
                                <option key={option.label} value={option.label}>
                                  {option.label} / {money(option.product.sale_price)}
                                  {!hasAvailableStock(option.product) ? " / Out of stock" : ""}
                                </option>
                              ))
                            : group.products.map((variant) => (
                                <option key={variant.epos_product_id} value={variant.epos_product_id}>
                                  {variantLabel(variant)} / {money(variant.sale_price)}
                                  {!hasAvailableStock(variant) ? " / Out of stock" : ""}
                                </option>
                              ))}
                        </select>
                      </label>
                    ) : null}
                    {hasTshirtSizes ? (
                      <label className="mt-4 grid gap-2 text-sm font-semibold text-espresso">
                        Select size
                        <select
                          className="focus-ring min-h-11 rounded-md border border-saddle/20 bg-ivory px-3 font-normal"
                          onChange={(event) => setSelectedSizes((current) => ({ ...current, [group.key]: event.target.value }))}
                          value={selectedTshirtSize}
                        >
                          {mensTshirtSizes.map((size) => (
                            <option key={size} value={size}>
                              {size} / {price}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="font-bold text-espresso">{price}</span>
                      <button
                        className="focus-ring inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-ivory hover:bg-saddle disabled:cursor-not-allowed disabled:bg-espresso/30"
                        disabled={!isFarmEgg && (price === "Price in store" || isOutOfStock)}
                        onClick={() => {
                          if (isFarmEgg) {
                            window.location.href = "/contact";
                            return;
                          }

                          addToCart(product, hasTshirtSizes ? selectedTshirtSize : selectedWomensSize);
                        }}
                        type="button"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        {isFarmEgg ? "Contact" : isOutOfStock ? "Sold Out" : "Add"}
                      </button>
                    </div>
                    {isFarmEgg ? <p className="mt-3 text-sm font-semibold text-saddle">Local delivery only. Please contact to place order.</p> : null}
                    {isHomemadeSoap ? <p className="mt-3 text-sm leading-6 text-espresso/65">{homemadeSoapDisclaimer}</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
      {detailProduct ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-ink/65 p-4 backdrop-blur-sm" onClick={closeProduct}>
          <div aria-modal="true" className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-lg bg-ivory shadow-glow" onClick={(event) => event.stopPropagation()} role="dialog">
            <div className="flex items-center justify-between border-b border-saddle/15 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-saddle">Product Details</p>
              <button className="focus-ring rounded-full p-2 text-espresso hover:bg-cream" aria-label="Close product details" onClick={closeProduct} type="button">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-6 p-5 md:grid-cols-[1.1fr_0.9fr] md:p-7">
              <div className="relative min-h-[22rem] overflow-hidden rounded-lg border border-saddle/15 bg-white">
                {detailProduct.imageProduct.primary_image_url ? (
                  <Image
                    alt={detailProduct.imageProduct.primary_image_alt || detailProduct.imageProduct.marketing_title || detailProduct.imageProduct.name}
                    className="object-contain"
                    fill
                    priority
                    quality={95}
                    sizes="(min-width: 768px) 52vw, 92vw"
                    src={detailProduct.imageProduct.primary_image_url}
                  />
                ) : (
                  <ProductPhotoFallback large />
                )}
              </div>
              <div className="self-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-saddle">{departmentTitle(getProductDepartment(detailProduct.product))}</p>
                <h2 className="mt-3 font-display text-4xl leading-tight text-ink">{detailProduct.title}</h2>
                <p className="mt-4 text-2xl font-bold text-espresso">{detailPrice}</p>
                {detailProduct.product.marketing_description || detailProduct.product.description ? (
                  <p className="mt-5 text-base leading-7 text-espresso/75">{detailProduct.product.marketing_description || detailProduct.product.description}</p>
                ) : null}
                {detailIsFarmEgg ? <p className="mt-5 rounded-md bg-cream px-4 py-3 text-sm font-semibold text-saddle">Local delivery only. Please contact to place order.</p> : null}
                {detailIsHomemadeSoap ? <p className="mt-5 rounded-md bg-cream px-4 py-3 text-sm font-semibold leading-6 text-saddle">{homemadeSoapDisclaimer}</p> : null}
                {detailProduct.product.sku ? <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-saddle/75">Style {detailProduct.product.sku}</p> : null}
                {detailHasWomensSizeOptions && detailProduct.group ? (
                  <label className="mt-6 grid gap-2 text-sm font-semibold text-espresso">
                    Select size
                    <select
                      className="focus-ring min-h-11 rounded-md border border-saddle/20 bg-white px-3 font-normal"
                      onChange={(event) => {
                        const nextOption = detailWomensSizeOptions.find((option) => option.label === event.target.value);
                        if (!nextOption || !detailProduct.group) {
                          return;
                        }

                        const nextProduct =
                          womensApparelVariantOptions(detailProduct.group, nextOption.label).find((option) => option.label === selectedDetailWomensVariantLabel)?.product ||
                          nextOption.product ||
                          detailProduct.product ||
                          detailProduct.group.products.find(hasAvailableStock) ||
                          detailProduct.group.products[0];
                        const nextImageProduct = nextProduct.primary_image_url ? nextProduct : detailProduct.group.products.find((variant) => variant.primary_image_url) || nextProduct;
                        setSelectedSizes((current) => ({ ...current, [detailProduct.group!.key]: nextOption.label }));
                        setDetailProduct({ ...detailProduct, product: nextProduct, imageProduct: nextImageProduct });
                      }}
                      value={selectedDetailWomensSize}
                    >
                      {detailWomensSizeOptions.map((option) => (
                        <option key={option.label} value={option.label}>
                          {option.label} / {money((option.product || detailProduct.product).sale_price)}
                          {option.product && !hasAvailableStock(option.product) ? " / Out of stock" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {detailHasVariants && detailProduct.group ? (
                  <label className="mt-6 grid gap-2 text-sm font-semibold text-espresso">
                    Select option
                    <select
                      className="focus-ring min-h-11 rounded-md border border-saddle/20 bg-white px-3 font-normal"
                      onChange={(event) => {
                        if (detailHasWomensVariantOptions && detailProduct.group) {
                          const nextOption = detailWomensVariantOptions.find((option) => option.label === event.target.value);
                          if (!nextOption) {
                            return;
                          }

                          const nextProduct = nextOption.product;
                          const nextImageProduct = nextProduct.primary_image_url ? nextProduct : detailProduct.group.products.find((variant) => variant.primary_image_url) || nextProduct;
                          setSelectedVariants((current) => ({ ...current, [detailProduct.group!.key]: nextOption.label }));
                          setDetailProduct({ ...detailProduct, product: nextProduct, imageProduct: nextImageProduct });
                          return;
                        }

                        const nextProduct = detailProduct.group?.products.find((variant) => variant.epos_product_id === event.target.value);
                        if (!nextProduct || !detailProduct.group) {
                          return;
                        }

                        const nextImageProduct = nextProduct.primary_image_url ? nextProduct : detailProduct.group.products.find((variant) => variant.primary_image_url) || nextProduct;
                        setSelectedVariants((current) => ({ ...current, [detailProduct.group!.key]: nextProduct.epos_product_id }));
                        setDetailProduct({ ...detailProduct, product: nextProduct, imageProduct: nextImageProduct });
                      }}
                      value={detailHasWomensVariantOptions ? selectedDetailWomensVariantLabel : detailProduct.product.epos_product_id}
                    >
                      {detailHasWomensVariantOptions
                        ? detailWomensVariantOptions.map((option) => (
                            <option key={option.label} value={option.label}>
                              {option.label} / {money(option.product.sale_price)}
                              {!hasAvailableStock(option.product) ? " / Out of stock" : ""}
                            </option>
                          ))
                        : detailProduct.group.products.map((variant) => (
                            <option key={variant.epos_product_id} value={variant.epos_product_id}>
                              {variantLabel(variant)} / {money(variant.sale_price)}
                              {!hasAvailableStock(variant) ? " / Out of stock" : ""}
                            </option>
                          ))}
                    </select>
                  </label>
                ) : null}
                {detailHasTshirtSizes ? (
                  <label className="mt-6 grid gap-2 text-sm font-semibold text-espresso">
                    Select size
                    <select
                      className="focus-ring min-h-11 rounded-md border border-saddle/20 bg-white px-3 font-normal"
                      onChange={(event) => setSelectedSizes((current) => ({ ...current, [detailGroupKey]: event.target.value }))}
                      value={selectedDetailTshirtSize}
                    >
                      {mensTshirtSizes.map((size) => (
                        <option key={size} value={size}>
                          {size} / {detailPrice}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <button
                  className="focus-ring mt-7 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-ivory hover:bg-saddle disabled:cursor-not-allowed disabled:bg-espresso/30 sm:w-auto"
                  disabled={!detailIsFarmEgg && (detailPrice === "Price in store" || !detailAvailable)}
                  onClick={() => {
                    if (detailIsFarmEgg) {
                      window.location.href = "/contact";
                      return;
                    }

                    addToCart(detailProduct.product, detailHasTshirtSizes ? selectedDetailTshirtSize : selectedDetailWomensSize);
                  }}
                  type="button"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {detailIsFarmEgg ? "Contact To Order" : detailAvailable ? "Add To Cart" : "Sold Out"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
