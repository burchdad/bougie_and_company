"use client";

import Image from "next/image";
import Link from "next/link";
import { KeyRound, Menu, X } from "lucide-react";
import { useState } from "react";
import { HeaderActions } from "@/components/header-actions";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-saddle/10 bg-ivory/95 backdrop-blur-xl">
      <div className="bg-ink px-4 py-2 text-center text-sm font-bold tracking-[0.08em] text-champagne">
        Fresh Boutique Arrivals | Free Shipping over $150
      </div>
      <div className="bg-ember px-4 py-3 text-sm text-ivory">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-6 sm:justify-start">
          <Link className="hover:text-champagne" href="/shipping-returns">Shipping & Returns</Link>
          <Link className="hover:text-champagne" href="/contact">Contact Us</Link>
          <Link className="hover:text-champagne" href="/shop#gift-collection">Gift Card</Link>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-3 items-center px-4 py-5 sm:px-6 lg:px-8">
        <div className="justify-self-start">
          <HeaderActions showAccount={false} showCart={false} />
        </div>
        <Link className="focus-ring justify-self-center rounded-md text-center" href="/" aria-label="Bougie and Company home">
          <Image src="/images/logo.png" alt="Bougie & Company logo" width={118} height={118} className="mx-auto h-20 w-20 object-contain" priority />
          <p className="mt-2 font-display text-2xl leading-none text-ink">Bougie & Company</p>
          <p className="mt-1 text-[0.66rem] font-bold uppercase tracking-[0.24em] text-saddle">Luxury Meets Country.</p>
        </Link>
        <div className="flex items-center justify-end gap-2">
          <Link
            className="focus-ring inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-espresso hover:bg-cream"
            href="/admin"
          >
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
          <HeaderActions showSearch={false} />
          <button className="focus-ring rounded-full p-2.5 text-espresso hover:bg-cream lg:hidden" aria-label="Menu" onClick={() => setOpen(!open)} type="button">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-saddle/10 bg-ivory px-4 py-4 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-2">
            <Link className="rounded-md px-3 py-3 text-sm font-bold uppercase tracking-[0.18em] text-espresso hover:bg-cream" href="/" onClick={() => setOpen(false)}>Home</Link>
            <Link className="rounded-md px-3 py-3 text-sm font-bold uppercase tracking-[0.18em] text-espresso hover:bg-cream" href="/about" onClick={() => setOpen(false)}>About</Link>
            <Link className="rounded-md px-3 py-3 text-sm font-bold uppercase tracking-[0.18em] text-espresso hover:bg-cream" href="/contact" onClick={() => setOpen(false)}>Contact</Link>
            <Link className="rounded-md px-3 py-3 text-sm font-bold uppercase tracking-[0.18em] text-espresso hover:bg-cream" href="/shop" onClick={() => setOpen(false)}>Full Shop</Link>
            <Link className="rounded-md px-3 py-3 text-sm font-bold uppercase tracking-[0.18em] text-espresso hover:bg-cream" href="/admin" onClick={() => setOpen(false)}>Admin</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
