"use client";

import { ShoppingBag, Star } from "lucide-react";
import { bestSellers } from "@/lib/data";

export function ProductShowcase() {
  function addProduct(product: (typeof bestSellers)[number]) {
    window.dispatchEvent(
      new CustomEvent("bougie:add-to-cart", {
        detail: {
          name: product.name,
          price: product.price,
          category: product.category
        }
      })
    );
  }

  return (
    <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
      {bestSellers.map((product, index) => (
        <article className="group overflow-hidden rounded-lg border border-saddle/15 bg-ivory shadow-sm transition hover:-translate-y-1 hover:shadow-luxe" key={product.name}>
          <div className={`relative flex aspect-[4/5] items-end overflow-hidden bg-gradient-to-br ${product.tone} p-5 text-ivory`}>
            <div className="absolute inset-0 opacity-35 mix-blend-soft-light luxury-pattern" />
            <span className="absolute right-4 top-4 rounded-full bg-ink/45 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-champagne">
              0{index + 1}
            </span>
            <div className="relative">
              <Star className="h-7 w-7 fill-champagne text-champagne" />
              <p className="mt-5 font-display text-3xl leading-tight">{product.name}</p>
            </div>
          </div>
          <div className="p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-saddle">{product.category}</p>
            <h3 className="mt-2 font-display text-2xl text-ink">{product.name}</h3>
            <p className="mt-2 min-h-[4.5rem] text-sm leading-6 text-espresso/65">{product.description}</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="font-bold text-espresso">{product.price}</span>
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
