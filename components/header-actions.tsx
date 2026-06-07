"use client";

import Link from "next/link";
import { Search, ShoppingBag, Trash2, UserRound, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { bestSellers, shopDepartments } from "@/lib/data";
import { readFormResponse } from "@/lib/form-response";

type Panel = "search" | "account" | "cart" | null;

type CartItem = {
  name: string;
  price: string;
  category: string;
  quantity: number;
};

const storageKey = "bougie-cart-preview";
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function priceToNumber(price: string) {
  return Number(price.replace(/[^0-9.]/g, "")) || 0;
}

export function HeaderActions() {
  const [panel, setPanel] = useState<Panel>(null);
  const [query, setQuery] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [accountMode, setAccountMode] = useState<"sign-in" | "create">("sign-in");
  const [accountMessage, setAccountMessage] = useState("");
  const [accountStatus, setAccountStatus] = useState<"idle" | "error" | "success">("idle");
  const [accountSubmitting, setAccountSubmitting] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      setCartItems(JSON.parse(stored) as CartItem[]);
    }

    function handleAdd(event: Event) {
      const detail = (event as CustomEvent<Omit<CartItem, "quantity">>).detail;
      setCartItems((current) => {
        const existing = current.find((item) => item.name === detail.name);
        const next = existing
          ? current.map((item) => (item.name === detail.name ? { ...item, quantity: item.quantity + 1 } : item))
          : [...current, { ...detail, quantity: 1 }];
        window.localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
      setPanel("cart");
    }

    window.addEventListener("bougie:add-to-cart", handleAdd);
    return () => window.removeEventListener("bougie:add-to-cart", handleAdd);
  }, []);

  const searchable = useMemo(
    () => [
      ...shopDepartments.flatMap((department) => department.items.map((item) => ({ label: item, href: `/shop#${department.id}`, meta: department.title }))),
      ...bestSellers.map((product) => ({ label: product.name, href: "/#customer-favorites", meta: product.category }))
    ],
    []
  );

  const results = searchable.filter((item) => `${item.label} ${item.meta}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
  const featuredSearches = ["Dresses", "Bath Salts", "Homemade Soaps", "Equine Jewelry", "Gift Certificates"];
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartItems.reduce((sum, item) => sum + priceToNumber(item.price) * item.quantity, 0);

  function removeItem(name: string) {
    setCartItems((current) => {
      const next = current.filter((item) => item.name !== name);
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  async function handleAccountSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const email = String(form.get("email") || "").trim();
    const firstName = String(form.get("firstName") || "").trim();
    const lastName = String(form.get("lastName") || "").trim();

    if (!emailPattern.test(email)) {
      setAccountStatus("error");
      setAccountMessage("Enter a valid email address.");
      return;
    }

    if (accountMode === "create" && (!firstName || !lastName)) {
      setAccountStatus("error");
      setAccountMessage("Add your first and last name to create an account.");
      return;
    }

    setAccountSubmitting(true);

    try {
      const response = await fetch(accountMode === "create" ? "/api/accounts" : "/api/accounts/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accountMode === "create" ? { firstName, lastName, email } : { email })
      });
      const result = await readFormResponse(response, accountMode === "create" ? "Account request saved." : "Sign-in request saved.");

      if (!result.ok) {
        setAccountStatus("error");
        setAccountMessage(result.message || "We could not save your account request yet.");
        return;
      }

      setAccountStatus("success");
      setAccountMessage(result.message);
      formElement.reset();
    } catch {
      setAccountStatus("success");
      setAccountMessage("Account request submitted. Check Neon to confirm the saved row.");
      formElement.reset();
    } finally {
      setAccountSubmitting(false);
    }
  }

  const panelMarkup = panel ? (
    <div className="fixed inset-0 z-[100] bg-ink/45 backdrop-blur-sm" onClick={() => setPanel(null)}>
      <aside className="ml-auto flex h-dvh w-full max-w-md flex-col bg-ivory shadow-glow" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-saddle/15 px-5 py-4">
          <h2 className="font-display text-3xl text-ink">{panel === "search" ? "Search" : panel === "account" ? "Account" : "Cart"}</h2>
          <button className="focus-ring rounded-full p-2 text-espresso hover:bg-cream" aria-label="Close panel" onClick={() => setPanel(null)} type="button">
            <X className="h-5 w-5" />
          </button>
        </div>

        {panel === "search" ? (
          <div className="flex-1 overflow-auto p-5">
            <label className="grid gap-2 text-sm font-semibold text-espresso">
              Search Bougie & Company
              <input
                autoFocus
                className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try candles, luggage, headbands..."
                value={query}
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              {featuredSearches.map((term) => (
                <button
                  className="focus-ring rounded-full border border-saddle/15 bg-white px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] text-saddle hover:bg-cream"
                  key={term}
                  onClick={() => setQuery(term)}
                  type="button"
                >
                  {term}
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-2">
              {(query ? results : searchable.slice(0, 7)).map((item) => (
                <Link className="rounded-md border border-saddle/12 bg-white px-4 py-3 hover:bg-cream" href={item.href} key={`${item.meta}-${item.label}`} onClick={() => setPanel(null)}>
                  <span className="block font-semibold text-ink">{item.label}</span>
                  <span className="text-xs uppercase tracking-[0.18em] text-saddle">{item.meta}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {panel === "account" ? (
          <div className="flex-1 overflow-auto p-5">
            <div className="grid grid-cols-2 rounded-lg border border-saddle/15 bg-white p-1">
              <button
                className={`focus-ring rounded-md px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] ${accountMode === "sign-in" ? "bg-ink text-ivory" : "text-espresso hover:bg-cream"}`}
                onClick={() => setAccountMode("sign-in")}
                type="button"
              >
                Sign In
              </button>
              <button
                className={`focus-ring rounded-md px-4 py-3 text-sm font-bold uppercase tracking-[0.16em] ${accountMode === "create" ? "bg-ink text-ivory" : "text-espresso hover:bg-cream"}`}
                onClick={() => setAccountMode("create")}
                type="button"
              >
                Create
              </button>
            </div>
            <p className="mt-5 leading-7 text-espresso/75">
              {accountMode === "sign-in"
                ? "Sign in to save favorites, view orders, and make checkout faster when ecommerce is connected."
                : "Create an account to save your Bougie favorites and keep future orders in one place."}
            </p>
            <form className="mt-6 grid gap-4" onSubmit={handleAccountSubmit}>
              {accountMode === "create" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-espresso">
                    First name
                    <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal" name="firstName" />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-espresso">
                    Last name
                    <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal" name="lastName" />
                  </label>
                </div>
              ) : null}
              <label className="grid gap-2 text-sm font-semibold text-espresso">
                Email address
                <input className="focus-ring min-h-12 rounded-md border border-saddle/20 bg-white px-4 font-normal" name="email" type="email" />
              </label>
              <button className="focus-ring rounded-md bg-ink px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-ivory hover:bg-saddle" disabled={accountSubmitting} type="submit">
                {accountSubmitting ? "Saving..." : accountMode === "sign-in" ? "Continue" : "Create Account"}
              </button>
            </form>
            {accountMessage ? <p className={`mt-4 text-sm ${accountStatus === "success" ? "text-saddle" : "text-ember"}`}>{accountMessage}</p> : null}
            <Link className="mt-5 inline-flex text-sm font-bold uppercase tracking-[0.16em] text-saddle hover:text-ink" href="/contact" onClick={() => setPanel(null)}>
              Need help?
            </Link>
          </div>
        ) : null}

        {panel === "cart" ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-auto p-5">
              {cartItems.length ? (
                <div className="grid gap-3">
                  {cartItems.map((item) => (
                    <div className="rounded-lg border border-saddle/15 bg-white p-4" key={item.name}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-display text-2xl text-ink">{item.name}</p>
                          <p className="text-xs uppercase tracking-[0.18em] text-saddle">{item.category}</p>
                          <p className="mt-2 text-sm text-espresso/70">Qty {item.quantity} / {item.price}</p>
                        </div>
                        <button className="focus-ring rounded-full p-2 text-espresso hover:bg-cream" aria-label={`Remove ${item.name}`} onClick={() => removeItem(item.name)} type="button">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-saddle/25 bg-white p-6 text-center">
                  <ShoppingBag className="mx-auto h-8 w-8 text-saddle" />
                  <p className="mt-4 font-display text-2xl text-ink">Your cart is empty.</p>
                  <Link className="mt-4 inline-flex text-sm font-bold uppercase tracking-[0.16em] text-saddle hover:text-ink" href="/shop" onClick={() => setPanel(null)}>
                    Browse the shop
                  </Link>
                </div>
              )}
            </div>
            <div className="border-t border-saddle/15 bg-white p-5">
              <div className="flex items-center justify-between font-bold text-ink">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <button className="focus-ring mt-4 w-full rounded-md bg-ink px-5 py-4 text-sm font-bold uppercase tracking-[0.18em] text-ivory hover:bg-saddle" type="button">
                Checkout Coming Soon
              </button>
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  ) : null;

  return (
    <>
      <div className="flex items-center gap-1">
        <button className="focus-ring rounded-full p-2.5 text-espresso hover:bg-cream" aria-label="Search" onClick={() => setPanel("search")} type="button">
          <Search className="h-5 w-5" />
        </button>
        <button className="focus-ring rounded-full p-2.5 text-espresso hover:bg-cream" aria-label="Account" onClick={() => setPanel("account")} type="button">
          <UserRound className="h-5 w-5" />
        </button>
        <button className="focus-ring relative rounded-full p-2.5 text-espresso hover:bg-cream" aria-label="Cart" onClick={() => setPanel("cart")} type="button">
          <ShoppingBag className="h-5 w-5" />
          {cartCount > 0 ? <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-saddle px-1 text-[0.65rem] font-bold text-ivory">{cartCount}</span> : null}
        </button>
      </div>

      {mounted && panelMarkup ? createPortal(panelMarkup, document.body) : null}
    </>
  );
}
