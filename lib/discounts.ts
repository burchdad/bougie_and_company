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

export function normalizeDiscountCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "-");
}

export function buildDiscountReasonName(discount: Pick<SiteDiscount, "code" | "name" | "discount_type" | "value">) {
  const suffix = discount.discount_type === "percentage" ? `${Number(discount.value)}%` : `$${Number(discount.value).toFixed(2)}`;
  return `${discount.code} - ${discount.name} (${suffix})`;
}

export async function syncDiscountToEpos(discount: SiteDiscount, action: "create" | "update" | "delete") {
  const name = buildDiscountReasonName(discount);
  const description = discount.description || "Website discount created from Bougie & Company admin.";

  if (action === "create") {
    return eposFetch<Record<string, unknown>>("DiscountReason", {
      method: "POST",
      body: JSON.stringify({ Name: name, Description: description })
    });
  }

  if (discount.epos_discount_reason_id && action === "update") {
    return eposFetch<Record<string, unknown>>(`DiscountReason/${discount.epos_discount_reason_id}`, {
      method: "PUT",
      body: JSON.stringify({
        Id: Number(discount.epos_discount_reason_id),
        Name: name,
        Description: description
      })
    });
  }

  if (discount.epos_discount_reason_id && action === "delete") {
    return eposFetch<Record<string, unknown>>(`DiscountReason/${discount.epos_discount_reason_id}`, { method: "DELETE" });
  }

  return null;
}
