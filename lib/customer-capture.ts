import { getSql } from "@/lib/db";

export async function ensureCustomerCaptureTables() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS customer_accounts (
      id BIGSERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      source TEXT NOT NULL DEFAULT 'account',
      last_order_number TEXT,
      last_order_at TIMESTAMPTZ,
      marketing_eligible BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS phone TEXT`;
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'account'`;
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS last_order_number TEXT`;
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMPTZ`;
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS marketing_eligible BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
  await sql`ALTER TABLE customer_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

  await sql`
    CREATE TABLE IF NOT EXISTS customer_sign_in_requests (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      source TEXT NOT NULL DEFAULT 'website',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id BIGSERIAL PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

export async function upsertCustomerAccount(fields: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  source: "account" | "checkout";
  orderNumber?: string | null;
}) {
  await ensureCustomerCaptureTables();
  const sql = getSql();
  const phone = fields.phone?.trim() || null;

  await sql`
    INSERT INTO customer_accounts (
      first_name,
      last_name,
      email,
      phone,
      source,
      last_order_number,
      last_order_at,
      marketing_eligible
    )
    VALUES (
      ${fields.firstName},
      ${fields.lastName},
      ${fields.email},
      ${phone},
      ${fields.source},
      ${fields.orderNumber || null},
      ${fields.orderNumber ? new Date().toISOString() : null},
      TRUE
    )
    ON CONFLICT (email)
    DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      phone = COALESCE(EXCLUDED.phone, customer_accounts.phone),
      source = CASE WHEN customer_accounts.source = 'account' THEN customer_accounts.source ELSE EXCLUDED.source END,
      last_order_number = COALESCE(EXCLUDED.last_order_number, customer_accounts.last_order_number),
      last_order_at = COALESCE(EXCLUDED.last_order_at, customer_accounts.last_order_at),
      marketing_eligible = TRUE,
      updated_at = NOW()
  `;
}
