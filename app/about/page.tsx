import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "About Us",
  description: "Meet the owners behind Bougie & Company Boutique, a luxury Texas boutique and mercantile based in Rusk."
};

const values = ["Luxury without losing the roots", "Thoughtfully curated products", "Modern Southern hospitality", "Gifting made personal"];

export default function AboutPage() {
  return (
    <section className="bg-ivory">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[0.95fr_1.05fr] lg:px-8">
        <div className="relative min-h-[620px] overflow-hidden rounded-lg border border-saddle/15 shadow-luxe">
          <Image src="/images/owners.png" alt="Bougie & Company owners" fill className="object-cover object-[50%_24%]" priority sizes="(min-width: 768px) 45vw, 100vw" />
        </div>
        <div className="self-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-saddle">About Us</p>
          <h1 className="mt-4 font-display text-5xl leading-tight text-ink sm:text-6xl">Country roots with an eye for the elevated.</h1>
          <p className="mt-6 text-lg leading-8 text-espresso/75">
            Bougie & Company Boutique was built for customers who love the confidence of a polished boutique experience and the warmth of Texas living. The brand brings together clothing, equine jewelry, home goods, gifts, self-care, and men&apos;s products in a clean, luxury mercantile setting.
          </p>
        </div>
      </div>
      <div className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
          {["Foundation", "Curation", "Experience"].map((item, index) => (
            <div className="rounded-lg border border-saddle/15 bg-ivory p-6" key={item}>
              <p className="text-sm font-bold text-saddle">0{index + 1}</p>
              <h2 className="mt-4 font-display text-3xl text-ink">{item}</h2>
              <p className="mt-3 text-sm leading-7 text-espresso/70">
                {index === 0 ? "Rooted in Rusk, Texas and shaped by a love for Southern character." : index === 1 ? "Products are selected for quality, usefulness, beauty, and giftability." : "Every touchpoint should feel premium, simple to shop, and personally welcoming."}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-ink px-4 py-16 text-ivory sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-champagne">Mission</p>
            <h2 className="mt-4 font-display text-4xl">Make everyday shopping feel dressed up.</h2>
          </div>
          <div className="grid gap-3">
            {values.map((value) => (
              <div className="rounded-lg border border-ivory/12 bg-white/6 px-5 py-4 text-ivory/80" key={value}>{value}</div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
