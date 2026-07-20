function inventoryRevision() {
  const revision = Number(process.env.DROPSHIPPING_FIXTURE_STOCK_REVISION || 1);
  return Number.isFinite(revision) && revision > 1 ? Math.trunc(revision) : 1;
}

export function dearLoverFixtureEnvelope() {
  const revision = inventoryRevision();
  const smallStock = revision > 1 ? 7 : 4;
  const mediumStock = revision > 1 ? 0 : 3;

  return {
    status: true,
    msg: "success",
    data: {
      page: 1,
      psize: 2,
      total: 2,
      total_page: 1,
      has_more: false,
      list: [
        {
          codeno: "FIX-DL-TOP-001",
          id: 900001,
          title: "[Fixture] Desert Rose Ribbed Knit Top",
          image_src: "https://placehold.co/900x1100/f6eee5/2f241d.jpg?text=Fixture+Top",
          second_image: "https://placehold.co/900x1100/efe1d3/2f241d.jpg?text=Fixture+Top+Back",
          alt_text: "Fixture product photo for Desert Rose Ribbed Knit Top",
          original_price: "18.00",
          sale_price: "12.29",
          suggest_price: "36.00",
          shipping_cost: "10.30",
          currency: "$",
          category_names: "Tops,Women Clothing",
          total_qty: smallStock + mediumStock,
          inventory_quantity: smallStock + mediumStock,
          warehouse_type: "fixture",
          route_url: "/fixture/desert-rose-ribbed-knit-top",
          variants: [
            {
              id: 990001,
              codeno: "FIX-DL-TOP-001-S",
              barcode: "FIXTURE0001",
              price: "12.2900",
              weight: "0.2500",
              is_instock: smallStock > 0 ? 1 : 0,
              size_name: "S",
              product_id: 900001,
              title: "Rose / Small",
              inventory_quantity: smallStock,
              color_size: {
                color: "Rose",
                size: "Small"
              }
            },
            {
              id: 990002,
              codeno: "FIX-DL-TOP-001-M",
              barcode: "FIXTURE0002",
              price: "12.2900",
              weight: "0.2700",
              is_instock: mediumStock > 0 ? 1 : 0,
              size_name: "M",
              product_id: 900001,
              title: "Rose / Medium",
              inventory_quantity: mediumStock,
              color_size: {
                color: "Rose",
                size: "Medium"
              }
            }
          ]
        },
        {
          codeno: "FIX-DL-DRESS-002",
          id: 900002,
          title: "[Fixture] Ranch Night Midi Dress",
          image_src: "https://placehold.co/900x1100/e8dccf/2f241d.jpg?text=Fixture+Dress",
          second_image: "",
          alt_text: "Fixture product photo for Ranch Night Midi Dress",
          original_price: "22.00",
          sale_price: "16.50",
          suggest_price: "48.00",
          shipping_cost: "8.95",
          currency: "$",
          category_names: "Dresses,Women Clothing",
          total_qty: 0,
          inventory_quantity: 0,
          warehouse_type: "fixture",
          route_url: "/fixture/ranch-night-midi-dress",
          variants: [
            {
              id: 990003,
              codeno: "FIX-DL-DRESS-002-L",
              barcode: "FIXTURE0003",
              price: "16.5000",
              weight: "0.4100",
              is_instock: 0,
              size_name: "L",
              product_id: 900002,
              title: "Black / Large",
              inventory_quantity: 0,
              color_size: {
                color: "Black",
                size: "Large"
              }
            }
          ]
        }
      ]
    }
  };
}
