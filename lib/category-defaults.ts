export type CategoryMenuItem = {
  id?: number;
  label: string;
  href: string;
  children?: CategoryMenuItem[];
};

export const defaultMenuItems: CategoryMenuItem[] = [
  {
    label: "Accessories",
    href: "/shop#accessories",
    children: [
      { label: "Purses", href: "/shop#purses" },
      { label: "Luggage", href: "/shop#luggage" },
      { label: "Home Collection", href: "/shop#home-collection", children: [{ label: "Candles", href: "/shop#home-collection", children: [{ label: "Soy 9oz", href: "/shop#home-collection" }, { label: "Soy Wax melts", href: "/shop#home-collection" }] }, { label: "Tea Towels / Pillows", href: "/shop#home-collection" }, { label: "Cocktail Mixers", href: "/shop#home-collection" }, { label: "Coasters", href: "/shop#home-collection", children: [{ label: "Regular", href: "/shop#home-collection" }, { label: "Leather", href: "/shop#home-collection" }] }, { label: "Outdoor Items", href: "/shop#home-collection" }] },
      { label: "Kitchen Collection", href: "/shop#kitchen-selection", children: [{ label: "Homemade Dish Soap", href: "/shop#kitchen-selection" }, { label: "Foaming Hand Soap", href: "/shop#kitchen-selection" }] },
      { label: "Bath & Body", href: "/shop#bath-body", children: [{ label: "Bath Bombs", href: "/shop#bath-bombs" }, { label: "Body Butter/Lotion", href: "/shop#body-butter-lotions" }, { label: "Chap Stick", href: "/shop#chap-stick" }, { label: "Handmade Soap", href: "/shop#handmade-soap" }] },
      { label: "Gift Collection", href: "/shop#gift-collection" },
      { label: "Men's Care", href: "/shop#mens-care", children: [{ label: "Body Spray", href: "/shop#body-spray" }, { label: "Beard Products", href: "/shop#beard-products" }, { label: "Homemade Mechanic Soaps", href: "/shop#mechanic-soap" }] },
      { label: "Women's Care", href: "/shop#womens-care", children: [{ label: "Week From Hell", href: "/shop#week-from-hell" }, { label: "Bath Salts", href: "/shop#bath-salts-scrubs" }, { label: "Body Scrubs", href: "/shop#bath-salts-scrubs" }, { label: "Bath Bombs", href: "/shop#bath-bombs" }, { label: "Body Butter/Lotion", href: "/shop#body-butter-lotions" }, { label: "Chap Stick", href: "/shop#chap-stick" }, { label: "Body Sprays", href: "/shop#body-spray" }, { label: "Purses", href: "/shop#purses" }] },
      { label: "Coozies", href: "/shop#coozies" },
      { label: "Leather Coasters", href: "/shop#leather-coasters" },
      { label: "Cocktail Infusions", href: "/shop#cocktail-infusions" },
      { label: "Soaps", href: "/shop#handmade-soap", children: [{ label: "Homemade", href: "/shop#handmade-soap" }, { label: "Foaming Hand Soap", href: "/shop#foaming-hand-soap" }] }
    ]
  },
  { label: "Equine Jewelry", href: "/shop#equine-jewelry", children: [{ label: "Necklaces", href: "/shop#equine-jewelry" }, { label: "Bracelets", href: "/shop#equine-jewelry" }, { label: "Earrings", href: "/shop#equine-jewelry" }] },
  { label: "Tack", href: "/shop#tack" },
  { label: "Men's Collection", href: "/shop#mens-collection", children: [{ label: "T-Shirts", href: "/shop#t-shirts" }, { label: "Caps", href: "/shop#caps" }, { label: "Men's Care", href: "/shop#mens-care", children: [{ label: "Chap Stick", href: "/shop#chap-stick" }, { label: "Body Spray", href: "/shop#body-spray" }, { label: "Beard Products", href: "/shop#beard-products" }, { label: "Homemade Mechanic Soaps", href: "/shop#mechanic-soap" }] }, { label: "Luggage", href: "/shop#luggage" }, { label: "Coozies", href: "/shop#coozies" }] },
  { label: "Women's Collection", href: "/shop#womens-collection", children: [{ label: "Tops", href: "/shop#tops" }, { label: "Bottoms", href: "/shop#bottoms" }, { label: "Dresses", href: "/shop#dresses" }, { label: "Rompers & Jumpsuits", href: "/shop#rompers-jumpsuits" }, { label: "Women's Care", href: "/shop#womens-care", children: [{ label: "Week From Hell", href: "/shop#week-from-hell" }, { label: "Bath Salts", href: "/shop#bath-salts-scrubs" }, { label: "Body Scrubs", href: "/shop#bath-salts-scrubs" }, { label: "Bath Bombs", href: "/shop#bath-bombs" }, { label: "Body Butter/Lotion", href: "/shop#body-butter-lotions" }, { label: "Chap Stick", href: "/shop#chap-stick" }, { label: "Body Sprays", href: "/shop#body-spray" }] }, { label: "Purses", href: "/shop#purses" }, { label: "Luggage", href: "/shop#luggage" }] },
  { label: "Candles", href: "/shop#home-collection", children: [{ label: "Soy 9oz", href: "/shop#home-collection" }, { label: "Soy Wax melts", href: "/shop#home-collection" }] },
  { label: "Jewelry", href: "/shop#jewelry-headbands", children: [{ label: "Earrings", href: "/shop#jewelry-headbands" }, { label: "Bracelets", href: "/shop#jewelry-headbands" }, { label: "Headbands", href: "/shop#jewelry-headbands" }] }
];
