"use client";

import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { reviews } from "@/lib/data";

export function ReviewCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % reviews.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  const visibleReviews = useMemo(
    () => [0, 1, 2].map((offset) => reviews[(active + offset) % reviews.length]),
    [active]
  );

  function previous() {
    setActive((current) => (current - 1 + reviews.length) % reviews.length);
  }

  function next() {
    setActive((current) => (current + 1) % reviews.length);
  }

  return (
    <div className="mt-8">
      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr_0.9fr]">
        {visibleReviews.map((review, index) => (
          <article
            className={`rounded-lg border border-saddle/15 bg-white/88 p-6 shadow-sm backdrop-blur transition ${index === 0 ? "min-h-[320px] lg:scale-[1.02] lg:p-8 lg:shadow-luxe" : "lg:mt-8"}`}
            key={`${review.name}-${review.product}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex gap-1 text-champagne" aria-label="5 star review">
                {Array.from({ length: 5 }).map((_, starIndex) => (
                  <Star className="h-4 w-4 fill-champagne" key={starIndex} />
                ))}
              </div>
              <span className="rounded-full bg-cream px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-saddle">
                {review.location}
              </span>
            </div>
            <p className="mt-6 text-sm font-bold uppercase tracking-[0.16em] text-saddle">{review.product}</p>
            <p className={`${index === 0 ? "mt-4 font-display text-3xl leading-tight text-ink" : "mt-4 text-base leading-7 text-espresso/78"}`}>
              &quot;{review.text}&quot;
            </p>
            <p className="mt-6 text-sm font-bold text-ink">{review.name}</p>
          </article>
        ))}
      </div>

      <div className="mt-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2">
          {reviews.map((review, index) => (
            <button
              aria-label={`Show review from ${review.name}`}
              className={`h-2.5 rounded-full transition ${index === active ? "w-8 bg-saddle" : "w-2.5 bg-saddle/25 hover:bg-saddle/50"}`}
              key={`${review.name}-dot`}
              onClick={() => setActive(index)}
              type="button"
            />
          ))}
        </div>
        <div className="flex gap-3">
          <button className="focus-ring rounded-full border border-saddle/20 bg-white p-3 text-saddle hover:bg-cream" aria-label="Previous review" onClick={previous} type="button">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button className="focus-ring rounded-full border border-saddle/20 bg-white p-3 text-saddle hover:bg-cream" aria-label="Next review" onClick={next} type="button">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
