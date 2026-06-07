import Image from "next/image";
import Link from "next/link";
import { Facebook, Instagram, Music2 } from "lucide-react";

const links = [
  ["Shop", "/shop"],
  ["About", "/about"],
  ["Contact", "/contact"],
  ["Shipping & Returns", "/shipping-returns"],
  ["Privacy Policy", "/privacy-policy"]
];

export function SiteFooter() {
  return (
    <footer className="bg-ink text-ivory">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.2fr_0.8fr_1fr] lg:px-8">
        <div>
          <Image src="/images/logo.png" alt="Bougie & Company logo" width={112} height={112} className="h-24 w-24 rounded-full bg-ivory object-contain p-1" />
          <p className="mt-5 max-w-sm font-display text-3xl">Country Roots. Luxury Taste.</p>
          <p className="mt-4 max-w-md text-sm leading-7 text-ivory/70">
            A luxury Texas boutique and mercantile for fashion, gifts, home, self care, and elevated everyday goods.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.24em] text-champagne">Quick Links</h2>
          <div className="mt-5 grid gap-3 text-sm">
            {links.map(([label, href]) => (
              <Link className="text-ivory/75 hover:text-champagne" href={href} key={href}>{label}</Link>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.24em] text-champagne">Newsletter</h2>
          <p className="mt-5 text-sm leading-7 text-ivory/70">Seasonal edits, special promotions, and boutique releases.</p>
          <form className="mt-5 flex gap-2">
            <input className="focus-ring min-h-11 min-w-0 flex-1 rounded-md border border-ivory/15 bg-white/10 px-3 text-sm text-white placeholder:text-ivory/45" placeholder="Email address" type="email" />
            <button className="focus-ring rounded-md bg-champagne px-4 text-sm font-bold text-ink hover:bg-ivory" type="submit">Join</button>
          </form>
          <div className="mt-6 flex gap-3">
            {[Facebook, Instagram, Music2].map((Icon, index) => (
              <a className="focus-ring rounded-full border border-ivory/15 p-2 text-ivory/80 hover:border-champagne hover:text-champagne" href="#" key={index} aria-label="Social link">
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-ivory/10 px-4 py-5 text-center text-xs uppercase tracking-[0.2em] text-ivory/45">
        (c) 2026 Bougie & Company Boutique
      </div>
    </footer>
  );
}
