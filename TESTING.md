# Phase 1 Dropshipping Preview Testing

Branch: `testing/dropshipping-phase-1`

Starting commit for this validation pass: `329ff72`

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
DEAR_LOVER_SYNC_ENABLED=true
DEAR_LOVER_BASE_URL=https://ds.dear-lover.com
DEAR_LOVER_AUTH_COOKIE=<optional server-only cookie if supplier authentication is required>
```

Do not store Dear-Lover browser cookies, PHP session values, Cloudflare clearance values, account tokens, or captured browser authentication tokens in source control. If a temporary supplier cookie is used for Preview testing, keep it only in Vercel encrypted environment variables and rotate/remove it after testing.

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

## Manual Testing Steps

1. Open the Preview deployment URL.
2. Verify `/shop` loads and existing native products still appear.
3. Open `/admin` and sign in with `ADMIN_ACCESS_KEY`.
4. Confirm the Dropshipping tab appears only when `DROPSHIPPING_ENABLED=true`.
5. Call `/api/admin/dropshipping/suppliers` without `x-admin-key` and confirm `401`.
6. Call `/api/cron/dropshipping-sync` without `Authorization: Bearer <CRON_SECRET>` and confirm `401`.
7. In Admin > Dropshipping, click Sync Dear-Lover.
8. Confirm a `supplier_sync_runs` row is created for success, partial success, or failure.
9. If Dear-Lover auth is unavailable, confirm the UI/API reports `SUPPLIER_AUTHENTICATION_REQUIRED` or a useful supplier failure message.
10. Search/browse synced products.
11. Import one product without publishing and confirm it does not appear in `/shop`.
12. Publish one product and confirm it appears in `/shop`.
13. Confirm variants are grouped under the product and zero-inventory variants show as unavailable.
14. Confirm dropship buttons do not route into checkout while `DROPSHIPPING_CHECKOUT_ENABLED=false`.
15. Confirm native product checkout behavior is unchanged.
16. Change markup type/value and price override, save, and confirm displayed retail price updates.
17. Unpublish the test product and confirm supplier records remain while the storefront item disappears.

## Known Phase 1 Limitations

- Dear-Lover access is treated as an unstable supplier boundary. The current product endpoint may require authenticated browser/session cookies and is not assumed to be a stable public API.
- Phase 1 supports supplier catalog sync, local product review, import, pricing, publishing, and storefront display.
- Phase 1 does not place supplier orders, sync tracking, or route dropship items through checkout.
- Dropship checkout must remain disabled with `DROPSHIPPING_CHECKOUT_ENABLED=false`.
- If Dear-Lover rejects unauthenticated requests, sync should fail safely and log the failure instead of exposing credentials or crashing the storefront.

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

4. Do not merge this branch into `main` until stakeholder review is complete and Preview validation passes.
