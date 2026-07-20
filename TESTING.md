# Phase 1 Dropshipping Preview Testing

Branch: `testing/dropshipping-phase-1`

Latest validation commit in progress: see `git rev-parse --short HEAD`.

Preview URL:

```txt
https://bougie-and-company-oy7t-g5z6jem6l-burchdads-projects.vercel.app
```

Test schema:

```txt
bougie_dropshipping_test
```

## Required Preview Environment Variables

Set these in Vercel Preview, scoped to `testing/dropshipping-phase-1`:

```txt
DATABASE_URL=<existing Preview database URL>
ADMIN_ACCESS_KEY=<existing admin key>
CRON_SECRET=<generated secret>
DROPSHIPPING_ENABLED=true
DROPSHIPPING_SCHEMA=bougie_dropshipping_test
DROPSHIPPING_SYNC_ENABLED=true
DROPSHIPPING_CHECKOUT_ENABLED=false
DROPSHIPPING_USE_FIXTURE=true
DROPSHIPPING_FIXTURE_STOCK_REVISION=1
DEAR_LOVER_SYNC_ENABLED=true
DEAR_LOVER_BASE_URL=https://ds.dear-lover.com
DEAR_LOVER_AUTH_COOKIE=<optional server-only cookie if supplier authentication is required>
```

Do not store Dear-Lover browser cookies, PHP session values, Cloudflare clearance values, account tokens, or captured browser authentication tokens in source control. If a temporary supplier cookie is used for Preview testing, keep it only in Vercel encrypted environment variables and rotate/remove it after testing.

## Feature Flag Behavior

`DROPSHIPPING_ENABLED=false`:

- Admin Dropshipping tab is hidden.
- Admin dropshipping API routes return disabled/not found after auth checks.
- `/api/products` skips dropship tables entirely.
- Native ecommerce behavior remains unchanged.

`DROPSHIPPING_ENABLED=true`:

- Admin Dropshipping tab is present after login.
- Admin dropshipping API routes are available to authenticated admins.
- Published dropship products can appear in `/api/products` and `/shop`.

`DROPSHIPPING_CHECKOUT_ENABLED=false`:

- Dropship products cannot continue to checkout.
- The storefront message is: `Dropshipping checkout is not yet enabled. Supplier checkout and order placement will be added in Phase 2.`
- Native product checkout remains unchanged.

`DROPSHIPPING_USE_FIXTURE=true`:

- Enabled only outside production. The app refuses to enable fixture mode when `VERCEL_ENV=production`.
- The Dear-Lover adapter returns a small sanitized fixture catalog through the normal adapter normalizer.
- Fixture records are clearly titled with `[Fixture]` and use `warehouse_type=fixture`.

## Database Strategy

Preview uses the existing Preview database connection, but dropshipping tables are isolated with:

```txt
DROPSHIPPING_SCHEMA=bougie_dropshipping_test
```

The app creates the schema and Phase 1 dropshipping tables idempotently with `CREATE SCHEMA IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS`. Native Epos/storefront tables remain in their existing schema and are not recreated by the dropshipping initializer.

Phase 1 tables:

```txt
supplier_sources
supplier_products
supplier_variants
supplier_images
supplier_categories
supplier_sync_runs
dropship_published_products
```

## Authenticated Admin Testing

Admin auth is implemented in `lib/admin-products.ts`:

- Header: `x-admin-key: <ADMIN_ACCESS_KEY>`
- Query fallback: `?adminKey=<ADMIN_ACCESS_KEY>`

The Vercel value is encrypted and was not retrievable without exposing a secret. To complete admin-authenticated validation manually:

1. Open `/admin` on the Preview URL.
2. Enter the existing Preview `ADMIN_ACCESS_KEY` in the Admin Password field.
3. Do not paste the key into chat, logs, screenshots, commits, or markdown.

Expected authenticated checks:

```txt
GET /api/admin/dropshipping/suppliers
Header: x-admin-key: <ADMIN_ACCESS_KEY>
Expected: 200
Expected supplier: dear-lover / Dear-Lover
Expected private fields absent: cookies, tokens, raw adapter auth config
```

