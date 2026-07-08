import type { MetadataRoute } from "next";

const baseUrl = "https://www.bougieandcompany.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ["/", "/shop", "/about", "/contact", "/shipping-returns", "/privacy-policy"].map((path, index) => ({
    url: `${baseUrl}${path === "/" ? "" : path}`,
    lastModified: now,
    changeFrequency: index === 0 || path === "/shop" ? "weekly" : "monthly",
    priority: index === 0 ? 1 : path === "/shop" ? 0.9 : 0.65
  }));
}
