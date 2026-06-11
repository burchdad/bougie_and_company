import { getSql } from "@/lib/db";
import { eposFetch } from "@/lib/epos";

export type SiteDiscount = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  discount_type: "percentage" | "fixed";
  value: string;
  minimum_order_amount: string | null;
  usage_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  epos_discount_reason_id: string | null;
  created_at: string;
  updated_at: string;
};

export type DiscountValidationResult =
  | {
      ok: true;
      discount: SiteDiscount;
      discountAmount: number;
      subtotalAfterDiscount: number;
    }
  | {
      ok: false;
      message: string;
    };

export async function ensureDiscountTables() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS site_discounts (
      id BIGSERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
      value NUMERIC(12, 2) NOT NULL,
      minimum_order_amount NUMERIC(12, 2),
      usage_limit INTEGER,
      starts_at TIMESTAMPTZ,
      ends_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      epos_discount_reason_id TEXT,
      epos_raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS site_discounts_active_idx ON site_discounts (is_active, starts_at, ends_at)`;
}

export async function listDiscounts() {
  await ensureDiscountTables();
  const sql = getSql();
  return (await sql`
    SELECT id::int,
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
    FROM site_discounts
    ORDER BY is_active DESC, updated_at DESC, code ASC
  `) as SiteDiscount[];
}

export async function getActiveDiscountByCode(codeValue: string) {
  await ensureDiscountTables();
  const sql = getSql();
  const code = normalizeDiscountCode(codeValue);
  const rows = await sql`
    SELECT id::int,
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
    FROM site_discounts
    WHERE code = ${code}
      AND is_active = TRUE
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
    LIMIT 1
  `;

  return (rows[0] as SiteDiscount | undefined) || null;
}

export async function validateDiscountCode(codeValue: string, subtotalValue = 0): Promise<DiscountValidationResult> {
  const discount = await getActiveDiscountByCode(codeValue);

  if (!discount) {
    return { ok: false, message: "Discount code is not active." };
  }

  const subtotal = Math.max(0, Number(subtotalValue) || 0);
  const minimumOrderAmount = Number(discount.minimum_order_amount || 0);

  if (minimumOrderAmount > 0 && subtotal < minimumOrderAmount) {
    return { ok: false, message: `Discount requires a minimum order of $${minimumOrderAmount.toFixed(2)}.` };
  }

  const value = Number(discount.value || 0);
  const discountAmount = discount.discount_type === "percentage" ? subtotal * (value / 100) : value;
  const cappedDiscountAmount = Math.min(subtotal, Math.max(0, discountAmount));

  return {
    ok: true,
    discount,
    discountAmount: Number(cappedDiscountAmount.toFixed(2)),
    subtotalAfterDiscount: Number(Math.max(0, subtotal - cappedDiscountAmount).toFixed(2))
  };
}

export function normalizeDiscountCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function buildDiscountReasonName(discount: Pick<SiteDiscount, "code" | "name" | "discount_type" | "value">) {
  const suffix = discount.discount_type === "percentage" ? `${Number(discount.value)}%` : `$${Number(discount.value).toFixed(2)}`;
  return `${discount.code} - ${discount.name} (${suffix})`.slice(0, 255);
}

export async function syncDiscountToEpos(discount: SiteDiscount, action: "create" | "update" | "delete") {
  const name = buildDiscountReasonName(discount);
  const description = `Website discount code: ${discount.code}. ${discount.description || "Created from Bougie & Company admin."}`.slice(0, 1000);
  const createPayloads = [
    { Name: name, Description: description },
    { Name: name },
    { Reason: name, Description: description },
    { Reason: name },
    { Description: name }
  ];

  async function tryPayloads(path: string, method: "POST" | "PUT", payloads: Array<Record<string, unknown>>) {
    let lastError: unknown;

    for (const payload of payloads) {
      try {
        return await eposFetch<Record<string, unknown>>(path, {
          method,
          body: JSON.stringify(payload)
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  if (action === "create") {
    return tryPayloads("DiscountReason", "POST", createPayloads);
  }

  if (discount.epos_discount_reason_id && action === "update") {
    const id = Number(discount.epos_discount_reason_id);
    return tryPayloads(
      `DiscountReason/${discount.epos_discount_reason_id}`,
      "PUT",
      createPayloads.map((payload) => ({ Id: id, ...payload }))
    );
  }

  if (discount.epos_discount_reason_id && action === "delete") {
    return eposFetch<Record<string, unknown>>(`DiscountReason/${discount.epos_discount_reason_id}`, { method: "DELETE" });
  }

  return null;
}
