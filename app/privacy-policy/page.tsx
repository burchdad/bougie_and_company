import type { Metadata } from "next";
import Script from "next/script";
import { Accordion } from "@/components/accordion";
import { privacyFaq } from "@/lib/data";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Read the Bougie & Company Boutique privacy policy covering customer information, email marketing, cookies, analytics, security, and customer rights."
};

export default function PrivacyPolicyPage() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: privacyFaq.map(([name, text]) => ({
      "@type": "Question",
      name,
      acceptedAnswer: { "@type": "Answer", text }
    }))
  };

  return (
    <section className="sunset-band px-4 py-16 sm:px-6 lg:px-8">
      <Script id="privacy-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-saddle">Privacy</p>
        <h1 className="mt-4 font-display text-5xl text-ink sm:text-6xl">Privacy Policy</h1>
        <p className="mt-5 text-lg leading-8 text-espresso/75">
          A polished customer-facing policy structure for how Bougie & Company Boutique collects, uses, protects, and manages customer information.
        </p>
        <div className="mt-10">
          <Accordion items={privacyFaq} />
        </div>
      </div>
    </section>
  );
}
