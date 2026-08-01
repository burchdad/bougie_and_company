"use client";

import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { bestSellers } from "@/lib/data";

type StorefrontProduct = {
  name: string;
  sale_price: string | null;
  marketing_title: string | null;
};

type ProductResponse = {
  ok: boolean;
  products?: StorefrontProduct[];
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function money(value: string | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `$${parsed.toFixed(2)}` : null;
}

export function ProductShowcase() {
  const [storefrontProducts, setStorefrontProducts] = useState<StorefrontProduct[]>([]);

  useEffect(() => {
    let ignore = false;

    async function loadPrices() {
      try {
        const response = await fetch("/api/products?includeDropship=false&limit=500", { cache: "no-store" });
        const result = (await response.json()) as ProductResponse;
        if (!ignore && response.ok && result.ok) {
          setStorefrontProducts(result.products || []);
        }
      } catch {
        setStorefrontProducts([]);
      }
    }

    loadPrices();
    return () => {
      ignore = true;
    };
  }, []);

  const livePrices = useMemo(() => {
    const prices = new Map<string, string>();
    storefrontProducts.forEach((product) => {
      const price = money(product.sale_price);
      if (!price) {
        return;
      }

      [product.name, product.marketing_title].filter(Boolean).forEach((label) => {
        prices.set(normalize(String(label)), price);
      });
    });
    return prices;
  }, [storefrontProducts]);

  function productPrice(product: (typeof bestSellers)[number]) {
    const productName = normalize(product.name);
    const exactPrice = livePrices.get(productName);
    if (exactPrice) {
      return exactPrice;
    }

    for (const [name, price] of livePrices.entries()) {
      if (name.includes(productName) || productName.includes(name)) {
        return price;
      }
    }

    return product.price;
  }

  function addProduct(product: (typeof bestSellers)[number]) {
    window.dispatchEvent(
      new CustomEvent("bougie:add-to-cart", {
        detail: {
          name: product.name,
          price: productPrice(product),
          category: product.category
        }
      })
    );
  }

  return (
    <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {bestSellers.map((product, index) => (
        <article className="group overflow-hidden rounded-lg border border-saddle/15 bg-ivory shadow-sm transition hover:-translate-y-1 hover:shadow-luxe" key={product.name}>
          <div className={`relative aspect-[4/5] overflow-hidden bg-gradient-to-br ${product.tone}`}>
            <Image
              alt={product.imageAlt}
              className="object-cover transition duration-500 group-hover:scale-105"
              fill
              priority={index === 0}
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
              src={product.image}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent" />
            <span className="absolute right-4 top-4 rounded-full bg-ink/55 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-champagne">
              0{index + 1}
            </span>
          </div>
          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-saddle">{product.category}</p>
            <h3 className="mt-2 font-display text-2xl text-ink">{product.name}</h3>
            <p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-espresso/65">{product.description}</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="font-bold text-espresso">{productPrice(product)}</span>
              <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-ivory hover:bg-saddle" onClick={() => addProduct(product)} type="button">
                <ShoppingBag className="h-4 w-4" />
                Add
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
