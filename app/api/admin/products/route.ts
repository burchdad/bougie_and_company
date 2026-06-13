import { ensureProductAdminTables, getAdminProducts, isAdminRequest } from "@/lib/admin-products";
import { getSql } from "@/lib/db";
import { createEposProduct, createEposProductStock, deleteEposProduct, getEposId, getEposNumber, getEposString, updateEposProduct, updateEposProductStock } from "@/lib/epos";
import { inferDepartment } from "@/lib/product-categorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductPatchRow = {
  raw: Record<string, unknown> | null;
  name: string | null;
  description: string | null;
  sku: string | null;
  sale_price: string | null;
  category_id: string | null;
  epos_stock_id: string | null;
  stock_raw: Record<string, unknown> | null;
};

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedLimit = Number(searchParams.get("limit") || 1000);
  const products = await getAdminProducts(searchParams.get("q")?.trim() || "", Number.isFinite(requestedLimit) ? requestedLimit : 1000);
  return Response.json({ ok: true, products }, { headers: { "Cache-Control": "no-store" } });
}

async function getEposCategoryIdForDepartment(department: string | null) {
  if (!department) {
    return null;
  }

  const sql = getSql();
  const rows = await sql`
    SELECT epos_category_id
    FROM site_categories
    WHERE epos_category_id IS NOT NULL
      AND (
        slug = ${department}
        OR href = ${`/shop#${department}`}
      )
    ORDER BY parent_id NULLS FIRST, sort_order ASC
    LIMIT 1
  `;

  return rows[0]?.epos_category_id ? String(rows[0].epos_category_id) : null;
}

async function getCategoryAssignments(categoryIds: number[]) {
  if (!categoryIds.length) {
    return { categoryIds: [] as number[], primarySlug: null as string | null, eposCategoryId: null as string | null };
  }

  const sql = getSql();
  const rows = await sql`
    WITH selected AS (
      SELECT id, parent_id
      FROM site_categories
      WHERE id IN (SELECT value::bigint FROM jsonb_array_elements_text(${JSON.stringify(categoryIds)}::jsonb))
    ),
    expanded AS (
      SELECT id FROM selected
      UNION
      SELECT parent_id AS id FROM selected WHERE parent_id IS NOT NULL
    )
    SELECT c.id::int, c.slug, c.epos_category_id
    FROM site_categories c
    JOIN expanded e ON e.id = c.id
    ORDER BY c.parent_id NULLS FIRST, c.sort_order ASC, c.label ASC
  `;

  const assignedIds = rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
  const firstWithEpos = rows.find((row) => row.epos_category_id);

  return {
    categoryIds: assignedIds,
    primarySlug: rows[0]?.slug ? String(rows[0].slug) : null,
    eposCategoryId: firstWithEpos?.epos_category_id ? String(firstWithEpos.epos_category_id) : null
  };
}

async function saveProductCategoryAssignments(productId: string, categoryIds: number[]) {
  const sql = getSql();

  await sql`DELETE FROM product_site_categories WHERE epos_product_id = ${productId}`;

  if (!categoryIds.length) {
    return;
  }

  await sql`
    INSERT INTO product_site_categories (epos_product_id, site_category_id)
    SELECT ${productId}, value::bigint
    FROM jsonb_array_elements_text(${JSON.stringify(categoryIds)}::jsonb)
    ON CONFLICT DO NOTHING
  `;
}

async function applyStorefrontStockOverride(productId: string, stock: number) {
  const sql = getSql();

  await sql`
    INSERT INTO product_site_meta (epos_product_id, storefront_stock_override, updated_at)
    VALUES (${productId}, ${stock}, NOW())
    ON CONFLICT (epos_product_id)
    DO UPDATE SET storefront_stock_override = EXCLUDED.storefront_stock_override, updated_at = NOW()
  `;
}

async function clearStorefrontStockOverride(productId: string) {
  const sql = getSql();

  await sql`
    UPDATE product_site_meta
    SET storefront_stock_override = NULL,
      updated_at = NOW()
    WHERE epos_product_id = ${productId}
  `;
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    marketingTitle?: string;
    marketingDescription?: string;
    department?: string;
    categoryIds?: number[];
    isFeatured?: boolean;
    isHidden?: boolean;
    eposName?: string;
    eposDescription?: string;
    eposSku?: string;
    eposSalePrice?: string;
    eposStock?: string;
  };

  await ensureProductAdminTables();

  const eposName = body.eposName?.trim() || body.marketingTitle?.trim();
  const eposDescription = body.eposDescription?.trim() || body.marketingDescription?.trim() || eposName || "";
  const eposSku = body.eposSku?.trim() || "";
  const eposSalePrice = body.eposSalePrice && body.eposSalePrice.trim() !== "" ? Number(body.eposSalePrice) : null;
  const eposStock = body.eposStock && body.eposStock.trim() !== "" ? Number(body.eposStock) : null;
  const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds.map(Number).filter((id) => Number.isFinite(id)) : [];
  const categoryAssignments = await getCategoryAssignments(categoryIds);
  const department = categoryAssignments.primarySlug || body.department?.trim() || inferDepartment({ name: eposName, description: eposDescription, sku: eposSku });

  if (!eposName) {
    return Response.json({ ok: false, message: "Product name is required." }, { status: 400 });
  }

  if ((eposSalePrice !== null && Number.isNaN(eposSalePrice)) || (eposStock !== null && Number.isNaN(eposStock))) {
    return Response.json({ ok: false, message: "Price and stock must be valid numbers." }, { status: 400 });
  }

  const eposCategoryId = categoryAssignments.eposCategoryId || (await getEposCategoryIdForDepartment(department));
  let eposProduct: Record<string, unknown>;
  let eposProductId: string | null;

  try {
    eposProduct = await createEposProduct({
      name: eposName,
      description: eposDescription,
      sku: eposSku,
      salePrice: eposSalePrice,
      categoryId: eposCategoryId
    });
    eposProductId = getEposId(eposProduct);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Epos product creation failed.";
    console.error(message);
    return Response.json({ ok: false, message: `Epos rejected the new product: ${message}` }, { status: 502 });
  }

  if (!eposProductId) {
    return Response.json({ ok: false, message: "Epos created the product but did not return an ID." }, { status: 502 });
  }

  const sql = getSql();
  const productName = getEposString(eposProduct, ["Name", "name"]) || eposName;
  const productDescription = getEposString(eposProduct, ["Description", "description"]) || eposDescription;
  const productSku = getEposString(eposProduct, ["Sku", "SKU", "sku"]) || eposSku || null;
  const productBarcode = getEposString(eposProduct, ["Barcode", "BarCode", "barcode"]);
  const productCategoryId = getEposNumber(eposProduct, ["CategoryId", "categoryId"]) ?? (eposCategoryId ? Number(eposCategoryId) : null);
  const productSalePrice = getEposNumber(eposProduct, ["SalePrice", "salePrice"]) ?? eposSalePrice;
  const productCostPrice = getEposNumber(eposProduct, ["CostPrice", "costPrice"]);

  await sql`
    INSERT INTO epos_products (
      epos_product_id,
      name,
      description,
      sku,
      barcode,
      category_id,
      sale_price,
      cost_price,
      raw,
      is_deleted,
      synced_at
    )
    VALUES (
      ${eposProductId},
      ${productName},
      ${productDescription || null},
      ${productSku},
      ${productBarcode},
      ${productCategoryId},
      ${productSalePrice},
      ${productCostPrice},
      ${JSON.stringify(eposProduct)}::jsonb,
      FALSE,
      NOW()
    )
    ON CONFLICT (epos_product_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      sku = EXCLUDED.sku,
      barcode = EXCLUDED.barcode,
      category_id = EXCLUDED.category_id,
      sale_price = EXCLUDED.sale_price,
      cost_price = EXCLUDED.cost_price,
      raw = EXCLUDED.raw || jsonb_strip_nulls(jsonb_build_object(
        'SkipEposImageImport',
        CASE WHEN epos_products.raw->>'SkipEposImageImport' = 'true' THEN true ELSE NULL END,
        'DisableFuzzyImageFallback',
        CASE WHEN epos_products.raw->>'DisableFuzzyImageFallback' = 'true' THEN true ELSE NULL END
      )),
      is_deleted = FALSE,
      synced_at = NOW()
  `;

  if (eposStock !== null) {
    try {
      const stock = await createEposProductStock({ productId: eposProductId, currentStock: eposStock });
      const stockId = getEposId(stock);
      if (stockId) {
        await sql`
          INSERT INTO epos_product_stock (epos_stock_id, epos_product_id, location_id, current_stock, raw, synced_at)
          VALUES (${stockId}, ${Number(eposProductId)}, ${getEposNumber(stock, ["LocationId", "locationId"])}, ${eposStock}, ${JSON.stringify(stock)}::jsonb, NOW())
          ON CONFLICT (epos_stock_id)
          DO UPDATE SET current_stock = EXCLUDED.current_stock, raw = EXCLUDED.raw, synced_at = NOW()
        `;
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Epos stock creation failed.");
      await applyStorefrontStockOverride(eposProductId, eposStock);
    }
  }

  await sql`
    INSERT INTO product_site_meta (
      epos_product_id,
      marketing_title,
      marketing_description,
      department,
      is_featured,
      is_hidden,
      updated_at
    )
    VALUES (
      ${eposProductId},
      ${body.marketingTitle?.trim() || null},
      ${body.marketingDescription?.trim() || null},
      ${department},
      ${Boolean(body.isFeatured)},
      ${Boolean(body.isHidden)},
      NOW()
    )
    ON CONFLICT (epos_product_id)
    DO UPDATE SET
      marketing_title = EXCLUDED.marketing_title,
      marketing_description = EXCLUDED.marketing_description,
      department = EXCLUDED.department,
      is_featured = EXCLUDED.is_featured,
      is_hidden = EXCLUDED.is_hidden,
      updated_at = NOW()
  `;

  await saveProductCategoryAssignments(eposProductId, categoryAssignments.categoryIds);

  return Response.json({ ok: true, message: "Product created in Epos and saved to Neon.", productId: eposProductId }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    eposProductId?: string;
    marketingTitle?: string;
    marketingDescription?: string;
    department?: string;
    categoryIds?: number[];
    isFeatured?: boolean;
    isHidden?: boolean;
    eposName?: string;
    eposDescription?: string;
    eposSku?: string;
    eposSalePrice?: string;
    eposStock?: string;
  };

  if (!body.eposProductId) {
    return Response.json({ ok: false, message: "Missing product ID." }, { status: 400 });
  }

  await ensureProductAdminTables();

  const sql = getSql();
  const productRows = await sql`
    SELECT
      p.raw,
      p.name,
      p.description,
      p.sku,
      p.sale_price::text,
      p.category_id::text,
      s.epos_stock_id,
      s.raw AS stock_raw
    FROM epos_products p
    LEFT JOIN LATERAL (
      SELECT epos_stock_id, raw
      FROM epos_product_stock
      WHERE epos_product_id::text = p.epos_product_id
      ORDER BY location_id ASC NULLS LAST, epos_stock_id ASC
      LIMIT 1
    ) s ON TRUE
    WHERE p.epos_product_id = ${body.eposProductId}
    LIMIT 1
  `;

  if (!productRows.length) {
    return Response.json({ ok: false, message: "Product not found in Neon cache." }, { status: 404 });
  }

  const productRow = productRows[0] as ProductPatchRow;
  const eposName = body.eposName?.trim() || body.marketingTitle?.trim() || "Untitled product";
  const eposDescription = body.eposDescription?.trim() || body.marketingDescription?.trim() || eposName;
  const eposSku = body.eposSku?.trim() || "";
  const eposSalePrice = body.eposSalePrice && body.eposSalePrice.trim() !== "" ? Number(body.eposSalePrice) : null;
  const eposStock = body.eposStock && body.eposStock.trim() !== "" ? Number(body.eposStock) : null;
  const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds.map(Number).filter((id) => Number.isFinite(id)) : [];
  const categoryAssignments = await getCategoryAssignments(categoryIds);
  const department = categoryAssignments.primarySlug || body.department?.trim() || inferDepartment({ name: eposName, description: eposDescription, sku: eposSku });

  if ((eposSalePrice !== null && Number.isNaN(eposSalePrice)) || (eposStock !== null && Number.isNaN(eposStock))) {
    return Response.json({ ok: false, message: "Price and stock must be valid numbers." }, { status: 400 });
  }

  const eposCategoryId = categoryAssignments.eposCategoryId || (await getEposCategoryIdForDepartment(department));
  let detailFallbackMessage: string | null = null;
  let stockFallbackMessage: string | null = null;
  const currentSalePrice = productRow.sale_price !== null && productRow.sale_price !== undefined ? Number(productRow.sale_price) : null;
  const productDetailsChanged =
    eposName !== (productRow.name || "") ||
    eposDescription !== (productRow.description || "") ||
    eposSku !== (productRow.sku || "") ||
    (Number.isFinite(Number(eposSalePrice)) ? Number(eposSalePrice) : null) !== (Number.isFinite(Number(currentSalePrice)) ? Number(currentSalePrice) : null) ||
    (eposCategoryId ? eposCategoryId !== String(productRow.category_id || "") : false);

  if (productDetailsChanged) {
    try {
      await updateEposProduct(body.eposProductId, productRow.raw || {}, {
        name: eposName,
        description: eposDescription,
        sku: eposSku,
        salePrice: eposSalePrice,
        categoryId: eposCategoryId
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Epos update failed.";
      console.error(message);
      detailFallbackMessage = ` Epos rejected the product detail update, so those fields were saved to the website cache only: ${message}.`;
    }
  }

  if (eposStock !== null) {
    try {
      if (productRow.epos_stock_id) {
        await updateEposProductStock(String(productRow.epos_stock_id), productRow.stock_raw || {}, eposStock);
      } else {
        const stock = await createEposProductStock({ productId: body.eposProductId, currentStock: eposStock });
        const stockId = getEposId(stock);

        if (!stockId) {
          throw new Error("Epos created stock but did not return a stock ID.");
        }

        await sql`
          INSERT INTO epos_product_stock (epos_stock_id, epos_product_id, location_id, current_stock, raw, synced_at)
          VALUES (${stockId}, ${Number(body.eposProductId)}, ${getEposNumber(stock, ["LocationId", "locationId"])}, ${eposStock}, ${JSON.stringify(stock)}::jsonb, NOW())
          ON CONFLICT (epos_stock_id)
          DO UPDATE SET current_stock = EXCLUDED.current_stock, raw = EXCLUDED.raw, synced_at = NOW()
        `;
      }

      await clearStorefrontStockOverride(body.eposProductId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Epos stock update failed.";
      console.error(message);
      await applyStorefrontStockOverride(body.eposProductId, eposStock);
      stockFallbackMessage = ` Epos rejected the stock update, so storefront stock was saved in Neon as ${eposStock}.`;
    }
  }

  await sql`
    UPDATE epos_products
    SET name = ${eposName},
      description = ${eposDescription},
      sku = ${eposSku || null},
      category_id = COALESCE(${eposCategoryId ? Number(eposCategoryId) : null}, category_id),
      sale_price = ${eposSalePrice},
      raw = jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(COALESCE(raw, '{}'::jsonb), '{Name}', to_jsonb(${eposName}::text), true),
            '{Description}',
            to_jsonb(${eposDescription}::text),
            true
          ),
          '{Sku}',
          to_jsonb(${eposSku}::text),
          true
        ),
        '{SalePrice}',
        to_jsonb(${eposSalePrice}::numeric),
        true
      ),
      synced_at = NOW()
    WHERE epos_product_id = ${body.eposProductId}
  `;

  if (eposStock !== null && productRow.epos_stock_id) {
    await sql`
      UPDATE epos_product_stock
      SET current_stock = ${eposStock},
        raw = jsonb_set(COALESCE(raw, '{}'::jsonb), '{CurrentStock}', to_jsonb(${eposStock}::numeric), true),
        synced_at = NOW()
      WHERE epos_stock_id = ${String(productRow.epos_stock_id)}
    `;
  }

  await sql`
    INSERT INTO product_site_meta (
      epos_product_id,
      marketing_title,
      marketing_description,
      department,
      is_featured,
      is_hidden,
      updated_at
    )
    VALUES (
      ${body.eposProductId},
      ${body.marketingTitle?.trim() || null},
      ${body.marketingDescription?.trim() || null},
      ${department},
      ${Boolean(body.isFeatured)},
      ${Boolean(body.isHidden)},
      NOW()
    )
    ON CONFLICT (epos_product_id)
    DO UPDATE SET
      marketing_title = EXCLUDED.marketing_title,
      marketing_description = EXCLUDED.marketing_description,
      department = EXCLUDED.department,
      is_featured = EXCLUDED.is_featured,
      is_hidden = EXCLUDED.is_hidden,
      updated_at = NOW()
  `;

  await saveProductCategoryAssignments(body.eposProductId, categoryAssignments.categoryIds);

  return Response.json({ ok: true, message: `Product website details saved.${detailFallbackMessage || ""}${stockFallbackMessage || ""}` }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("id")?.trim();

  if (!productId) {
    return Response.json({ ok: false, message: "Missing product ID." }, { status: 400 });
  }

  await ensureProductAdminTables();

  const sql = getSql();
  const productRows = await sql`
    SELECT epos_product_id, name
    FROM epos_products
    WHERE epos_product_id = ${productId}
    LIMIT 1
  `;
  const productName = productRows[0]?.name ? String(productRows[0].name) : "Product";
  let eposMessage = " Product delete was sent to Epos.";

  try {
    await deleteEposProduct(productId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Epos delete failed.";
    console.error(message);
    eposMessage = ` Epos did not accept the delete request, so this product is now suppressed locally and future catalog syncs will keep it off the website. ${message}`;
  }

  await sql`
    INSERT INTO product_deletion_overrides (epos_product_id, deleted_at, reason)
    VALUES (${productId}, NOW(), 'admin-delete')
    ON CONFLICT (epos_product_id)
    DO UPDATE SET deleted_at = NOW(), reason = EXCLUDED.reason
  `;

  await sql`
    UPDATE epos_products
    SET is_deleted = TRUE, synced_at = NOW()
    WHERE epos_product_id = ${productId}
  `;

  await sql`DELETE FROM product_site_categories WHERE epos_product_id = ${productId}`;
  await sql`DELETE FROM product_images WHERE epos_product_id = ${productId}`;
  await sql`
    UPDATE product_site_meta
    SET is_hidden = TRUE, updated_at = NOW()
    WHERE epos_product_id = ${productId}
  `;

  return Response.json(
    { ok: true, message: `${productName} was removed from the website and Neon cache.${eposMessage}` },
    { headers: { "Cache-Control": "no-store" } }
  );
}
