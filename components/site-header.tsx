"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";
import { navItems, shopDepartments } from "@/lib/data";
import { HeaderActions } from "@/components/header-actions";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);

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
          {navItems.map((item) =>
            item.href === "/shop" ? (
              <div className="relative" key={item.href}>
                <button
                  className="focus-ring inline-flex items-center gap-2 rounded-md text-sm font-semibold uppercase tracking-[0.18em] text-espresso hover:text-saddle"
                  onClick={() => setShopOpen(!shopOpen)}
                  onMouseEnter={() => setShopOpen(true)}
                  type="button"
                >
                  Shop
                  <ChevronDown className={`h-4 w-4 transition ${shopOpen ? "rotate-180" : ""}`} />
                </button>
                {shopOpen ? (
                  <div
                    className="absolute left-1/2 top-8 w-[680px] -translate-x-1/2 rounded-lg border border-saddle/15 bg-ivory p-5 shadow-glow"
                    onMouseLeave={() => setShopOpen(false)}
                  >
                    <div className="grid grid-cols-3 gap-3">
                      {shopDepartments.map((department) => (
                        <Link
                          className="rounded-md border border-saddle/10 bg-white px-4 py-3 hover:border-champagne hover:bg-cream"
                          href={`/shop#${department.id}`}
                          key={department.id}
                          onClick={() => setShopOpen(false)}
                        >
                          <span className="block font-display text-xl text-ink">{department.title}</span>
                          <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-saddle">{department.items.slice(0, 2).join(" / ")}</span>
                        </Link>
                      ))}
                    </div>
                    <Link
                      className="mt-4 flex items-center justify-center rounded-md bg-ink px-5 py-3 text-xs font-bold uppercase tracking-[0.18em] text-ivory hover:bg-saddle"
                      href="/shop"
                      onClick={() => setShopOpen(false)}
                    >
                      View Full Shop
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link className="text-sm font-semibold uppercase tracking-[0.18em] text-espresso hover:text-saddle" href={item.href} key={item.href}>
                {item.label}
              </Link>
            )
          )}
        </div>
        <div className="flex items-center gap-1">
          <HeaderActions />
          <button className="focus-ring rounded-full p-2.5 text-espresso hover:bg-cream lg:hidden" aria-label="Menu" onClick={() => setOpen(!open)} type="button">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>
      {open ? (
        <div className="border-t border-saddle/10 bg-ivory px-4 py-5 lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-3">
            {navItems.map((item) => (
              item.href === "/shop" ? (
                <details className="rounded-md px-2 py-3" key={item.href}>
                  <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold uppercase tracking-[0.18em] text-espresso">
                    Shop
                    <ChevronDown className="h-4 w-4" />
                  </summary>
                  <div className="mt-3 grid gap-2">
                    <Link className="rounded-md bg-cream px-3 py-3 text-sm font-bold text-espresso" href="/shop" onClick={() => setOpen(false)}>
                      View Full Shop
                    </Link>
                    {shopDepartments.map((department) => (
                      <Link className="rounded-md border border-saddle/10 bg-white px-3 py-3 text-sm text-espresso" href={`/shop#${department.id}`} key={department.id} onClick={() => setOpen(false)}>
                        {department.title}
                      </Link>
                    ))}
                  </div>
                </details>
              ) : (
                <Link className="rounded-md px-2 py-3 text-sm font-bold uppercase tracking-[0.18em] text-espresso hover:bg-cream" href={item.href} key={item.href} onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              )
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
