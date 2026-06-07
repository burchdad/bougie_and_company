import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Music2, Star } from "lucide-react";
import { AnimatedSection } from "@/components/animated-section";
import { NewsletterForm } from "@/components/newsletter-form";
import { ProductShowcase } from "@/components/product-showcase";
import { lifestyles, reviews, socialLinks } from "@/lib/data";

export default function HomePage() {
  return (
    <>
      <section className="sunset-band overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.02fr_0.98fr] lg:px-8 lg:py-20">
          <div className="order-2 md:order-1">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-saddle">Luxury Texas Boutique</p>
            <h1 className="mt-4 max-w-2xl font-display text-5xl font-semibold leading-[0.95] text-ink sm:text-6xl lg:text-7xl">
              Bougie & Company
            </h1>
            <p className="mt-5 font-display text-3xl text-saddle sm:text-4xl">Luxury Meets Country.</p>
            <p className="mt-6 max-w-xl text-lg leading-8 text-espresso/75">
              Boutique fashion, self care, home goods, equine jewelry, gifts, and mercantile finds with a polished Texas point of view.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="focus-ring rounded-md bg-ember px-6 py-4 text-center text-sm font-bold uppercase tracking-[0.2em] text-ivory shadow-luxe hover:bg-saddle" href="/shop">
                Shop Collection
              </Link>
              <Link className="focus-ring rounded-md border border-saddle/30 px-6 py-4 text-center text-sm font-bold uppercase tracking-[0.2em] text-espresso hover:bg-cream" href="/about">
                Our Story
              </Link>
            </div>
            <div className="mt-10 grid max-w-xl grid-cols-3 divide-x divide-saddle/15 border-y border-saddle/15 py-4 text-center">
              <div>
                <p className="font-display text-3xl text-ink">10</p>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-saddle">Reviews</p>
              </div>
              <div>
                <p className="font-display text-3xl text-ink">9</p>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-saddle">Departments</p>
              </div>
              <div>
                <p className="font-display text-3xl text-ink">$150</p>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-saddle">Free Ship</p>
              </div>
            </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="relative grid min-h-[430px] place-items-center overflow-hidden rounded-lg border border-champagne/35 bg-ink p-8 shadow-glow md:min-h-[600px]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_32%_20%,rgba(216,174,102,0.3),transparent_22rem),linear-gradient(135deg,rgba(122,63,25,0.4),transparent_32rem)]" />
              <Image src="/images/logo.png" alt="Bougie & Company logo" width={560} height={560} className="relative h-auto w-full max-w-[480px] rounded-full bg-ivory/95 object-contain p-3 shadow-glow" priority />
              <div className="absolute inset-x-8 bottom-8 hidden justify-between border-t border-ivory/15 pt-5 text-xs font-bold uppercase tracking-[0.22em] text-champagne sm:flex">
                <span>Boutique</span>
                <span>Mercantile</span>
                <span>Rusk, Texas</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AnimatedSection className="bg-[linear-gradient(180deg,#21150e_0%,#21150e_42%,#f7efe4_42%,#f7efe4_100%)] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 text-ivory sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-champagne">Best Sellers</p>
              <h2 className="mt-3 font-display text-4xl">Customer Favorites</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-ivory/68">A dressed-up edit of pieces shoppers keep coming back for.</p>
          </div>
          <ProductShowcase />
        </div>
      </AnimatedSection>

      <AnimatedSection className="sunset-band px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-saddle">Customer Reviews</p>
              <h2 className="mt-3 font-display text-4xl text-ink">Five-Star Favorites</h2>
            </div>
            <div className="rounded-lg bg-ink px-5 py-4 text-ivory shadow-luxe">
              <p className="font-display text-3xl">10/10</p>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-champagne">Local Love</p>
            </div>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-5">
            {reviews.map((review, index) => (
              <article className="rounded-lg border border-saddle/15 bg-white/85 p-5 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:bg-white hover:shadow-luxe" key={`${review.name}-${review.product}`}>
                <span className="rounded-full bg-cream px-2 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-saddle">0{index + 1}</span>
                <div className="flex gap-1 text-champagne" aria-label="5 star review">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star className="h-4 w-4 fill-champagne" key={index} />
                  ))}
                </div>
                <p className="mt-4 text-sm font-bold uppercase tracking-[0.16em] text-saddle">{review.product}</p>
                <p className="mt-3 text-sm leading-6 text-espresso/75">{review.text}</p>
                <p className="mt-5 text-sm font-bold text-ink">{review.name}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-espresso/55">{review.location}</p>
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
          <div className="editorial-panel rounded-lg border border-saddle/15 p-7 shadow-sm">
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

      <AnimatedSection className="midnight-band px-4 py-16 text-ivory sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-champagne">Shop By Lifestyle</p>
          <h2 className="mt-3 font-display text-4xl">Polished Finds For Every Corner Of Life</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-4">
            {lifestyles.map(({ title, text, icon: Icon }) => (
              <div className="rounded-lg border border-ivory/12 bg-white/8 p-6 shadow-luxe transition hover:-translate-y-1 hover:border-champagne/60 hover:bg-white/12" key={title}>
                <Icon className="h-8 w-8 text-champagne" />
                <h3 className="mt-8 font-display text-3xl">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-ivory/68">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection className="bg-ember px-4 py-16 text-ivory sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1fr_0.8fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-champagne">Newsletter</p>
            <h2 className="mt-3 font-display text-4xl">Join The Bougie List</h2>
            <p className="mt-4 max-w-2xl leading-7 text-ivory/78">
              Be the first to know about new products, special promotions, seasonal collections, and exclusive offers.
            </p>
          </div>
          <div className="self-end">
            <NewsletterForm />
          </div>
        </div>
      </AnimatedSection>

      <section className="bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 border-t border-saddle/15 pt-10 sm:flex-row sm:items-center">
          <h2 className="font-display text-3xl text-ink">Follow the boutique</h2>
          <div className="flex gap-3">
            {[Facebook, Instagram, Music2].map((Icon, index) => (
              <a className="focus-ring rounded-full border border-saddle/20 p-3 text-saddle hover:bg-cream" href={socialLinks[index].href} key={socialLinks[index].label} aria-label={socialLinks[index].label} target="_blank" rel="noreferrer">
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
