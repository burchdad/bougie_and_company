import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { CategoryMenu } from "@/components/category-menu";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { NewsletterPopup } from "@/components/newsletter-popup";
import { siteUrl } from "@/lib/utils";

const display = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"]
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bougie & Company Boutique | Luxury Texas Boutique",
    template: "%s | Bougie & Company Boutique"
  },
  description: "A luxury Texas boutique and mercantile offering boutique clothing, equine jewelry, home goods, bath and body, gifts, men's products, women's products, and kitchen goods.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Bougie & Company Boutique",
    description: "Luxury Meets Country.",
    url: siteUrl,
    siteName: "Bougie & Company Boutique",
    images: [{ url: "/images/logo.png", width: 1200, height: 630, alt: "Bougie & Company Boutique" }],
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Bougie & Company Boutique",
    description: "Luxury Texas boutique shopping for clothing, jewelry, home goods, bath and body, gifts, men's products, women's products, and kitchen goods.",
    images: ["/images/logo.png"]
  },
  robots: {
    index: true,
    follow: true
  }
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${siteUrl}/#localbusiness`,
  name: "Bougie & Company Boutique",
  image: `${siteUrl}/images/logo.png`,
  url: siteUrl,
  description: "Bougie & Company Boutique is a luxury Texas boutique and mercantile in Rusk offering clothing, equine jewelry, home goods, bath and body, gifts, men's products, women's products, and kitchen goods.",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Rusk",
    addressRegion: "TX",
    addressCountry: "US"
  },
  slogan: "Luxury Meets Country.",
  sameAs: [
    "https://www.facebook.com/share/1EQuCjxyGL/",
    "https://www.instagram.com/bougieandcompanytx/",
    "https://www.tiktok.com/@bougieandcompany"
  ]
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  name: "Bougie & Company Boutique",
  url: siteUrl,
  publisher: { "@id": `${siteUrl}/#localbusiness` },
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/shop?q={search_term_string}`,
    "query-input": "required name=search_term_string"
  }
};

const offerCatalogSchema = {
  "@context": "https://schema.org",
  "@type": "OfferCatalog",
  "@id": `${siteUrl}/#catalog`,
  name: "Bougie & Company boutique departments",
  itemListElement: [
    "Women's clothing",
    "Equine jewelry",
    "Home goods",
    "Bath and body",
    "Gifts",
    "Men's products",
    "Kitchen goods",
    "Accessories"
  ].map((name) => ({
    "@type": "Offer",
    itemOffered: {
      "@type": "Product",
      name,
      url: `${siteUrl}/shop`
    }
  }))
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/#faq`,
  mainEntity: [
    {
      "@type": "Question",
      name: "What does Bougie & Company Boutique sell?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Bougie & Company Boutique sells boutique clothing, equine-inspired jewelry, home goods, bath and body products, gifts, men's products, women's products, kitchen goods, and accessories."
      }
    },
    {
      "@type": "Question",
      name: "Where is Bougie & Company Boutique located?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Bougie & Company Boutique is based in Rusk, Texas and offers online boutique shopping through bougieandcompany.com."
      }
    },
    {
      "@type": "Question",
      name: "What makes Bougie & Company Boutique different?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The boutique blends luxury style with a polished country point of view, curating fashion, gifts, home goods, and self-care products with a modern Southern mercantile feel."
      }
    }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>
        <Script id="organization-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        <Script id="website-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
        <Script id="offer-catalog-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(offerCatalogSchema) }} />
        <Script id="faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
        <div className="relative z-40">
          <SiteHeader />
          <CategoryMenu />
        </div>
        <main>{children}</main>
        <SiteFooter />
        <NewsletterPopup />
      </body>
    </html>
  );
}
