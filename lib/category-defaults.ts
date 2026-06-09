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
      { label: "Purses", href: "/shop#accessories" },
      { label: "Luggage", href: "/shop#accessories" },
      { label: "Home Collection", href: "/shop#home-collection", children: [{ label: "Candles", href: "/shop#home-collection", children: [{ label: "Soy 9oz", href: "/shop#home-collection" }, { label: "Soy Wax melts", href: "/shop#home-collection" }] }, { label: "Tea Towels / Pillows", href: "/shop#home-collection" }, { label: "Cocktail Mixers", href: "/shop#home-collection" }, { label: "Coasters", href: "/shop#home-collection", children: [{ label: "Regular", href: "/shop#home-collection" }, { label: "Leather", href: "/shop#home-collection" }] }, { label: "Outdoor Items", href: "/shop#home-collection" }] },
      { label: "Kitchen Collection", href: "/shop#kitchen-selection", children: [{ label: "Homemade Dish Soap", href: "/shop#kitchen-selection" }, { label: "Foaming Hand Soap", href: "/shop#kitchen-selection" }] },
      { label: "Bath & Body", href: "/shop#bath-body", children: [{ label: "Bath Bombs", href: "/shop#bath-body" }, { label: "Body Butter/Lotion", href: "/shop#bath-body" }, { label: "Chap Stick", href: "/shop#bath-body" }] },
      { label: "Gift Collection", href: "/shop#gift-collection" },
      { label: "Men's Care", href: "/shop#mens-collection", children: [{ label: "Bath Bombs", href: "/shop#mens-collection" }, { label: "Body Spray", href: "/shop#mens-collection" }, { label: "Beard Products", href: "/shop#mens-collection" }, { label: "Homemade Mechanic Soaps", href: "/shop#mens-collection" }] },
      { label: "Women's Care", href: "/shop#womens-collection", children: [{ label: "Week From Hell", href: "/shop#womens-collection" }, { label: "Bath Salts", href: "/shop#womens-collection" }, { label: "Body Scrubs", href: "/shop#womens-collection" }, { label: "Bath Bombs", href: "/shop#bath-body" }, { label: "Body Butter/Lotion", href: "/shop#womens-collection" }, { label: "Chap Stick", href: "/shop#womens-collection" }, { label: "Body Sprays", href: "/shop#womens-collection" }, { label: "Purses", href: "/shop#accessories" }] },
      { label: "Coozies", href: "/shop#accessories" },
      { label: "Leather Coasters", href: "/shop#accessories" },
      { label: "Cocktail Infusions", href: "/shop#accessories" },
      { label: "Soaps", href: "/shop#kitchen-selection", children: [{ label: "Homemade", href: "/shop#kitchen-selection" }, { label: "Foaming Hand Soap", href: "/shop#kitchen-selection" }] }
    ]
  },
  { label: "Equine Jewelry", href: "/shop#equine-jewelry", children: [{ label: "Necklaces", href: "/shop#equine-jewelry" }, { label: "Bracelets", href: "/shop#equine-jewelry" }, { label: "Earrings", href: "/shop#equine-jewelry" }] },
  { label: "Men's Collection", href: "/shop#mens-collection", children: [{ label: "T-Shirts", href: "/shop#mens-collection" }, { label: "Bath Bombs", href: "/shop#mens-collection" }, { label: "Caps", href: "/shop#accessories" }, { label: "Men's Care", href: "/shop#mens-collection", children: [{ label: "Bath Bombs", href: "/shop#mens-collection" }, { label: "Chap Stick", href: "/shop#mens-collection" }, { label: "Body Spray", href: "/shop#mens-collection" }, { label: "Beard Products", href: "/shop#mens-collection" }, { label: "Homemade Mechanic Soaps", href: "/shop#mens-collection" }] }, { label: "Luggage", href: "/shop#accessories" }, { label: "Coozies", href: "/shop#accessories" }] },
  { label: "Women's Collection", href: "/shop#womens-collection", children: [{ label: "Tops", href: "/shop#womens-collection" }, { label: "Bottoms", href: "/shop#womens-collection" }, { label: "Dresses", href: "/shop#womens-collection" }, { label: "Rompers & Jumpsuits", href: "/shop#womens-collection" }, { label: "Women's Care", href: "/shop#womens-collection", children: [{ label: "Week From Hell", href: "/shop#womens-collection" }, { label: "Bath Salts", href: "/shop#womens-collection" }, { label: "Body Scrubs", href: "/shop#womens-collection" }, { label: "Bath Bombs", href: "/shop#bath-body" }, { label: "Body Butter/Lotion", href: "/shop#womens-collection" }, { label: "Chap Stick", href: "/shop#womens-collection" }, { label: "Body Sprays", href: "/shop#womens-collection" }] }, { label: "Purses", href: "/shop#accessories" }, { label: "Luggage", href: "/shop#accessories" }] },
  { label: "Candles", href: "/shop#home-collection", children: [{ label: "Soy 9oz", href: "/shop#home-collection" }, { label: "Soy Wax melts", href: "/shop#home-collection" }] },
  { label: "Jewelry", href: "/shop#jewelry-headbands", children: [{ label: "Earrings", href: "/shop#jewelry-headbands" }, { label: "Bracelets", href: "/shop#jewelry-headbands" }, { label: "Headbands", href: "/shop#jewelry-headbands" }] }
];
