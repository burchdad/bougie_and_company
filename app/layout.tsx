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
  name: "Bougie & Company Boutique",
  image: `${siteUrl}/images/logo.png`,
  url: siteUrl,
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>
        <Script id="organization-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
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
