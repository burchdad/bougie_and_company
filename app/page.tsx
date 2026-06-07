import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Music2, Star } from "lucide-react";
import { AnimatedSection } from "@/components/animated-section";
import { bestSellers, categories, lifestyles } from "@/lib/data";

export default function HomePage() {
  return (
    <>
      <section className="grain overflow-hidden bg-ivory">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-10 sm:px-6 md:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-16">
          <div className="order-2 md:order-1">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-saddle">Luxury Texas Boutique</p>
            <h1 className="mt-4 font-display text-5xl font-semibold leading-[0.95] text-ink sm:text-6xl lg:text-7xl">
              Bougie & Company
            </h1>
            <p className="mt-5 font-display text-3xl text-saddle sm:text-4xl">
              Country Roots. <br /> Luxury Taste.
            </p>
            <p className="mt-6 max-w-xl text-lg leading-8 text-espresso/75">
              Boutique Fashion / Gifts / Home / Self Care
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="focus-ring rounded-md bg-ink px-6 py-4 text-center text-sm font-bold uppercase tracking-[0.2em] text-ivory hover:bg-saddle" href="/shop">
                Shop Collection
              </Link>
              <Link className="focus-ring rounded-md border border-saddle/30 px-6 py-4 text-center text-sm font-bold uppercase tracking-[0.2em] text-espresso hover:bg-cream" href="/about">
                Our Story
              </Link>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-champagne/35 bg-espresso shadow-glow md:min-h-[680px]">
              <Image src="/images/owners.png" alt="Bougie & Company owners" fill className="object-cover object-[50%_28%]" priority sizes="(min-width: 768px) 52vw, 100vw" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-6">
                <Image src="/images/logo.png" alt="" width={110} height={110} className="h-20 w-20 rounded-full bg-ivory object-contain p-1" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <AnimatedSection className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-saddle">Featured Categories</p>
              <h2 className="mt-3 font-display text-4xl text-ink">Shop the Boutique Edit</h2>
            </div>
            <Link href="/shop" className="text-sm font-bold uppercase tracking-[0.2em] text-saddle hover:text-ink">View All</Link>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map(({ name, href, icon: Icon, tone }) => (
              <Link href={href} key={name} className={`group rounded-lg border border-saddle/15 bg-gradient-to-br ${tone} p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-luxe`}>
                <Icon className="h-8 w-8 text-saddle" />
                <h3 className="mt-8 font-display text-3xl text-ink">{name}</h3>
                <p className="mt-3 text-sm leading-6 text-espresso/65">Curated pieces with polished Southern character.</p>
              </Link>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-cream px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-saddle">Best Sellers</p>
          <h2 className="mt-3 font-display text-4xl text-ink">Customer Favorites</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {bestSellers.map((product) => (
              <article className="rounded-lg border border-saddle/15 bg-ivory p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-luxe" key={product.name}>
                <div className="flex aspect-[4/5] items-center justify-center rounded-md bg-gradient-to-br from-espresso via-saddle to-champagne p-6 text-center text-ivory">
                  <div>
                    <Star className="mx-auto h-8 w-8 fill-champagne text-champagne" />
                    <p className="mt-5 font-display text-3xl">{product.name}</p>
                  </div>
                </div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-saddle">{product.category}</p>
                <h3 className="mt-2 font-display text-2xl text-ink">{product.name}</h3>
                <p className="mt-2 text-sm leading-6 text-espresso/65">{product.description}</p>
                <div className="mt-5 flex items-center justify-between">
                  <span className="font-bold text-espresso">{product.price}</span>
                  <button className="focus-ring rounded-md bg-ink px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-ivory hover:bg-saddle" type="button">Add</button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-white px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-2">
          <div className="relative min-h-[460px] overflow-hidden rounded-lg border border-saddle/15 shadow-luxe">
            <Image src="/images/owners.png" alt="Bougie & Company owners standing in front of rustic wood doors" fill className="object-cover object-[50%_23%]" sizes="(min-width: 768px) 50vw, 100vw" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-saddle">About The Owners</p>
            <h2 className="mt-3 font-display text-4xl text-ink">A Modern Southern Mercantile</h2>
            <p className="mt-5 text-lg leading-8 text-espresso/75">
              Bougie & Company blends country roots with luxury taste, bringing together boutique fashion, equine-inspired jewelry, thoughtful gifts, home goods, and self-care essentials from Rusk, Texas.
            </p>
            <Link className="focus-ring mt-7 inline-flex rounded-md bg-ink px-6 py-4 text-sm font-bold uppercase tracking-[0.2em] text-ivory hover:bg-saddle" href="/about">
              Read Our Story
            </Link>
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-ink px-4 py-16 text-ivory sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-champagne">Shop By Lifestyle</p>
          <h2 className="mt-3 font-display text-4xl">Polished Finds For Every Corner Of Life</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-4">
            {lifestyles.map(({ title, text, icon: Icon }) => (
              <div className="rounded-lg border border-ivory/12 bg-white/6 p-6" key={title}>
                <Icon className="h-8 w-8 text-champagne" />
                <h3 className="mt-8 font-display text-3xl">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-ivory/68">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-ivory px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-saddle">Newsletter</p>
            <h2 className="mt-3 font-display text-4xl text-ink">Join The Bougie List</h2>
            <p className="mt-4 max-w-2xl leading-7 text-espresso/75">
              Be the first to know about new products, special promotions, seasonal collections, and exclusive offers.
            </p>
          </div>
          <form className="flex flex-col gap-3 self-end sm:flex-row">
            <input className="focus-ring min-h-12 flex-1 rounded-md border border-saddle/20 bg-white px-4 text-sm" placeholder="Email address" type="email" />
            <button className="focus-ring rounded-md bg-ink px-6 py-3 text-sm font-bold uppercase tracking-[0.18em] text-ivory hover:bg-saddle" type="submit">Sign Up</button>
          </form>
        </div>
      </AnimatedSection>

      <section className="bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 border-t border-saddle/15 pt-10 sm:flex-row sm:items-center">
          <h2 className="font-display text-3xl text-ink">Follow the boutique</h2>
          <div className="flex gap-3">
            {[Facebook, Instagram, Music2].map((Icon, index) => (
              <a className="focus-ring rounded-full border border-saddle/20 p-3 text-saddle hover:bg-cream" href="#" key={index} aria-label="Social link">
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
