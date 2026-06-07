import type { Metadata } from "next";
import { ChevronDown, ShoppingBag } from "lucide-react";
import { shopDepartments } from "@/lib/data";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shop Bougie & Company Boutique collections including clothing, equine jewelry, accessories, bath and body, home goods, men's products, women's care, kitchen goods, gift certificates, jewelry, and headbands."
};

export default function ShopPage() {
  return (
    <section className="grain bg-ivory px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-saddle">Shop</p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl text-ink sm:text-6xl">Curated luxury with Texas roots.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-espresso/75">
          Browse boutique clothing, equine jewelry, home goods, bath and body, gifts, men&apos;s care, women&apos;s care, kitchen goods, and accessories prepared for future ecommerce integration.
        </p>
        <div className="mt-10 overflow-hidden rounded-lg border border-saddle/15 bg-white shadow-luxe">
          {shopDepartments.map((department) => (
            <details className="group border-b border-saddle/15 last:border-b-0" id={department.id} key={department.id}>
              <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-5 text-left hover:bg-cream sm:px-7">
                <span className="flex items-center gap-4">
                  <ShoppingBag className="h-6 w-6 text-saddle" />
                  <span className="font-display text-3xl text-ink">{department.title}</span>
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-saddle transition group-open:rotate-180" />
              </summary>
              <div className="flex flex-wrap gap-2 px-5 pb-6 sm:px-7">
                {department.items.map((item) => (
                  <span className="rounded-full border border-saddle/15 bg-cream px-3 py-2 text-sm text-espresso/80" key={item}>{item}</span>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
