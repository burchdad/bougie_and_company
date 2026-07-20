CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'website',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_accounts (
  id BIGSERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_sign_in_requests (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON contact_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS customer_sign_in_requests_created_at_idx ON customer_sign_in_requests (created_at DESC);

CREATE TABLE IF NOT EXISTS epos_sync_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'Batch Update',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS epos_products (
  epos_product_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT,
  barcode TEXT,
  category_id NUMERIC,
  sale_price NUMERIC(12, 2),
  cost_price NUMERIC(12, 2),
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS epos_product_stock (
  epos_stock_id TEXT PRIMARY KEY,
  epos_product_id NUMERIC,
  location_id NUMERIC,
  current_stock NUMERIC,
  on_order NUMERIC,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS epos_sync_events_created_at_idx ON epos_sync_events (created_at DESC);
CREATE INDEX IF NOT EXISTS epos_products_name_idx ON epos_products (name);
CREATE INDEX IF NOT EXISTS epos_products_sku_idx ON epos_products (sku);
CREATE INDEX IF NOT EXISTS epos_product_stock_product_idx ON epos_product_stock (epos_product_id);

CREATE TABLE IF NOT EXISTS product_site_meta (
  epos_product_id TEXT PRIMARY KEY REFERENCES epos_products(epos_product_id) ON DELETE CASCADE,
  marketing_title TEXT,
  marketing_description TEXT,
  department TEXT,
  storefront_stock_override NUMERIC,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_images (
  id BIGSERIAL PRIMARY KEY,
  epos_product_id TEXT NOT NULL REFERENCES epos_products(epos_product_id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  pathname TEXT,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS product_images_product_idx ON product_images (epos_product_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS product_site_meta_department_idx ON product_site_meta (department);

CREATE TABLE IF NOT EXISTS site_categories (
  id BIGSERIAL PRIMARY KEY,
  label TEXT NOT NULL,
  slug TEXT NOT NULL,
  href TEXT NOT NULL,
  parent_id BIGINT REFERENCES site_categories(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_header BOOLEAN NOT NULL DEFAULT FALSE,
  epos_category_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS site_categories_parent_idx ON site_categories (parent_id, sort_order ASC);

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
);

CREATE INDEX IF NOT EXISTS site_discounts_active_idx ON site_discounts (is_active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS supplier_sources (
  id BIGSERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  base_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_products (
  id BIGSERIAL PRIMARY KEY,
  supplier_key TEXT NOT NULL,
  supplier_product_id TEXT NOT NULL,
  supplier_sku TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category_names TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  image_url TEXT,
  second_image_url TEXT,
  wholesale_price NUMERIC(12, 2),
  original_price NUMERIC(12, 2),
  suggested_retail_price NUMERIC(12, 2),
  shipping_cost NUMERIC(12, 2),
  currency TEXT,
  warehouse_type TEXT,
  total_inventory NUMERIC NOT NULL DEFAULT 0,
  route_url TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_key, supplier_product_id)
);

CREATE TABLE IF NOT EXISTS supplier_variants (
  id BIGSERIAL PRIMARY KEY,
  supplier_key TEXT NOT NULL,
  supplier_product_id TEXT NOT NULL,
  supplier_variant_id TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  title TEXT,
  color TEXT,
  size TEXT,
  size_name TEXT,
  price NUMERIC(12, 2),
  weight NUMERIC(12, 4),
  inventory_quantity NUMERIC NOT NULL DEFAULT 0,
  is_in_stock BOOLEAN NOT NULL DEFAULT FALSE,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_key, supplier_variant_id)
);

CREATE TABLE IF NOT EXISTS supplier_images (
  id BIGSERIAL PRIMARY KEY,
  supplier_key TEXT NOT NULL,
  supplier_product_id TEXT NOT NULL,
  url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_key, supplier_product_id, url)
);

CREATE TABLE IF NOT EXISTS supplier_categories (
  id BIGSERIAL PRIMARY KEY,
  supplier_key TEXT NOT NULL,
  name TEXT NOT NULL,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_key, name)
);

CREATE TABLE IF NOT EXISTS supplier_sync_runs (
  id BIGSERIAL PRIMARY KEY,
  supplier_key TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  products_seen INTEGER NOT NULL DEFAULT 0,
  products_upserted INTEGER NOT NULL DEFAULT 0,
  variants_seen INTEGER NOT NULL DEFAULT 0,
  variants_upserted INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS dropship_published_products (
  id BIGSERIAL PRIMARY KEY,
  supplier_key TEXT NOT NULL,
  supplier_product_id TEXT NOT NULL,
  local_product_id TEXT,
  title_override TEXT,
  description_override TEXT,
  price_override NUMERIC(12, 2),
  markup_type TEXT NOT NULL DEFAULT 'percentage',
  markup_value NUMERIC(12, 2) NOT NULL DEFAULT 60,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  collection TEXT,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (supplier_key, supplier_product_id)
);

CREATE INDEX IF NOT EXISTS supplier_products_supplier_idx ON supplier_products (supplier_key, last_synced_at DESC);
CREATE INDEX IF NOT EXISTS supplier_variants_product_idx ON supplier_variants (supplier_key, supplier_product_id);
CREATE INDEX IF NOT EXISTS supplier_sync_runs_supplier_idx ON supplier_sync_runs (supplier_key, started_at DESC);
