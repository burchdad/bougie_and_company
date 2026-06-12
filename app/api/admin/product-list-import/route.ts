import { ensureProductAdminTables, isAdminRequest } from "@/lib/admin-products";
import { slugify } from "@/lib/categories";
import { getSql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ImportRow = {
  Name?: string | null;
  CategoryId?: string | null;
  SalePriceExTax?: string | number | null;
  SalePriceIncTax?: string | number | null;
  Description?: string | null;
  SellOnWeb?: string | null;
  Sku?: string | null;
  ImageUrl?: string | null;
};

type ProductRow = {
  epos_product_id: string;
  name: string | null;
  sku: string | null;
};

type CategoryNode = {
  label: string;
  slug?: string;
  children?: CategoryNode[];
};

const canonicalCategories: CategoryNode[] = [
  { label: "Accessories", children: [{ label: "Purses" }, { label: "Luggage" }, { label: "Caps" }, { label: "Coozies" }, { label: "Leather Coasters" }, { label: "Cocktail Infusions" }, { label: "Outdoor" }] },
  { label: "Equine Jewelry", children: [{ label: "Necklaces" }, { label: "Bracelets" }, { label: "Equine Earrings" }] },
  { label: "Men's Collection", slug: "mens-collection", children: [{ label: "T-Shirts" }, { label: "Men's Care", slug: "mens-care" }, { label: "Beard Products" }, { label: "Mechanic Soap" }] },
  { label: "Women's Collection", slug: "womens-collection", children: [{ label: "Dresses" }, { label: "Tops" }, { label: "Pants" }, { label: "Cardigans" }, { label: "Rompers & Jumpsuits" }] },
  { label: "Bath & Body", children: [{ label: "Bath Bombs" }, { label: "Bath Salts & Scrubs" }, { label: "Body Butter & Lotions" }, { label: "Chap Stick" }, { label: "Body Spray" }, { label: "Clay Mask" }, { label: "Handmade Soap" }, { label: "Week From Hell" }] },
  { label: "Candles", children: [{ label: "Soy 9oz" }, { label: "Soy Wax Melts" }, { label: "Candles & Wax Melts" }] },
  { label: "Home Collection", children: [{ label: "Tea Towels & Pillows" }, { label: "Farm Eggs" }] },
  { label: "Kitchen Selection", children: [{ label: "Dish Soap", slug: "homemade-dish-soap" }, { label: "Foaming Hand Soap" }, { label: "Dish Soap & Hand Soap" }] },
  { label: "Gift Collection", children: [{ label: "Gift Cards" }] },
  { label: "Jewelry", children: [{ label: "Fashion Earrings" }, { label: "Headbands" }] },
  { label: "Tack" }
];

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function normalize(value: unknown) {
  return cleanString(value).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeSku(value: unknown) {
  return cleanString(value).toUpperCase().replace(/\s+/g, "");
}

function variantFamilySku(value: unknown) {
  return normalizeSku(value)
    .replace(/(?:[-_ ]?X[-_ ]?SMALL|[-_ ]?XSMALL|[-_ ]?X[-_ ]?LARGE|[-_ ]?XLARGE|[-_ ]?SMALL|[-_ ]?MEDIUM|[-_ ]?LARGE|[-_ ]?XXS|[-_ ]?XS|[-_ ]?XL|[-_ ]?XXL|[-_ ]?XXXL|[-_ ]?2X|[-_ ]?3X|[-_ ]?4X|[-_ ]?5X|[-_ ]?OS)$/i, "")
    .trim();
}

function isVariantFamilySku(value: unknown) {
  const sku = normalizeSku(value);
  return Boolean(sku && variantFamilySku(sku) && variantFamilySku(sku) !== sku);
}

function titleWithoutLeadingSku(name: string, sku: string) {
  let title = name;
  if (sku) {
    title = title.replace(new RegExp(`^${sku.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i"), "");
  }
  return title.replace(/^[A-Z]{2,}\d+[A-Z0-9-]*\s+/i, "").replace(/\s+/g, " ").trim();
}

function comparableName(name: unknown, sku = "") {
  return normalize(titleWithoutLeadingSku(cleanString(name), sku));
}

function numberValue(value: unknown) {
  const parsed = Number(cleanString(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function publicImageUrl(value: unknown) {
  const url = cleanString(value);
  return /^https:\/\/api\.eposnowhq\.com\/v1\/image\//i.test(url) ? url : null;
}

function inferApparelSlug(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("draws with piping") || lower.includes("vneck short sleeves draws")) return "dresses";
  if (lower.includes("dress")) return "dresses";
  if (lower.includes("cardigan") || lower.includes("duster")) return "cardigans";
  if (lower.includes("romper") || lower.includes("jumpsuit") || lower.includes("jump suit")) return "rompers-jumpsuits";
  if (lower.includes("pant") || lower.includes("wideleg") || lower.includes("wide leg") || lower.includes("bottom") || lower.includes("short") || lower.includes("skirt")) return "pants";
  return "tops";
}

function inferEquineSlug(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("bracelet") || lower.includes("wrist") || lower.includes("wrap") || lower.includes("magnet")) return "bracelets";
  if (lower.includes("earring") || lower.includes("ear ring")) return "equine-earrings";
  return "necklaces";
}

function candleSlugsFor(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("wax melt")) {
    return ["candles", "soy-wax-melts"];
  }

  if (lower.includes("9oz") || lower.includes("9 oz")) {
    return ["candles", "soy-9oz"];
  }

  return ["candles", "candles-wax-melts"];
}

function kitchenSoapSlugsFor(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("foaming hand")) {
    return ["kitchen-selection", "foaming-hand-soap"];
  }

  if (lower.includes("dish soap")) {
    return ["kitchen-selection", "homemade-dish-soap"];
  }

  return ["kitchen-selection", "dish-soap-hand-soap"];
}

function categorySlugsFor(row: ImportRow) {
  const category = normalize(row.CategoryId);
  const name = cleanString(row.Name);
  const sku = normalizeSku(row.Sku);

  switch (category) {
    case "apparel":
      return ["womens-collection", inferApparelSlug(name)];
    case "bath bombs":
      return ["bath-body", "bath-bombs"];
    case "bath salts and scrubs":
      return ["bath-body", "bath-salts-scrubs"];
    case "beard products":
      return ["mens-collection", "mens-care", "beard-products"];
    case "body butter and lotions":
      return ["bath-body", "body-butter-lotions"];
    case "body spray":
      return ["bath-body", "body-spray"];
    case "candles and wax melts":
      return candleSlugsFor(name);
    case "caps":
      return ["accessories", "mens-collection", "caps"];
    case "chap stick":
      return ["bath-body", "chap-stick"];
    case "clay mask":
      return ["bath-body", "clay-mask"];
    case "cocktail infusions":
      return ["accessories", "cocktail-infusions"];
    case "coozie":
      return ["accessories", "coozies"];
    case "ear rings":
      return ["jewelry", "fashion-earrings"];
    case "equine jewlelry":
    case "equine jewelry":
      return ["equine-jewelry", inferEquineSlug(name)];
    case "farm eggs":
      return ["home-collection", "farm-eggs"];
    case "gift card":
      return ["gift-collection", "gift-cards"];
    case "handmade soap":
      return ["bath-body", "handmade-soap"];
    case "kitchen homemade dish disk soaps and hand soap":
      return kitchenSoapSlugsFor(name);
    case "leather coasters":
      if (sku === "BCLC591") return [];
      return ["accessories", "leather-coasters"];
    case "luggage":
      return ["accessories", "luggage"];
    case "mechanic soap":
      return ["mens-collection", "mens-care", "mechanic-soap"];
    case "outdoor":
      return ["accessories", "outdoor"];
    case "purses":
      return ["accessories", "purses", "womens-collection"];
    case "tanning 1month membership":
      return [];
    case "tea towels and pillows":
      return ["home-collection", "tea-towels-pillows"];
    case "t shirts":
      return ["mens-collection", "t-shirts"];
    case "week from hell":
      return ["bath-body", "week-from-hell"];
    default:
      return [];
  }
}

async function resetCategories() {
  const sql = getSql();
  const slugToId = new Map<string, number>();

  await sql`TRUNCATE TABLE site_categories RESTART IDENTITY CASCADE`;

  async function insert(nodes: CategoryNode[], parentId: number | null) {
    for (const [index, node] of nodes.entries()) {
      const slug = node.slug || slugify(node.label);
      const rows = await sql`
        INSERT INTO site_categories (label, slug, href, parent_id, sort_order, is_header)
        VALUES (${node.label}, ${slug}, ${`/shop#${slug}`}, ${parentId}, ${index}, ${parentId === null})
        RETURNING id::int, slug
      `;
      const id = Number(rows[0].id);
      slugToId.set(String(rows[0].slug), id);
      if (node.children?.length) {
        await insert(node.children, id);
      }
    }
  }

  await insert(canonicalCategories, null);
  return slugToId;
}

function categoryIdsFor(slugs: string[], slugToId: Map<string, number>) {
  return [...new Set(slugs.map((slug) => slugToId.get(slug)).filter((id): id is number => Number.isFinite(id)))];
}

function isApparelAssignment(slugs: string[]) {
  return slugs.some((slug) => ["womens-collection", "mens-collection", "tops", "pants", "cardigans", "dresses", "rompers-jumpsuits", "t-shirts"].includes(slug));
}

function chooseProductMatch(matches: ProductRow[], name: string, sku: string, alreadyMatched: Set<string>) {
  if (!matches.length) {
    return null;
  }

  const available = matches.filter((product) => !alreadyMatched.has(product.epos_product_id));
  const candidates = available.length ? available : matches;
  const rowName = normalize(name);
  const rowComparable = comparableName(name, sku);

  return (
    candidates.find((product) => normalize(product.name) === rowName) ||
    candidates.find((product) => comparableName(product.name, normalizeSku(product.sku)) === rowComparable) ||
    candidates.find((product) => {
      const productName = comparableName(product.name, normalizeSku(product.sku));
      return Boolean(productName && rowComparable && (productName.includes(rowComparable) || rowComparable.includes(productName)));
    }) ||
    candidates[0]
  );
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json()) as { rows?: ImportRow[]; resetCategories?: boolean; hideMissingProducts?: boolean };
  const importRows = Array.isArray(body.rows) ? body.rows : [];

  if (!importRows.length) {
    return Response.json({ ok: false, message: "No product rows were provided." }, { status: 400 });
  }

  await ensureProductAdminTables();

  const sql = getSql();
  const slugToId = body.resetCategories ? await resetCategories() : new Map<string, number>();

  if (!body.resetCategories) {
    const categoryRows = await sql`SELECT id::int, slug FROM site_categories`;
    categoryRows.forEach((row) => slugToId.set(String(row.slug), Number(row.id)));
  }

  const products = (await sql`SELECT epos_product_id, name, sku FROM epos_products WHERE is_deleted = FALSE`) as ProductRow[];
  const bySku = new Map<string, ProductRow[]>();
  const byName = new Map<string, ProductRow[]>();

  products.forEach((product) => {
    const sku = normalizeSku(product.sku);
    const name = normalize(product.name);
    if (sku) bySku.set(sku, [...(bySku.get(sku) || []), product]);
    if (name) byName.set(name, [...(byName.get(name) || []), product]);
  });

  const summary = {
    rows: importRows.length,
    matched: 0,
    unmatched: [] as Array<{ name: string; sku: string }>,
    updatedImages: 0,
    hidden: 0,
    hiddenMissing: 0,
    categoryAssignments: 0
  };
  const matchedProductIds = new Set<string>();

  for (const row of importRows) {
    const name = cleanString(row.Name);
    const sku = normalizeSku(row.Sku);

    if (!name || sku === "WEBSITE-SHIPPING") {
      continue;
    }

    const skuMatches = sku ? bySku.get(sku) || [] : [];
    const nameMatches = byName.get(normalize(name)) || [];
    const matches = [...skuMatches, ...nameMatches].filter((product, index, all) => all.findIndex((candidate) => candidate.epos_product_id === product.epos_product_id) === index);
    const product = chooseProductMatch(matches, name, sku, matchedProductIds);

    if (!product) {
      summary.unmatched.push({ name, sku });
      continue;
    }

    matchedProductIds.add(product.epos_product_id);

    const description = cleanString(row.Description) || name;
    const salePrice = numberValue(row.SalePriceExTax) ?? numberValue(row.SalePriceIncTax);
    const sellOnWeb = normalize(row.SellOnWeb) === "yes";
    const forceHidden = sku === "BCLC591";
    const isWebsiteHidden = forceHidden || !sellOnWeb || normalize(row.CategoryId) === "tanning 1month membership";
    const imageUrl = publicImageUrl(row.ImageUrl);
    const assignedSlugs = categorySlugsFor(row);
    const blockGuessedImageImport = forceHidden || (!imageUrl && assignedSlugs.includes("handmade-soap"));
    const assignedIds = categoryIdsFor(assignedSlugs, slugToId);

    await sql`
      UPDATE epos_products
      SET name = ${name},
        description = ${description},
        sku = ${sku || null},
        sale_price = ${salePrice},
        raw = COALESCE(raw, '{}'::jsonb) || ${JSON.stringify({
          Name: name,
          Description: description,
          Sku: sku || null,
          SalePrice: salePrice,
          SellOnWeb: sellOnWeb ? "yes" : "no",
          ImageUrl: imageUrl,
          SkipEposImageImport: blockGuessedImageImport
        })}::jsonb,
        synced_at = NOW()
      WHERE epos_product_id = ${product.epos_product_id}
    `;

    await sql`
      INSERT INTO product_site_meta (epos_product_id, marketing_title, marketing_description, department, is_hidden, updated_at)
      VALUES (${product.epos_product_id}, NULL, NULL, ${categorySlugsFor(row)[0] || null}, ${isWebsiteHidden}, NOW())
      ON CONFLICT (epos_product_id)
      DO UPDATE SET
        marketing_title = NULL,
        marketing_description = NULL,
        department = EXCLUDED.department,
        is_hidden = EXCLUDED.is_hidden,
        updated_at = NOW()
    `;

    await sql`DELETE FROM product_site_categories WHERE epos_product_id = ${product.epos_product_id}`;

    if (assignedIds.length) {
      await sql`
        INSERT INTO product_site_categories (epos_product_id, site_category_id)
        SELECT ${product.epos_product_id}, value::bigint
        FROM jsonb_array_elements_text(${JSON.stringify(assignedIds)}::jsonb)
        ON CONFLICT DO NOTHING
      `;
      summary.categoryAssignments += assignedIds.length;
    }

    const variantFamily = variantFamilySku(sku);
    if (variantFamily && isVariantFamilySku(sku) && isApparelAssignment(assignedSlugs) && assignedIds.length) {
      const siblingProducts = products.filter((candidate) => {
        if (candidate.epos_product_id === product.epos_product_id) {
          return false;
        }

        return variantFamilySku(candidate.sku) === variantFamily;
      });

      for (const sibling of siblingProducts) {
        matchedProductIds.add(sibling.epos_product_id);

        await sql`
          INSERT INTO product_site_meta (epos_product_id, marketing_title, marketing_description, department, is_hidden, updated_at)
          VALUES (${sibling.epos_product_id}, NULL, NULL, ${assignedSlugs[0] || null}, FALSE, NOW())
          ON CONFLICT (epos_product_id)
          DO UPDATE SET
            marketing_title = NULL,
            marketing_description = NULL,
            department = EXCLUDED.department,
            is_hidden = FALSE,
            updated_at = NOW()
        `;

        await sql`DELETE FROM product_site_categories WHERE epos_product_id = ${sibling.epos_product_id}`;
        await sql`
          INSERT INTO product_site_categories (epos_product_id, site_category_id)
          SELECT ${sibling.epos_product_id}, value::bigint
          FROM jsonb_array_elements_text(${JSON.stringify(assignedIds)}::jsonb)
          ON CONFLICT DO NOTHING
        `;
        summary.categoryAssignments += assignedIds.length;
      }
    }

    if (imageUrl) {
      await sql`DELETE FROM product_images WHERE epos_product_id = ${product.epos_product_id}`;
      await sql`
        INSERT INTO product_images (epos_product_id, url, pathname, alt_text, sort_order, is_primary)
        VALUES (${product.epos_product_id}, ${imageUrl}, NULL, ${name}, 0, TRUE)
      `;
      summary.updatedImages += 1;
    } else if (blockGuessedImageImport) {
      await sql`DELETE FROM product_images WHERE epos_product_id = ${product.epos_product_id}`;
    }

    if (isWebsiteHidden) {
      summary.hidden += 1;
    }
    summary.matched += 1;
  }

  if (body.hideMissingProducts) {
    const matchedJson = JSON.stringify([...matchedProductIds]);
    const hiddenRows = await sql`
      WITH matched AS (
        SELECT value::text AS epos_product_id
        FROM jsonb_array_elements_text(${matchedJson}::jsonb)
      ),
      missing AS (
        SELECT p.epos_product_id
        FROM epos_products p
        WHERE p.is_deleted = FALSE
          AND NOT EXISTS (SELECT 1 FROM matched m WHERE m.epos_product_id = p.epos_product_id)
      ),
      upserted AS (
        INSERT INTO product_site_meta (epos_product_id, is_hidden, updated_at)
        SELECT epos_product_id, TRUE, NOW()
        FROM missing
        ON CONFLICT (epos_product_id)
        DO UPDATE SET is_hidden = TRUE, updated_at = NOW()
        RETURNING epos_product_id
      )
      SELECT COUNT(*)::int AS count FROM upserted
    `;

    await sql`
      WITH matched AS (
        SELECT value::text AS epos_product_id
        FROM jsonb_array_elements_text(${matchedJson}::jsonb)
      )
      DELETE FROM product_site_categories pc
      WHERE NOT EXISTS (SELECT 1 FROM matched m WHERE m.epos_product_id = pc.epos_product_id)
    `;

    summary.hiddenMissing = Number(hiddenRows[0]?.count || 0);
  }

  return Response.json({ ok: true, message: "Product list import completed.", summary }, { headers: { "Cache-Control": "no-store" } });
}
