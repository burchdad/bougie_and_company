import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
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
  description: "A luxury Texas boutique and mercantile offering boutique clothing, equine jewelry, home goods, bath and body, gifts, men's products, and outdoor finds.",
  openGraph: {
    title: "Bougie & Company Boutique",
    description: "Country Roots. Luxury Taste.",
    url: siteUrl,
    siteName: "Bougie & Company Boutique",
    images: ["/images/logo.png"],
    locale: "en_US",
    type: "website"
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
  slogan: "Country Roots. Luxury Taste.",
  sameAs: ["https://facebook.com", "https://instagram.com", "https://tiktok.com"]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} font-sans antialiased`}>
        <Script id="organization-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <NewsletterPopup />
      </body>
    </html>
  );
}
