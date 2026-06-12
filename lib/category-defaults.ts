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
      { label: "Home Collection", href: "/shop#home-collection", children: [{ label: "Candles", href: "/shop#candles", children: [{ label: "Soy 9oz", href: "/shop#soy-9oz" }, { label: "Soy Wax melts", href: "/shop#soy-wax-melts" }] }, { label: "Tea Towels / Pillows", href: "/shop#tea-towels-pillows" }, { label: "Cocktail Infusions", href: "/shop#cocktail-infusions" }, { label: "Coasters", href: "/shop#leather-coasters", children: [{ label: "Leather", href: "/shop#leather-coasters" }] }, { label: "Outdoor Items", href: "/shop#outdoor" }] },
      { label: "Kitchen Collection", href: "/shop#kitchen-selection", children: [{ label: "Soaps", href: "/shop#soaps", children: [{ label: "Foaming Hand Soaps", href: "/shop#foaming-hand-soap" }, { label: "Hand Soaps", href: "/shop#hand-soaps" }] }] },
      { label: "Bath & Body", href: "/shop#bath-body", children: [{ label: "Bath Bombs", href: "/shop#bath-bombs" }, { label: "Body Butter/Lotion", href: "/shop#body-butter-lotions" }, { label: "Chap Stick", href: "/shop#chap-stick" }, { label: "Handmade Soap", href: "/shop#handmade-soap" }] },
      { label: "Gift Collection", href: "/shop#gift-collection", children: [{ label: "Gift Cards", href: "/shop#gift-cards" }, { label: "Gift Baskets", href: "/shop#gift-basket" }] },
      { label: "Men's Care", href: "/shop#mens-care", children: [{ label: "Body Spray", href: "/shop#body-spray" }, { label: "Beard Products", href: "/shop#beard-products" }, { label: "Homemade Mechanic Soaps", href: "/shop#mechanic-soap" }] },
      { label: "Women's Care", href: "/shop#bath-body", children: [{ label: "Week From Hell", href: "/shop#week-from-hell" }, { label: "Bath Salts", href: "/shop#bath-salts-scrubs" }, { label: "Body Scrubs", href: "/shop#bath-salts-scrubs" }, { label: "Bath Bombs", href: "/shop#bath-bombs" }, { label: "Body Butter/Lotion", href: "/shop#body-butter-lotions" }, { label: "Chap Stick", href: "/shop#chap-stick" }, { label: "Body Sprays", href: "/shop#body-spray" }, { label: "Purses", href: "/shop#purses" }] },
      { label: "Coozies", href: "/shop#coozies" },
      { label: "Leather Coasters", href: "/shop#leather-coasters" },
      { label: "Cocktail Infusions", href: "/shop#cocktail-infusions" },
      { label: "Farm Fresh Eggs", href: "/shop#farm-eggs" }
    ]
  },
  { label: "Equine Jewelry", href: "/shop#equine-jewelry", children: [{ label: "Necklaces", href: "/shop#necklaces" }, { label: "Bracelets", href: "/shop#bracelets" }, { label: "Earrings", href: "/shop#equine-earrings" }] },
  { label: "Men's Collection", href: "/shop#mens-collection", children: [{ label: "T-Shirts", href: "/shop#t-shirts" }, { label: "Caps", href: "/shop#caps" }, { label: "Men's Care", href: "/shop#mens-care", children: [{ label: "Chap Stick", href: "/shop#chap-stick" }, { label: "Body Spray", href: "/shop#body-spray" }, { label: "Beard Products", href: "/shop#beard-products" }, { label: "Homemade Mechanic Soaps", href: "/shop#mechanic-soap" }] }, { label: "Luggage", href: "/shop#luggage" }, { label: "Coozies", href: "/shop#coozies" }] },
  { label: "Women's Collection", href: "/shop#womens-collection", children: [{ label: "Tops", href: "/shop#tops" }, { label: "Cardigans", href: "/shop#cardigans" }, { label: "Pants", href: "/shop#pants" }, { label: "Dresses", href: "/shop#dresses" }, { label: "Rompers & Jumpsuits", href: "/shop#rompers-jumpsuits" }, { label: "Women's Care", href: "/shop#bath-body", children: [{ label: "Week From Hell", href: "/shop#week-from-hell" }, { label: "Bath Salts", href: "/shop#bath-salts-scrubs" }, { label: "Body Scrubs", href: "/shop#bath-salts-scrubs" }, { label: "Bath Bombs", href: "/shop#bath-bombs" }, { label: "Body Butter/Lotion", href: "/shop#body-butter-lotions" }, { label: "Chap Stick", href: "/shop#chap-stick" }, { label: "Body Sprays", href: "/shop#body-spray" }] }, { label: "Purses", href: "/shop#purses" }, { label: "Luggage", href: "/shop#luggage" }] },
  { label: "Candles", href: "/shop#candles", children: [{ label: "Soy 9oz", href: "/shop#soy-9oz" }, { label: "Soy Wax melts", href: "/shop#soy-wax-melts" }] },
  { label: "Jewelry", href: "/shop#jewelry", children: [{ label: "Earrings", href: "/shop#fashion-earrings" }] }
];
