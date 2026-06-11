"use client";

import Image from "next/image";
import { ShoppingBag, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type DetailProduct = {
  product: Product;
  imageProduct: Product;
  title: string;
};

const variantWords = [
  "xxs",
  "xs",
  "small",
  "medium",
  "large",
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
  "black",
  "blue",
  "brown",
  "charcoal",
  "coral",
  "cream",
  "graphite",
  "gray",
  "green",
  "grey",
  "ivory",
  "navy",
  "pink",
  "purple",
  "red",
  "skye",
  "tan",
  "teal",
  "turquoise",
  "white",
  "yellow"
];

const categoryKeywordMap: Record<string, string[]> = {
  accessories: ["purse", "bag", "luggage", "weekender", "coozie", "koozie", "coaster", "infusion", "cocktail", "cap", "hat"],
  "bath-body": ["bath", "body", "scrub", "salt", "bomb", "chap", "mask", "lotion", "soap", "beard", "spray", "week from hell", "shampoo"],
  "bath-bombs": ["bath bomb"],
  "bath-salts": ["bath salt"],
  "beard-products": ["beard"],
  "body-butter-lotion": ["body butter", "lotion"],
  "body-scrubs": ["body scrub", "scrub"],
  "body-spray": ["body spray", "body sprays"],
  "body-sprays": ["body spray", "body sprays"],
  "chap-stick": ["chap stick", "chapstick"],
  candles: ["candle"],
  "clay-masks": ["clay mask"],
  clothing: ["shirt", "tee", "t-shirt", "top", "bottom", "dress", "romper", "jumpsuit", "cardigan", "jean", "short", "pant", "skirt"],
  "cocktail-infusions": ["cocktail", "infusion", "mixer"],
  "cocktail-mixers": ["cocktail", "mixer"],
  coasters: ["coaster"],
  coozies: ["coozie", "koozie"],
  dresses: ["dress"],
  earrings: ["earring"],
  "equine-jewelry": ["equine", "horse", "rein", "snaffle", "necklace", "bracelet", "earring"],
  "foaming-hand-soap": ["foaming hand"],
  "gift-certificates": ["gift certificate"],
  "gift-collection": ["gift", "certificate", "set"],
  "gift-sets": ["gift set"],
  "handmade-soaps": ["handmade soap", "homemade soap"],
  headbands: ["headband"],
  "home-collection": ["candle", "wax", "melt", "tea towel", "pillow", "coaster", "mixer", "outdoor"],
  homemade: ["homemade"],
  "homemade-dish-soap": ["dish soap"],
  "homemade-mechanic-soaps": ["mechanic soap", "mechanic soaps"],
  "jewelry-headbands": ["jewelry", "headband", "earring", "bracelet", "necklace"],
  "kitchen-collection": ["dish soap", "foaming hand", "kitchen"],
  "kitchen-selection": ["dish soap", "foaming hand", "kitchen"],
  "leather-coasters": ["leather coaster"],
  luggage: ["luggage", "weekender", "duffle", "travel"],
  "mens-care": ["men", "beard", "mechanic", "body spray", "shampoo", "chap"],
  "mens-collection": ["men", "beard", "mechanic", "cap", "t-shirt", "body spray", "shampoo"],
  necklaces: ["necklace"],
  "outdoor-items": ["outdoor"],
  purses: ["purse", "bag"],
  regular: ["regular coaster"],
  "rompers-jumpsuits": ["romper", "jumpsuit"],
  "soy-9oz": ["9oz", "9 oz", "soy"],
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

function stockCount(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasAvailableStock(product: Product) {
  return stockCount(product.stock) > 0;
}

function getProductDepartment(product: Product) {
  return inferDepartment(product) || "all";
}

function productSearchText(product: Product) {
  return `${product.name} ${product.marketing_title || ""} ${product.description || ""} ${product.marketing_description || ""} ${product.sku || ""}`.toLowerCase();
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

function variantLabel(product: Product) {
  const title = cleanProductTitle(product);
  const sku = product.sku || "";
  const lowerTitle = title.toLowerCase();

  const explicitSize = lowerTitle.match(/\b(xxs|xs|small|medium|large|xl|xxl|xxxl|s|m|l|2x|3x|4x|5x|one size|os)\b/);
  if (explicitSize?.[1]) {
    return explicitSize[1].toUpperCase();
  }

  const skuSize = sku.match(/(?:^|[-_\s])(xxs|xs|s|m|l|xl|xxl|xxxl|2x|3x|4x|5x|os)(?:$|[-_\s])/i);
  if (skuSize?.[1]) {
    return skuSize[1].toUpperCase();
  }

  const withoutSku = title.replace(/^[A-Z]{2,}\d+[A-Z0-9-]*\s+/i, "").trim();
  const titleWords = withoutSku.split(/\s+/);
  const colorWords = titleWords.filter((word) => apparelColorWords.includes(word.toLowerCase()));
  if (colorWords.length) {
    return colorWords.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
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

  title = words.join(" ");
  title = title.replace(/\b\d+x\b/g, " ");
  title = title.replace(/\s*[-|/]\s*$/g, " ");
  return title.replace(/[^a-z0-9]+/g, " ").trim();
}

function groupKey(product: Product) {
  return normalizedVariantBaseTitle(product) || product.epos_product_id;
}

function groupTitle(product: Product) {
  const baseTitle = normalizedVariantBaseTitle(product);
  if (!baseTitle || baseTitle === product.epos_product_id) {
    return titleWithoutLeadingSku(cleanProductTitle(product)).replace(/\b(Size|SZ)\b\s*[:#-]?\s*/gi, "").trim();
  }

  return baseTitle.replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  return [...groups.values()].map((group) => ({
    ...group,
    products: group.products.sort((a, b) => {
      const stockSort = Number(hasAvailableStock(b)) - Number(hasAvailableStock(a));
      return stockSort || variantLabel(a).localeCompare(variantLabel(b), undefined, { numeric: true });
    })
  }));
}

export function ShopProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeDepartment, setActiveDepartment] = useState("all");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
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
  const isComingSoonCategory = activeDepartment === "tack";

  function addToCart(product: Product) {
    if (!hasAvailableStock(product)) {
      return;
    }

    window.dispatchEvent(
      new CustomEvent("bougie:add-to-cart", {
        detail: {
          id: product.epos_product_id,
          name: product.marketing_title || product.name,
          price: money(product.sale_price),
          category: departmentTitle(getProductDepartment(product))
        }
      })
    );
  }

  function openProduct(product: Product, title: string, imageProduct = product) {
    setDetailProduct({ product, imageProduct, title });
  }

  function closeProduct() {
    setDetailProduct(null);
  }

  const detailPrice = detailProduct ? money(detailProduct.product.sale_price) : "";
  const detailAvailable = detailProduct ? hasAvailableStock(detailProduct.product) : false;

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
            <p className="mt-3 font-display text-3xl text-ink">{isComingSoonCategory ? "Coming soon." : "No products found here yet."}</p>
            <p className="mt-2 text-espresso/70">{isComingSoonCategory ? "Tack products will be added when they are ready." : "Try another category from the shop menu."}</p>
          </div>
        ) : null}

        {!loading && filteredGroups.length ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredGroups.map((group) => {
              const selectedProductId = selectedVariants[group.key];
              const product = group.products.find((variant) => variant.epos_product_id === selectedProductId) || group.products.find(hasAvailableStock) || group.products[0];
              const imageProduct = product.primary_image_url ? product : group.products.find((variant) => variant.primary_image_url) || product;
              const price = money(product.sale_price);
              const hasVariants = group.products.length > 1;
              const isOutOfStock = !hasAvailableStock(product);

              return (
                <article className={`group overflow-hidden rounded-lg border border-saddle/15 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-luxe ${isOutOfStock ? "opacity-90" : ""}`} key={group.key}>
                  <button className="relative block aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-espresso via-saddle to-ember text-left" onClick={() => openProduct(product, group.title, imageProduct)} type="button">
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
                    ) : null}
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
                    <button className="mt-2 block text-left" onClick={() => openProduct(product, group.title, imageProduct)} type="button">
                      <h3 className="line-clamp-2 min-h-14 font-display text-2xl leading-tight text-ink hover:text-saddle">{group.title}</h3>
                    </button>
                    {hasVariants ? (
                      <label className="mt-4 grid gap-2 text-sm font-semibold text-espresso">
                        Select option
                        <select
                          className="focus-ring min-h-11 rounded-md border border-saddle/20 bg-ivory px-3 font-normal"
                          onChange={(event) => setSelectedVariants((current) => ({ ...current, [group.key]: event.target.value }))}
                          value={product.epos_product_id}
                        >
                          {group.products.map((variant) => (
                            <option key={variant.epos_product_id} value={variant.epos_product_id}>
                              {variantLabel(variant)} / {money(variant.sale_price)}
                              {!hasAvailableStock(variant) ? " / Out of stock" : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="font-bold text-espresso">{price}</span>
                      <button
                        className="focus-ring inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-ivory hover:bg-saddle disabled:cursor-not-allowed disabled:bg-espresso/30"
                        disabled={price === "Price in store" || isOutOfStock}
                        onClick={() => addToCart(product)}
                        type="button"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        {isOutOfStock ? "Sold Out" : "Add"}
                      </button>
                    </div>
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
                  <div className="grid h-full min-h-[22rem] place-items-center bg-gradient-to-br from-espresso via-saddle to-ember text-ivory">
                    <Sparkles className="h-10 w-10 text-champagne" />
                  </div>
                )}
              </div>
              <div className="self-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-saddle">{departmentTitle(getProductDepartment(detailProduct.product))}</p>
                <h2 className="mt-3 font-display text-4xl leading-tight text-ink">{detailProduct.title}</h2>
                <p className="mt-4 text-2xl font-bold text-espresso">{detailPrice}</p>
                {detailProduct.product.marketing_description || detailProduct.product.description ? (
                  <p className="mt-5 text-base leading-7 text-espresso/75">{detailProduct.product.marketing_description || detailProduct.product.description}</p>
                ) : null}
                {detailProduct.product.sku ? <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-saddle/75">Style {detailProduct.product.sku}</p> : null}
                <button
                  className="focus-ring mt-7 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-ivory hover:bg-saddle disabled:cursor-not-allowed disabled:bg-espresso/30 sm:w-auto"
                  disabled={detailPrice === "Price in store" || !detailAvailable}
                  onClick={() => addToCart(detailProduct.product)}
                  type="button"
                >
                  <ShoppingBag className="h-4 w-4" />
                  {detailAvailable ? "Add To Cart" : "Sold Out"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
