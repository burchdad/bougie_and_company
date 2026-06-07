import {
  Bath,
  BriefcaseBusiness,
  Crown,
  Gift,
  Home,
  Shirt,
  Sparkles,
  TentTree
} from "lucide-react";

export const navItems = [
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" }
];

export const categories = [
  { name: "Clothing", href: "/shop#clothing", icon: Shirt, tone: "from-cream to-champagne/40" },
  { name: "Equine Jewelry", href: "/shop#equine-jewelry", icon: Sparkles, tone: "from-ivory to-saddle/20" },
  { name: "Bath & Body", href: "/shop#bath-body", icon: Bath, tone: "from-cream to-ember/15" },
  { name: "Home Decor", href: "/shop#home-collection", icon: Home, tone: "from-ivory to-navy/10" },
  { name: "Gifts", href: "/shop#gift-collection", icon: Gift, tone: "from-cream to-champagne/50" },
  { name: "Men's Collection", href: "/shop#mens-collection", icon: BriefcaseBusiness, tone: "from-ivory to-espresso/15" }
];

export const bestSellers = [
  {
    name: "Saddle Stitch Weekender",
    category: "Accessories",
    price: "$148",
    description: "A structured travel piece with western polish and city-ready hardware."
  },
  {
    name: "Champagne Trail Body Butter",
    category: "Bath & Body",
    price: "$28",
    description: "A rich, soft finish for slow mornings, dress nights, and everything between."
  },
  {
    name: "Sterling Reins Necklace",
    category: "Equine Jewelry",
    price: "$64",
    description: "Equine-inspired shine with a refined boutique silhouette."
  },
  {
    name: "Rusk Ranch Candle",
    category: "Home Collection",
    price: "$36",
    description: "Warm woods, amber spice, and a clean burn for a dressed-up home."
  }
];

export const shopDepartments = [
  {
    id: "clothing",
    title: "Clothing",
    items: ["Tops", "Bottoms", "Dresses", "Cardigans", "Outerwear"]
  },
  {
    id: "equine-jewelry",
    title: "Equine Jewelry",
    items: ["Necklaces", "Bracelets", "Earrings"]
  },
  {
    id: "accessories",
    title: "Accessories",
    items: ["Purses", "Luggage", "Belts", "Hats"]
  },
  {
    id: "bath-body",
    title: "Bath & Body",
    items: ["Bath Bombs", "Body Spray", "Bath Salts", "Body Scrubs", "Clay Masks", "Body Butter", "Lotion", "Handmade Soaps"]
  },
  {
    id: "home-collection",
    title: "Home Collection",
    items: ["Candles", "Wax Melts", "Tea Towels", "Decorative Pillows", "Handmade Leather Coasters"]
  },
  {
    id: "mens-collection",
    title: "Men's Collection",
    items: ["Men's Care", "Outdoor Items", "Survival Kits"]
  },
  {
    id: "gift-collection",
    title: "Gift Collection",
    items: ["Gift Sets"]
  }
];

export const lifestyles = [
  { title: "For Her", text: "Boutique layers, statement accessories, and self-care staples.", icon: Crown },
  { title: "For Him", text: "Care goods, outdoor finds, and practical luxuries.", icon: TentTree },
  { title: "For Home", text: "Candles, textiles, leather details, and hosting pieces.", icon: Home },
  { title: "Gift Ideas", text: "Ready-to-give sets with Southern polish.", icon: Gift }
];

export const shippingFaq = [
  ["Order Processing", "Orders are prepared with care within 2-4 business days. Processing times may extend slightly during holidays, launches, or promotional events."],
  ["Shipping Methods", "Bougie & Company Boutique offers standard shipping options for domestic orders. Available rates and estimated delivery windows will be shown at checkout."],
  ["Tracking Information", "When an order ships, customers receive a confirmation email with tracking details. Tracking updates may take up to 24 hours to appear after carrier pickup."],
  ["Delivery Restrictions", "Some oversized, fragile, or specialty items may require additional handling or may not be eligible for every destination."],
  ["Lost or Damaged Packages", "If a package arrives damaged or appears lost in transit, contact the boutique promptly with the order number and supporting photos when applicable."],
  ["Returns & Refunds", "Eligible returns must be unused, unworn, and in original condition with tags or packaging intact. Refunds are issued after the returned item has been received and inspected."],
  ["Final Sale Policy", "Gift cards, intimate goods, opened bath and body products, seasonal markdowns, and clearly marked final sale items are not eligible for return."]
] satisfies Array<[string, string]>;

export const privacyFaq = [
  ["Information We Collect", "Bougie & Company Boutique may collect contact, shipping, billing, account, and browsing information needed to process orders and improve the shopping experience."],
  ["How Information Is Used", "Information is used for order fulfillment, customer support, account access, marketing opt-ins, fraud prevention, and site performance."],
  ["Email Marketing", "Customers may join the email list to receive product releases, promotions, and boutique updates. Unsubscribe options are included in marketing emails."],
  ["Cookies & Analytics", "The website may use cookies and analytics tools to understand traffic, remember preferences, and improve performance."],
  ["Sharing Information", "Customer information is shared only with trusted service providers required for payment processing, shipping, analytics, marketing, and site operations."],
  ["Data Security", "Reasonable administrative, technical, and physical safeguards are used to protect customer information."],
  ["Customer Rights", "Customers may request updates, deletion, or access to certain personal information by contacting the boutique."]
] satisfies Array<[string, string]>;
