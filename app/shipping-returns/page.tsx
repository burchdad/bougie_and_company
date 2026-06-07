import type { Metadata } from "next";
import Script from "next/script";
import { Accordion } from "@/components/accordion";
import { shippingFaq } from "@/lib/data";

export const metadata: Metadata = {
  title: "Shipping & Returns",
  description: "Review Bougie & Company Boutique shipping, order processing, tracking, delivery restrictions, returns, refunds, and final sale policies."
};

export default function ShippingReturnsPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: shippingFaq.map(([name, text]) => ({
      "@type": "Question",
      name,
      acceptedAnswer: { "@type": "Answer", text }
    }))
  };

  return (
    <section className="sunset-band px-4 py-16 sm:px-6 lg:px-8">
      <Script id="shipping-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-saddle">Customer Care</p>
        <h1 className="mt-4 font-display text-5xl text-ink sm:text-6xl">Shipping & Returns</h1>
        <p className="mt-5 text-lg leading-8 text-espresso/75">
          Clear, professional policies for order processing, shipping, tracking, delivery restrictions, returns, refunds, and final sale items.
        </p>
        <div className="mt-10">
          <Accordion items={shippingFaq} />
        </div>
      </div>
    </section>
  );
}
