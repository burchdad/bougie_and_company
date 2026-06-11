import type { Metadata } from "next";
import { ShopProducts } from "@/components/shop-products";

export const metadata: Metadata = {
  title: "Shop",
  description: "Shop Bougie & Company Boutique collections including clothing, equine jewelry, accessories, bath and body, home goods, men's products, women's care, kitchen goods, gift certificates, jewelry, and headbands."
};

export default function ShopPage() {
  return (
    <section className="sunset-band px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-[1fr_0.6fr] md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-saddle">Shop</p>
            <h1 className="mt-4 max-w-3xl font-display text-5xl text-ink sm:text-6xl">Curated luxury with Texas roots.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-espresso/75">
              Browse a polished boutique edit of clothing, equine jewelry, home goods, bath and body, gifts, men&apos;s care, women&apos;s care, kitchen goods, and accessories.
            </p>
          </div>
          <div className="rounded-lg bg-ink p-6 text-ivory shadow-luxe">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-champagne">Boutique Departments</p>
            <p className="mt-3 font-display text-4xl">Fresh arrivals, thoughtful gifts, and everyday luxuries.</p>
          </div>
        </div>
        <ShopProducts />
      </div>
    </section>
  );
}
