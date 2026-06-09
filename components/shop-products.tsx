"use client";

import Image from "next/image";
import { Search, ShoppingBag, SlidersHorizontal, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { shopDepartments } from "@/lib/data";
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

export function ShopProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [activeDepartment, setActiveDepartment] = useState("all");
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

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const searchable = `${product.name} ${product.description || ""} ${product.sku || ""}`.toLowerCase();
      const matchesQuery = !query || searchable.includes(query.toLowerCase());
      const matchesDepartment = activeDepartment === "all" || getProductDepartment(product) === activeDepartment;
      return matchesQuery && matchesDepartment;
    });
  }, [activeDepartment, products, query]);

  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product) => {
      const department = getProductDepartment(product);
      counts.set(department, (counts.get(department) || 0) + 1);
    });
    return counts;
  }, [products]);

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
            onClick={() => setActiveDepartment("all")}
            type="button"
          >
            All Products
            <span>{products.length}</span>
          </button>
          {shopDepartments.map((department) => (
            <button
              className={`focus-ring flex items-center justify-between rounded-md px-3 py-2 text-left text-sm font-bold ${activeDepartment === department.id ? "bg-ink text-ivory" : "bg-cream text-espresso hover:bg-champagne/30"}`}
              key={department.id}
              onClick={() => setActiveDepartment(department.id)}
              type="button"
            >
              {department.title}
              <span>{departmentCounts.get(department.id) || 0}</span>
            </button>
          ))}
        </div>
      </aside>

      <div>
        <div className="rounded-lg bg-ink p-5 text-ivory shadow-luxe">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-champagne">Live Epos Catalog</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-4xl">{departmentTitle(activeDepartment)}</h2>
            <p className="text-sm font-semibold text-ivory/75">{loading ? "Loading inventory..." : `${filteredProducts.length} products showing`}</p>
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

        {!loading && !filteredProducts.length && !message ? (
          <div className="mt-5 rounded-lg border border-dashed border-saddle/25 bg-white p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-saddle" />
            <p className="mt-3 font-display text-3xl text-ink">No products found here yet.</p>
            <p className="mt-2 text-espresso/70">Try another department or clear the search.</p>
          </div>
        ) : null}

        {!loading && filteredProducts.length ? (
          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product, index) => {
              const stock = stockCount(product.stock);
              const price = money(product.sale_price);

              return (
                <article className="group overflow-hidden rounded-lg border border-saddle/15 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-luxe" key={product.epos_product_id}>
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
                      <p className="mt-4 line-clamp-2 font-display text-3xl leading-tight">{product.marketing_title || product.name}</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-saddle">{departmentTitle(getProductDepartment(product))}</p>
                    <h3 className="mt-2 line-clamp-2 min-h-16 font-display text-2xl leading-tight text-ink">{product.marketing_title || product.name}</h3>
                    <p className="mt-2 min-h-12 text-sm leading-6 text-espresso/65">
                      {product.marketing_description || product.description || (product.sku ? `SKU ${product.sku}` : "Synced from Bougie & Company inventory.")}
                    </p>
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
