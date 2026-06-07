"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

export function NewsletterPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = window.localStorage.getItem("bougie-popup-seen");
    if (!seen) {
      const timer = window.setTimeout(() => setVisible(true), 1200);
      return () => window.clearTimeout(timer);
    }
  }, []);

  function close() {
    window.localStorage.setItem("bougie-popup-seen", "true");
    setVisible(false);
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/55 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-lg border border-champagne/40 bg-ivory p-6 shadow-glow sm:p-8">
        <button
          aria-label="Close popup"
          className="focus-ring absolute right-4 top-4 rounded-full p-2 text-espresso hover:bg-cream"
          onClick={close}
          type="button"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-xs font-bold uppercase tracking-[0.26em] text-saddle">Bougie List</p>
        <h2 className="mt-3 font-display text-3xl text-ink">Free Shipping On Orders Over $150</h2>
        <p className="mt-4 leading-7 text-espresso/75">
          Join our email list and be the first to know about new arrivals, exclusive promotions, and boutique releases.
        </p>
        <form className="mt-6 flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="Email address"
            className="focus-ring min-h-12 flex-1 rounded-md border border-saddle/20 bg-white px-4 text-sm"
            placeholder="Email address"
            type="email"
          />
          <button className="focus-ring min-h-12 rounded-md bg-ink px-6 text-sm font-bold uppercase tracking-[0.18em] text-ivory hover:bg-saddle" type="submit">
            Join
          </button>
        </form>
      </div>
    </div>
  );
}