Unauthenticated checks already passed:

- `/api/admin/dropshipping/suppliers` returns `401`.
- `/api/cron/dropshipping-sync` returns `401` without `Authorization: Bearer <CRON_SECRET>`.

## Fixture Validation Flow

With `DROPSHIPPING_USE_FIXTURE=true`:

1. Sign in to `/admin`.
2. Open Dropshipping.
3. Click Sync Dear-Lover.
4. Confirm `supplier_sync_runs.status='success'`.
5. Confirm two fixture supplier products are present:
   - `[Fixture] Desert Rose Ribbed Knit Top`
   - `[Fixture] Ranch Night Midi Dress`
6. Confirm supplier variants are inserted and no duplicates are created on repeated sync.
7. Search for `fixture` and confirm both records can be browsed.
8. Filter by categories such as `Tops` or `Dresses` and confirm matching records.
9. Filter in-stock products and confirm the zero-inventory fixture dress is excluded.
10. Import `[Fixture] Desert Rose Ribbed Knit Top` with percentage markup and `publish=false`.
11. Confirm the unpublished import is stored but absent from `/api/products` and `/shop`.
12. Publish it and confirm it appears publicly.
13. Confirm public product JSON does not include `raw_json`, wholesale cost, supplier auth cookies, or private adapter metadata.
14. Unpublish it and confirm it disappears publicly while supplier/import records remain.
15. Republish without resyncing to confirm the import record can be reused.

To simulate inventory updates:

```txt
DROPSHIPPING_FIXTURE_STOCK_REVISION=2
```

Redeploy Preview and sync again. The fixture top's variant inventory changes, which validates upsert behavior rather than duplicate insertion.

## Pricing Validation

Automated tests cover:

- Percentage markup:
  - `wholesalePrice=12.29`
  - `shippingCost=10.30`
  - `markupType=percentage`
  - `markupValue=50`
  - Base: `(12.29 + 10.30) * 1.50 = 33.885`
  - Implemented `.99` result: `$33.99`
- Fixed markup.
- Manual price override.
- Retail never below wholesale plus shipping.
- Invalid or negative markup values normalize safely.

## Dear-Lover Authentication Limitation

Dear-Lover access remains an unstable supplier boundary. The current endpoint can return product-shaped JSON from an authenticated browser session, but this is not treated as a stable public API.

The adapter:

- Does not hardcode captured browser credentials.
- Does not expose auth cookies to the frontend.
- Accepts only optional server-side `DEAR_LOVER_AUTH_COOKIE`.
- Throws `SUPPLIER_AUTHENTICATION_REQUIRED` for auth-shaped failures.
- Can be replaced later with an official supplier API, Shopify bridge, or managed server-side connector.

## Automated Validation

Run:

```bash
npm test
npm run build
npm run lint
```

Current automated coverage:

- `calculateDropshipRetailPrice`
- Dear-Lover normalization through fixture data
- Fixture gating and production safety
- Fixture inventory revision behavior
- Authentication-required failure on non-JSON login responses
- Public serialization excluding raw/private supplier fields

## Removing Fixture Records

To remove all Phase 1 fixture/test data from the isolated schema:

```sql
DROP SCHEMA IF EXISTS bougie_dropshipping_test CASCADE;
```

The next authenticated dropshipping request can recreate the schema and tables idempotently.

## Rollback

1. Disable the Preview feature flag:

   ```txt
   DROPSHIPPING_ENABLED=false
   ```

2. Redeploy the Preview branch.
3. If needed, remove only the isolated test schema:

   ```sql
   DROP SCHEMA IF EXISTS bougie_dropshipping_test CASCADE;
   ```

4. Do not merge this branch into `main` until authenticated fixture validation passes.

## Production Readiness Status

Safe for stakeholder Preview review after authenticated fixture testing passes.

Not ready to merge to `main` until:

- Admin-authenticated fixture sync/import/publish/unpublish is completed.
- Schema isolation is manually confirmed in the database.
- Native checkout is spot-checked after fixture publish/unpublish.
- The supplier integration decision is made for Dear-Lover production authentication.
