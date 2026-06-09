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

function eposIdFrom(record: Record<string, unknown> | null) {
  if (!record) {
    return null;
  }

  const id = record.Id ?? record.ID ?? record.id;
  return typeof id === "number" || typeof id === "string" ? String(id) : null;
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

  const discount = rows[0] as SiteDiscount;

  if (body.syncToEpos) {
    const eposDiscount = await syncDiscountToEpos(discount, "create");
    const eposId = eposIdFrom(eposDiscount);
    if (eposId) {
      await sql`
        UPDATE site_discounts
        SET epos_discount_reason_id = ${eposId},
          epos_raw = ${JSON.stringify(eposDiscount)}::jsonb,
          updated_at = NOW()
        WHERE id = ${discount.id}
      `;
    }
  }

  return Response.json({ ok: true, message: "Discount created." }, { headers: { "Cache-Control": "no-store" } });
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

  const discount = rows[0] as SiteDiscount;

  if (body.syncToEpos) {
    const action = discount.epos_discount_reason_id ? "update" : "create";
    const eposDiscount = await syncDiscountToEpos(discount, action);
    const eposId = eposIdFrom(eposDiscount);
    if (eposId) {
      await sql`
        UPDATE site_discounts
        SET epos_discount_reason_id = ${eposId},
          epos_raw = ${JSON.stringify(eposDiscount)}::jsonb,
          updated_at = NOW()
        WHERE id = ${discount.id}
      `;
    }
  }

  return Response.json({ ok: true, message: "Discount saved." }, { headers: { "Cache-Control": "no-store" } });
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

  if (rows[0]) {
    await syncDiscountToEpos(rows[0] as SiteDiscount, "delete");
  }

  return Response.json({ ok: true, message: "Discount removed." }, { headers: { "Cache-Control": "no-store" } });
}
