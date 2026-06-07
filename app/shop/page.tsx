import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { shopDepartments } from "@/lib/data";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shop Bougie & Company Boutique collections including clothing, equine jewelry, accessories, bath and body, home goods, men's products, and gift sets."
};

export default function ShopPage() {
  return (
    <section className="grain bg-ivory px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-saddle">Shop</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl text-ink sm:text-6xl">Curated luxury with Texas roots.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-espresso/75">
          Browse boutique clothing, equine jewelry, home goods, bath and body, gifts, men&apos;s care, and outdoor goods prepared for future ecommerce integration.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {shopDepartments.map((department) => (
            <article className="rounded-lg border border-saddle/15 bg-white p-6 shadow-sm" id={department.id} key={department.id}>
              <ShoppingBag className="h-7 w-7 text-saddle" />
              <h2 className="mt-6 font-display text-3xl text-ink">{department.title}</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {department.items.map((item) => (
                  <span className="rounded-full border border-saddle/15 bg-cream px-3 py-2 text-sm text-espresso/80" key={item}>{item}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
