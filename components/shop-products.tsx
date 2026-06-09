"use client";

import Image from "next/image";
import { Search, ShoppingBag, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { defaultMenuItems } from "@/lib/category-defaults";
import { departmentTitle, inferDepartment } from "@/lib/product-categorization";
import type { CategoryMenuItem } from "@/lib/category-defaults";

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

type FilterCategory = {
  id: string;
  label: string;
  href: string;
  depth: number;
  parentId: string | null;
};

type CategoryResponse = {
  ok: boolean;
  menu?: CategoryMenuItem[];
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

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "category";
}

function hashFromHref(href: string) {
  const hash = href.split("#")[1];
  return hash ? slugify(hash) : "";
}

function uniqueCategoryId(item: CategoryMenuItem, parentId: string | null, seen: Set<string>) {
  const hrefHash = hashFromHref(item.href);
  const labelSlug = slugify(item.label);
  const baseId = parentId && hrefHash === parentId ? labelSlug : hrefHash || labelSlug;
  const id = seen.has(baseId) && parentId ? `${parentId}-${labelSlug}` : baseId;
  seen.add(id);
  return id;
}

function flattenMenuItems(items: CategoryMenuItem[], depth = 0, parentId: string | null = null, seen = new Set<string>()): FilterCategory[] {
  return items.flatMap((item) => {
    const id = uniqueCategoryId(item, parentId, seen);
    return [
      { id, label: item.label, href: `/shop#${id}`, depth, parentId },
      ...flattenMenuItems(item.children || [], depth + 1, id, seen)
    ];
  });
}

const fallbackFilterCategories = flattenMenuItems(defaultMenuItems);

function money(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `$${parsed.toFixed(2)}` : "Price in store";
}

function stockCount(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

  return sku || product.epos_product_id;
}

function groupKey(product: Product) {
  let title = cleanProductTitle(product).toLowerCase();
  title = title.replace(/\b(size|sz)\s*[:#-]?\s*/g, " ");
  variantWords.forEach((word) => {
    title = title.replace(new RegExp(`\\b${word.replace(" ", "\\s+")}\\b`, "gi"), " ");
  });
  title = title.replace(/\b\d+x\b/g, " ");
  title = title.replace(/\s*[-|/]\s*$/g, " ");
  return title.replace(/[^a-z0-9]+/g, " ").trim() || product.epos_product_id;
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
      title: cleanProductTitle(product).replace(/\b(Size|SZ)\b\s*[:#-]?\s*/gi, "").trim(),
      products: [product]
    });
  });

  return [...groups.values()].map((group) => ({
    ...group,
    products: group.products.sort((a, b) => variantLabel(a).localeCompare(variantLabel(b), undefined, { numeric: true }))
  }));
}

export function ShopProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [activeDepartment, setActiveDepartment] = useState("all");
  const [filterCategories, setFilterCategories] = useState<FilterCategory[]>(fallbackFilterCategories);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
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
          setMessage(result.message || "The live product catalog is not ready yet.");
          return;
        }

        if (!ignore) {
          setProducts(result.products || []);
        }
      } catch {
        if (!ignore) {
          setMessage("The live product catalog could not be reached.");
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
    let ignore = false;

    async function loadCategories() {
      try {
        const response = await fetch("/api/categories", { cache: "no-store" });
        const result = (await response.json()) as CategoryResponse;

        if (!ignore && result.ok && result.menu?.length) {
          setFilterCategories(flattenMenuItems(result.menu));
        }
      } catch {
        if (!ignore) {
          setFilterCategories(fallbackFilterCategories);
        }
      }
    }

    loadCategories();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    function applyHash() {
      const nextDepartment = window.location.hash.replace("#", "");
      if (nextDepartment && filterCategories.some((category) => category.id === nextDepartment)) {
        setActiveDepartment(nextDepartment);
      }
    }

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [filterCategories]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const searchable = productSearchText(product);
      const matchesQuery = !query || searchable.includes(query.toLowerCase());
      const matchesDepartment = productMatchesFilter(product, activeDepartment);
      return matchesQuery && matchesDepartment;
    });
  }, [activeDepartment, products, query]);

  const filteredGroups = useMemo(() => groupProducts(filteredProducts), [filteredProducts]);
  const allGroups = useMemo(() => groupProducts(products), [products]);

  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    filterCategories.forEach((category) => counts.set(category.id, 0));
    allGroups.forEach((group) => {
      filterCategories.forEach((category) => {
        if (group.products.some((product) => productMatchesFilter(product, category.id))) {
          counts.set(category.id, (counts.get(category.id) || 0) + 1);
        }
      });
    });
    return counts;
  }, [allGroups, filterCategories]);

  const activeCategoryLabel = activeDepartment === "all" ? "All Products" : filterCategories.find((category) => category.id === activeDepartment)?.label || departmentTitle(activeDepartment);

  function addToCart(product: Product) {
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

  return (
    <div className="mt-10 grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="rounded-lg border border-saddle/15 bg-white/90 p-4 shadow-luxe lg:sticky lg:top-44 lg:self-start">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-saddle">
          <SlidersHorizontal className="h-4 w-4" />
          Filter
        </div>
        <label className="mt-4 grid gap-2 text-sm font-semibold text-espresso">
          Search products
          <span className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-saddle" />
            <input
              className="focus-ring min-h-11 w-full rounded-md border border-saddle/20 bg-ivory pl-10 pr-3 font-normal"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Dresses, candles, soaps..."
              value={query}
            />
          </span>
        </label>
        <div className="mt-5 grid gap-2">
          <button
            className={`focus-ring flex items-center justify-between rounded-md px-3 py-2 text-left text-sm font-bold ${activeDepartment === "all" ? "bg-ink text-ivory" : "bg-cream text-espresso hover:bg-champagne/30"}`}
            onClick={() => {
              setActiveDepartment("all");
              window.history.replaceState(null, "", "/shop");
            }}
            type="button"
          >
            All Products
            <span>{allGroups.length}</span>
          </button>
          {filterCategories.map((department) => (
            <button
              className={`focus-ring flex items-center justify-between rounded-md px-3 py-2 text-left text-sm font-bold ${activeDepartment === department.id ? "bg-ink text-ivory" : "bg-cream text-espresso hover:bg-champagne/30"}`}
              key={department.id}
              onClick={() => {
                setActiveDepartment(department.id);
                window.history.replaceState(null, "", `/shop#${department.id}`);
              }}
              style={{ paddingLeft: `${0.75 + department.depth * 0.85}rem` }}
              type="button"
            >
              <span className={department.depth ? "text-xs uppercase tracking-[0.08em]" : ""}>{department.label}</span>
              <span>{departmentCounts.get(department.id) || 0}</span>
            </button>
          ))}
        </div>
      </aside>

      <div>
        <div className="rounded-lg bg-ink p-5 text-ivory shadow-luxe">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-champagne">Live Epos Catalog</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-4xl">{activeCategoryLabel}</h2>
            <p className="text-sm font-semibold text-ivory/75">{loading ? "Loading inventory..." : `${filteredGroups.length} products showing`}</p>
          </div>
        </div>

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
            <p className="mt-3 font-display text-3xl text-ink">No products found here yet.</p>
            <p className="mt-2 text-espresso/70">Try another department or clear the search.</p>
          </div>
        ) : null}

        {!loading && filteredGroups.length ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredGroups.map((group, index) => {
              const selectedProductId = selectedVariants[group.key];
              const product = group.products.find((variant) => variant.epos_product_id === selectedProductId) || group.products[0];
              const stock = stockCount(product.stock);
              const price = money(product.sale_price);
              const hasVariants = group.products.length > 1;

              return (
                <article className="group overflow-hidden rounded-lg border border-saddle/15 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-luxe" key={group.key}>
                  <div className="relative flex aspect-[4/3] items-end overflow-hidden bg-gradient-to-br from-espresso via-saddle to-ember p-5 text-ivory">
                    <div className="absolute inset-0 opacity-30 mix-blend-soft-light luxury-pattern" />
                    {product.primary_image_url ? (
                      <Image
                        alt={product.primary_image_alt || product.marketing_title || product.name}
                        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        height={600}
                        src={product.primary_image_url}
                        width={800}
                      />
                    ) : null}
                    {product.primary_image_url ? <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" /> : null}
                    <span className="absolute right-4 top-4 z-10 rounded-full bg-ink/50 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-champagne">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div className="relative">
                      <ShoppingBag className="h-7 w-7 text-champagne" />
                      <p className="mt-4 line-clamp-2 font-display text-3xl leading-tight">{group.title}</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-saddle">{departmentTitle(getProductDepartment(product))}</p>
                    <h3 className="mt-2 line-clamp-2 min-h-16 font-display text-2xl leading-tight text-ink">{group.title}</h3>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-espresso/65">
                      {product.marketing_description || product.description || (product.sku ? `SKU ${product.sku}` : "Synced from Bougie & Company inventory.")}
                    </p>
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
                              {variantLabel(variant)} / {money(variant.sale_price)} / {stockCount(variant.stock)} in stock
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em]">
                      <span className={`rounded-full px-3 py-1 ${stock > 0 ? "bg-moss/15 text-moss" : "bg-champagne/20 text-saddle"}`}>
                        {stock > 0 ? `${stock} in stock` : "Confirm availability"}
                      </span>
                      {product.sku ? <span className="rounded-full bg-cream px-3 py-1 text-saddle">SKU {product.sku}</span> : null}
                    </div>
                    <div className="mt-5 flex items-center justify-between gap-3">
                      <span className="font-bold text-espresso">{price}</span>
                      <button
                        className="focus-ring inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-ivory hover:bg-saddle disabled:cursor-not-allowed disabled:bg-espresso/30"
                        disabled={price === "Price in store"}
                        onClick={() => addToCart(product)}
                        type="button"
                      >
                        <ShoppingBag className="h-4 w-4" />
                        Add
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
