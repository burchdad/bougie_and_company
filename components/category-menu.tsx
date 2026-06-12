"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { defaultMenuItems } from "@/lib/category-defaults";

type MenuItem = {
  label: string;
  href: string;
  children?: MenuItem[];
};

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "category";
}

function hashFromHref(href: string) {
  const hash = href.split("#")[1];
  return hash ? slugify(hash) : "";
}

function normalizeMenuLinks(items: MenuItem[], parentId: string | null = null, seen = new Set<string>()): MenuItem[] {
  return items.map((item) => {
    const hrefHash = hashFromHref(item.href);
    const labelSlug = slugify(item.label);
    const baseId = parentId && hrefHash === parentId ? labelSlug : hrefHash || labelSlug;
    const id = seen.has(baseId) && parentId ? `${parentId}-${labelSlug}` : baseId;
    seen.add(id);

    return {
      ...item,
      href: `/shop#${id}`,
      children: item.children?.length ? normalizeMenuLinks(item.children, id, seen) : undefined
    };
  });
}

function categoryIdFromHref(href: string) {
  return href.split("#")[1] || "all";
}

function handleCategoryClick(href: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("bougie:shop-category", { detail: { categoryId: categoryIdFromHref(href) } }));
}

function MenuLink({ item, nested = false }: { item: MenuItem; nested?: boolean }) {
  const [open, setOpen] = useState(false);
  const hasChildren = Boolean(item.children?.length);

  return (
    <div className="relative" onMouseEnter={() => hasChildren && setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link
        className={`flex items-center justify-between gap-3 whitespace-nowrap rounded-md px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-espresso hover:bg-cream hover:text-saddle ${nested ? "min-w-56" : ""}`}
        href={item.href}
        onClick={() => handleCategoryClick(item.href)}
      >
        {item.label}
        {hasChildren ? <ChevronDown className={`h-4 w-4 ${nested ? "-rotate-90" : ""}`} /> : null}
      </Link>
      {hasChildren && open ? (
        <div className={`${nested ? "left-full top-0 ml-2 before:absolute before:-left-3 before:top-0 before:h-full before:w-3" : "left-0 top-full pt-2 before:absolute before:left-0 before:top-0 before:h-2 before:w-full"} absolute z-50 min-w-64 rounded-lg border border-saddle/15 bg-ivory p-2 shadow-glow`}>
          {item.children?.map((child) => (
            <MenuLink item={child} key={`${item.label}-${child.label}`} nested />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CategoryMenu() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuItems = useMemo(() => normalizeMenuLinks(defaultMenuItems), []);
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
    <div className="border-y border-saddle/10 bg-ivory">
      <nav className="mx-auto hidden max-w-7xl items-center justify-center gap-3 px-4 py-4 lg:flex">
        {menuItems.map((item) => {
          const hasChildren = Boolean(item.children?.length);
          return (
          <div className="relative" key={item.label} onMouseEnter={() => hasChildren && openMenu(item.label)} onMouseLeave={scheduleClose}>
            <Link
              className="flex items-center justify-between gap-3 whitespace-nowrap rounded-md px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-espresso hover:bg-cream hover:text-saddle"
              href={item.href}
              onClick={() => handleCategoryClick(item.href)}
            >
              {item.label}
              {hasChildren ? <ChevronDown className="h-4 w-4" /> : null}
            </Link>
            {activeMenu === item.label && hasChildren ? (
              <div className="absolute left-0 top-full z-50 min-w-64 pt-2 before:absolute before:left-0 before:top-0 before:h-2 before:w-full" onMouseEnter={() => openMenu(item.label)} onMouseLeave={scheduleClose}>
                <div className="rounded-lg border border-saddle/15 bg-ivory p-2 shadow-glow">
                  {item.children?.map((child) => (
                    <MenuLink item={child} key={`${item.label}-${child.label}`} nested />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          );
        })}
      </nav>
      <div className="mx-auto grid max-w-7xl gap-2 px-4 py-4 lg:hidden">
        {menuItems.map((item) => (
          item.children?.length ? (
            <details className="rounded-md border border-saddle/15 bg-white" key={item.label}>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold uppercase tracking-[0.14em] text-espresso">
                {item.label}
                <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="grid gap-1 border-t border-saddle/10 p-2">
                {item.children.map((child) => (
                  <Link className="rounded-md px-3 py-2 text-sm text-espresso hover:bg-cream" href={child.href} key={child.label} onClick={() => handleCategoryClick(child.href)}>
                    {child.label}
                  </Link>
                ))}
              </div>
            </details>
          ) : (
            <Link className="rounded-md border border-saddle/15 bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.14em] text-espresso hover:bg-cream" href={item.href} key={item.label} onClick={() => handleCategoryClick(item.href)}>
              {item.label}
            </Link>
          )
        ))}
      </div>
    </div>
  );
}
