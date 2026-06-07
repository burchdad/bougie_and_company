"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";

type MenuItem = {
  label: string;
  href: string;
  children?: MenuItem[];
};

const menuItems: MenuItem[] = [
  {
    label: "Accessories",
    href: "/shop#accessories",
    children: [
      { label: "Purses", href: "/shop#accessories" },
      {
        label: "Luggage",
        href: "/shop#accessories",
        children: [
          { label: "Men's", href: "/shop#mens-collection" },
          { label: "Women's", href: "/shop#womens-collection" }
        ]
      },
      { label: "Home Collection", href: "/shop#home-collection" },
      { label: "Kitchen Collection", href: "/shop#kitchen-selection" },
      {
        label: "Bath & Body",
        href: "/shop#bath-body",
        children: [
          { label: "Bath Salts", href: "/shop#bath-body" },
          { label: "Body Scrubs", href: "/shop#bath-body" }
        ]
      },
      { label: "Gift Collection", href: "/shop#gift-collection" },
      {
        label: "Men's Care",
        href: "/shop#mens-collection",
        children: [
          { label: "Body Spray", href: "/shop#mens-collection" },
          { label: "Beard Products", href: "/shop#mens-collection" }
        ]
      },
      {
        label: "Women's Care",
        href: "/shop#womens-collection",
        children: [
          { label: "Week From Hell", href: "/shop#womens-collection" },
          { label: "Body Sprays", href: "/shop#womens-collection" },
          { label: "Purses", href: "/shop#accessories" }
        ]
      },
      { label: "Coozies", href: "/shop#accessories" },
      { label: "Leather Coasters", href: "/shop#accessories" },
      { label: "Cocktail Infusions", href: "/shop#accessories" }
    ]
  },
  {
    label: "Equine Jewelry",
    href: "/shop#equine-jewelry",
    children: [
      { label: "Necklaces", href: "/shop#equine-jewelry" },
      { label: "Bracelets", href: "/shop#equine-jewelry" },
      { label: "Earrings", href: "/shop#equine-jewelry" }
    ]
  },
  {
    label: "Men's Collection",
    href: "/shop#mens-collection",
    children: [
      { label: "T-Shirts", href: "/shop#mens-collection" },
      { label: "Bottoms", href: "/shop#mens-collection" },
      { label: "Caps", href: "/shop#accessories" },
      {
        label: "Men's Care",
        href: "/shop#mens-collection",
        children: [
          { label: "Body Spray", href: "/shop#mens-collection" },
          { label: "Beard Products", href: "/shop#mens-collection" }
        ]
      },
      { label: "Luggage", href: "/shop#accessories" },
      { label: "Coozies", href: "/shop#accessories" }
    ]
  },
  {
    label: "Women's Collection",
    href: "/shop#womens-collection",
    children: [
      { label: "Tops", href: "/shop#womens-collection" },
      { label: "Bottoms", href: "/shop#womens-collection" },
      { label: "Dresses", href: "/shop#womens-collection" },
      { label: "Rompers & Jumpsuits", href: "/shop#womens-collection" },
      {
        label: "Women's Care",
        href: "/shop#womens-collection",
        children: [
          { label: "Week From Hell", href: "/shop#womens-collection" },
          { label: "Bath Bombs", href: "/shop#bath-body" },
          { label: "Body Sprays", href: "/shop#womens-collection" }
        ]
      },
      { label: "Purses", href: "/shop#accessories" }
    ]
  },
  {
    label: "Jewelry",
    href: "/shop#jewelry-headbands",
    children: [
      { label: "Earrings", href: "/shop#jewelry-headbands" },
      { label: "Bracelets", href: "/shop#jewelry-headbands" },
      { label: "Headbands", href: "/shop#jewelry-headbands" }
    ]
  }
];

function MenuLink({ item, nested = false }: { item: MenuItem; nested?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link
        className={`flex items-center justify-between gap-3 whitespace-nowrap rounded-md px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-espresso hover:bg-cream hover:text-saddle ${nested ? "min-w-56" : ""}`}
        href={item.href}
      >
        {item.label}
        {item.children ? <ChevronDown className={`h-4 w-4 ${nested ? "-rotate-90" : ""}`} /> : null}
      </Link>
      {item.children && open ? (
        <div className={`${nested ? "left-full top-0 ml-2 before:absolute before:-left-3 before:top-0 before:h-full before:w-3" : "left-0 top-full pt-2 before:absolute before:left-0 before:top-0 before:h-2 before:w-full"} absolute z-50 min-w-64 rounded-lg border border-saddle/15 bg-ivory p-2 shadow-glow`}>
          {item.children.map((child) => (
            <MenuLink item={child} key={`${item.label}-${child.label}`} nested />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CategoryMenu() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const closeTimer = useRef<number | null>(null);

  function openMenu(label: string) {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
    }
    setActiveMenu(label);
  }

  function scheduleClose() {
    closeTimer.current = window.setTimeout(() => setActiveMenu(null), 180);
  }

  return (
    <div className="border-y border-saddle/10 bg-ivory/95">
      <nav className="mx-auto hidden max-w-7xl items-center justify-center gap-3 px-4 py-4 lg:flex">
        {menuItems.map((item) => (
          <div className="relative" key={item.label} onMouseEnter={() => openMenu(item.label)} onMouseLeave={scheduleClose}>
            <Link
              className="flex items-center justify-between gap-3 whitespace-nowrap rounded-md px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-espresso hover:bg-cream hover:text-saddle"
              href={item.href}
            >
              {item.label}
              <ChevronDown className="h-4 w-4" />
            </Link>
            {activeMenu === item.label ? (
              <div className="absolute left-0 top-full z-50 min-w-64 pt-2 before:absolute before:left-0 before:top-0 before:h-2 before:w-full" onMouseEnter={() => openMenu(item.label)} onMouseLeave={scheduleClose}>
                <div className="rounded-lg border border-saddle/15 bg-ivory p-2 shadow-glow">
                  {item.children?.map((child) => (
                    <MenuLink item={child} key={`${item.label}-${child.label}`} nested />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </nav>
      <div className="mx-auto grid max-w-7xl gap-2 px-4 py-4 lg:hidden">
        {menuItems.map((item) => (
          <details className="rounded-md border border-saddle/15 bg-white" key={item.label}>
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold uppercase tracking-[0.14em] text-espresso">
              {item.label}
              <ChevronDown className="h-4 w-4" />
            </summary>
            <div className="grid gap-1 border-t border-saddle/10 p-2">
              {item.children?.map((child) => (
                <Link className="rounded-md px-3 py-2 text-sm text-espresso hover:bg-cream" href={child.href} key={child.label}>
                  {child.label}
                </Link>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
