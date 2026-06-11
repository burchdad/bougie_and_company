import { isAdminRequest } from "@/lib/admin-products";
import { getSql } from "@/lib/db";
import { ensureDiscountTables, listDiscounts, normalizeDiscountCode, syncDiscountToEpos } from "@/lib/discounts";
import type { SiteDiscount } from "@/lib/discounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseNullableNumber(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseNullableDate(value: unknown) {
  return value && String(value).trim() !== "" ? String(value) : null;
}

function eposIdFrom(record: Record<string, unknown> | Record<string, unknown>[] | null): string | null {
  if (!record) {
    return null;
  }

  if (Array.isArray(record)) {
    for (const item of record) {
      const id = eposIdFrom(item);
      if (id) {
        return id;
      }
    }

    return null;
  }

  const id = record.Id ?? record.ID ?? record.id;
  return typeof id === "number" || typeof id === "string" ? String(id) : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected discount error.";
}

function isUniqueCodeError(error: unknown) {
  return errorMessage(error).includes("site_discounts_code_key") || errorMessage(error).toLowerCase().includes("duplicate key");
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const discounts = await listDiscounts();
  return Response.json({ ok: true, discounts }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    code?: string;
    name?: string;
    description?: string;
    discountType?: "percentage" | "fixed";
    value?: string;
    minimumOrderAmount?: string;
    usageLimit?: string;
    startsAt?: string;
    endsAt?: string;
    isActive?: boolean;
    syncToEpos?: boolean;
  };

  const code = normalizeDiscountCode(body.code || "");
  const name = body.name?.trim();
  const discountType = body.discountType === "fixed" ? "fixed" : "percentage";
  const value = parseNullableNumber(body.value);
  const minimumOrderAmount = parseNullableNumber(body.minimumOrderAmount);
  const usageLimit = parseNullableNumber(body.usageLimit);

  if (!code || !name) {
    return Response.json({ ok: false, message: "Discount code and name are required." }, { status: 400 });
  }

  if (value === null || Number.isNaN(value) || value <= 0) {
    return Response.json({ ok: false, message: "Discount value must be greater than zero." }, { status: 400 });
  }

  if (discountType === "percentage" && value > 100) {
    return Response.json({ ok: false, message: "Percentage discounts cannot be over 100%." }, { status: 400 });
  }

  if (Number.isNaN(minimumOrderAmount) || Number.isNaN(usageLimit)) {
    return Response.json({ ok: false, message: "Minimum order and usage limit must be valid numbers." }, { status: 400 });
  }

  try {
    await ensureDiscountTables();
    const sql = getSql();
    const rows = await sql`
      INSERT INTO site_discounts (
        code,
        name,
        description,
        discount_type,
        value,
        minimum_order_amount,
        usage_limit,
        starts_at,
        ends_at,
        is_active
      )
      VALUES (
        ${code},
        ${name},
        ${body.description?.trim() || null},
        ${discountType},
        ${value},
        ${minimumOrderAmount},
        ${usageLimit === null ? null : Math.trunc(usageLimit)},
        ${parseNullableDate(body.startsAt)},
        ${parseNullableDate(body.endsAt)},
        ${body.isActive !== false}
      )
      RETURNING id::int,
        code,
        name,
        description,
        discount_type,
        value::text,
        minimum_order_amount::text,
        usage_limit::int,
        starts_at::text,
        ends_at::text,
        is_active,
        epos_discount_reason_id,
        created_at::text,
        updated_at::text
    `;

    let discount = rows[0] as SiteDiscount;
    let eposMessage = "";

    if (body.syncToEpos !== false) {
      const eposDiscount = await syncDiscountToEpos(discount, "create");
      const eposId = eposIdFrom(eposDiscount);
      if (eposId) {
        const syncedRows = await sql`
          UPDATE site_discounts
          SET epos_discount_reason_id = ${eposId},
            epos_raw = ${JSON.stringify(eposDiscount)}::jsonb,
            updated_at = NOW()
          WHERE id = ${discount.id}
          RETURNING id::int,
            code,
            name,
            description,
            discount_type,
            value::text,
            minimum_order_amount::text,
            usage_limit::int,
            starts_at::text,
            ends_at::text,
            is_active,
            epos_discount_reason_id,
            created_at::text,
            updated_at::text
        `;
        discount = syncedRows[0] as SiteDiscount;
        eposMessage = ` Registered in Epos as discount reason ${eposId}.`;
      } else {
        eposMessage = " Saved in Neon, but Epos did not return a discount reason ID.";
      }
    }

    return Response.json({ ok: true, message: `Discount created.${eposMessage}`, discount }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = isUniqueCodeError(error) ? "That discount code already exists." : errorMessage(error);
    console.error(message);
    return Response.json({ ok: false, message }, { status: isUniqueCodeError(error) ? 409 : 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: number;
    code?: string;
    name?: string;
    description?: string;
    discountType?: "percentage" | "fixed";
    value?: string;
    minimumOrderAmount?: string;
    usageLimit?: string;
    startsAt?: string;
    endsAt?: string;
    isActive?: boolean;
    syncToEpos?: boolean;
  };

  if (!body.id) {
    return Response.json({ ok: false, message: "Discount ID is required." }, { status: 400 });
  }

  const code = normalizeDiscountCode(body.code || "");
  const name = body.name?.trim();
  const discountType = body.discountType === "fixed" ? "fixed" : "percentage";
  const value = parseNullableNumber(body.value);
  const minimumOrderAmount = parseNullableNumber(body.minimumOrderAmount);
  const usageLimit = parseNullableNumber(body.usageLimit);

  if (!code || !name || value === null || Number.isNaN(value) || value <= 0) {
    return Response.json({ ok: false, message: "Discount code, name, and valid value are required." }, { status: 400 });
  }

  if (discountType === "percentage" && value > 100) {
    return Response.json({ ok: false, message: "Percentage discounts cannot be over 100%." }, { status: 400 });
  }

  if (Number.isNaN(minimumOrderAmount) || Number.isNaN(usageLimit)) {
    return Response.json({ ok: false, message: "Minimum order and usage limit must be valid numbers." }, { status: 400 });
  }

  try {
    await ensureDiscountTables();
    const sql = getSql();
    const rows = await sql`
    UPDATE site_discounts
    SET code = ${code},
      name = ${name},
      description = ${body.description?.trim() || null},
      discount_type = ${discountType},
      value = ${value},
      minimum_order_amount = ${minimumOrderAmount},
      usage_limit = ${usageLimit === null ? null : Math.trunc(usageLimit)},
      starts_at = ${parseNullableDate(body.startsAt)},
      ends_at = ${parseNullableDate(body.endsAt)},
      is_active = ${body.isActive !== false},
      updated_at = NOW()
    WHERE id = ${body.id}
    RETURNING id::int,
      code,
      name,
      description,
      discount_type,
      value::text,
      minimum_order_amount::text,
      usage_limit::int,
      starts_at::text,
      ends_at::text,
      is_active,
      epos_discount_reason_id,
      created_at::text,
      updated_at::text
  `;

    if (!rows.length) {
      return Response.json({ ok: false, message: "Discount not found." }, { status: 404 });
    }

    let discount = rows[0] as SiteDiscount;
    let eposMessage = "";

    if (body.syncToEpos !== false) {
      const action = discount.epos_discount_reason_id ? "update" : "create";
      const eposDiscount = await syncDiscountToEpos(discount, action);
      const eposId = eposIdFrom(eposDiscount);
      if (eposId) {
        const syncedRows = await sql`
          UPDATE site_discounts
          SET epos_discount_reason_id = ${eposId},
            epos_raw = ${JSON.stringify(eposDiscount)}::jsonb,
            updated_at = NOW()
          WHERE id = ${discount.id}
          RETURNING id::int,
            code,
            name,
            description,
            discount_type,
            value::text,
            minimum_order_amount::text,
            usage_limit::int,
            starts_at::text,
            ends_at::text,
            is_active,
            epos_discount_reason_id,
            created_at::text,
            updated_at::text
        `;
        discount = syncedRows[0] as SiteDiscount;
        eposMessage = ` Epos discount reason ${eposId} ${action === "create" ? "created" : "updated"}.`;
      } else {
        eposMessage = " Saved in Neon, but Epos did not return a discount reason ID.";
      }
    }

    return Response.json({ ok: true, message: `Discount saved.${eposMessage}`, discount }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = isUniqueCodeError(error) ? "That discount code already exists." : errorMessage(error);
    console.error(message);
    return Response.json({ ok: false, message }, { status: isUniqueCodeError(error) ? 409 : 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) {
    return Response.json({ ok: false, message: "Admin access required." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));

  if (!id) {
    return Response.json({ ok: false, message: "Discount ID is required." }, { status: 400 });
  }

  await ensureDiscountTables();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM site_discounts
    WHERE id = ${id}
    RETURNING id::int,
      code,
      name,
      description,
      discount_type,
      value::text,
      minimum_order_amount::text,
      usage_limit::int,
      starts_at::text,
      ends_at::text,
      is_active,
      epos_discount_reason_id,
      created_at::text,
      updated_at::text
  `;

  let eposMessage = "";

  if (rows[0]) {
    try {
      await syncDiscountToEpos(rows[0] as SiteDiscount, "delete");
      eposMessage = " Epos discount reason removed or archived.";
    } catch (error) {
      eposMessage = ` Epos delete failed: ${errorMessage(error)}`;
      console.error(eposMessage);
    }
  }

  return Response.json({ ok: true, message: `Discount removed.${eposMessage}` }, { headers: { "Cache-Control": "no-store" } });
}
