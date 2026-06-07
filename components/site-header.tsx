"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useState } from "react";
import { navItems } from "@/lib/data";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-champagne/25 bg-ivory/92 backdrop-blur-xl">
      <div className="bg-ink px-4 py-2 text-center text-xs font-bold uppercase tracking-[0.24em] text-champagne">
        Free Shipping On Orders Over $150
      </div>
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link className="focus-ring flex items-center gap-3 rounded-md" href="/" aria-label="Bougie and Company home">
          <Image src="/images/logo.png" alt="Bougie & Company logo" width={78} height={78} className="h-14 w-14 object-contain" priority />
          <div className="hidden sm:block">
            <p className="font-display text-xl leading-none text-ink">Bougie & Company</p>
            <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-saddle">Luxury Meets Country.</p>
          </div>
        </Link>
        <div className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <Link className="text-sm font-semibold uppercase tracking-[0.18em] text-espresso hover:text-saddle" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button className="focus-ring rounded-full p-2.5 text-espresso hover:bg-cream" aria-label="Search" type="button"><Search className="h-5 w-5" /></button>
          <button className="focus-ring rounded-full p-2.5 text-espresso hover:bg-cream" aria-label="Account" type="button"><UserRound className="h-5 w-5" /></button>
          <button className="focus-ring rounded-full p-2.5 text-espresso hover:bg-cream" aria-label="Cart" type="button"><ShoppingBag className="h-5 w-5" /></button>
          <button className="focus-ring rounded-full p-2.5 text-espresso hover:bg-cream lg:hidden" aria-label="Menu" onClick={() => setOpen(!open)} type="button">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>
      {open ? (
        <div className="border-t border-saddle/10 bg-ivory px-4 py-5 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-3">
            {navItems.map((item) => (
              <Link className="rounded-md px-2 py-3 text-sm font-bold uppercase tracking-[0.18em] text-espresso hover:bg-cream" href={item.href} key={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
