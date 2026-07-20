# Ghost Commerce Engine Architecture Audit

## Current Coupling Points

- `lib/dropshipping/db.ts` combines PostgreSQL schema setup, supplier sync orchestration, product upserts, publication records, and storefront serialization.
- `lib/dropshipping/db.ts` imports `@/lib/db`, so persistence is tied directly to Bougie's current Neon/Postgres helper.
- `getPublishedDropshipStoreProducts()` returns Bougie/Epos-shaped storefront records such as `epos_product_id`, `sale_price`, `category_slugs`, and `is_dropship`.
- Default publication collection values assume Bougie's storefront category slug, especially `dropshipping`.
- Admin routes in `app/api/admin/dropshipping/*` call dropshipping helpers directly and own auth/feature flag enforcement at the route layer.
- Cron sync in `app/api/cron/dropshipping-sync/route.ts` couples scheduled execution to Vercel/Next route behavior and `CRON_SECRET`.
- Feature flags are read from `process.env` in `lib/dropshipping/config.ts`, which is appropriate for Bougie but not for a portable package.
- Existing Dear-Lover transport, response parsing, auth-cookie usage, and normalization lived together in one adapter file.
- Supplier sync error messages previously exposed `SUPPLIER_AUTHENTICATION_REQUIRED`, a supplier-era string rather than a stable engine error code.

## Extraction Risks

- Moving `lib/dropshipping/db.ts` too quickly could break the proven Bougie admin workflow.
- Replacing route handlers before the repository abstraction is fully wired could regress auth, fixture sync, or preview schema behavior.
- Storefront serialization must continue excluding wholesale cost, raw supplier JSON, credentials, and sync metadata.
- Checkout must remain disabled until order submission, status sync, inventory reservation, and fulfillment tracking are tested end to end.
- Dear-Lover returns JSON with unreliable content-type headers, so transport parsing must remain body-first and authentication-aware.
- Multi-client reuse requires supplier adapters and services to avoid importing app routes, React components, or Bougie-specific data modules.

## Recommended Boundaries

- Engine core: domain types, typed errors, result helpers, feature-neutral config, metadata.
- Supplier adapters: transport, raw supplier response types, and normalizers.
- Catalog services: supplier search/sync orchestration and product/variant operations.
- Pricing service: pure calculations with no database, framework, or supplier dependency.
- Publishing service: publication lifecycle and overrides.
- Storefront serializer: public product projection that strips private supplier fields.
- Persistence: `CommerceRepository` interface plus app-specific repository implementations.
- Observability: logger and sync event contracts.
- Testing: fixture adapter, factories, and in-memory repository.

## What Should Remain App-Specific

- Admin authentication and session cookies.
- Next.js route handlers.
- Vercel cron route shape and `CRON_SECRET` validation.
- Bougie's existing Epos/native product behavior.
- Bougie storefront field names and UI component state.
- Database connection ownership and migration deployment strategy.
- Environment variable wiring for preview vs production.

## What Should Move Into The Engine

- Supplier adapter contract and capability detection.
- Generic commerce product, variant, image, category, inventory, publication, order, fulfillment, and tracking models.
- Catalog sync service behavior, including partial-failure handling.
- Pure pricing calculation and rounding rules.
- Publishing and unpublishing service contracts.
- Safe storefront serialization rules.
- Typed engine errors and consistent result/exception strategy.
- In-memory repository and fixture adapter for portable tests.

## Current Extraction Status

- `lib/ghost-commerce-engine` now provides a real package boundary instead of only re-exporting Bougie dropshipping helpers.
- Dear-Lover has engine-level transport, raw types, normalizer, adapter orchestration, and capability metadata.
- `CommerceRepository` defines the persistence contract needed by future clients.
- `InMemoryCommerceRepository` validates catalog sync and publishing without PostgreSQL.
- `BougieCommerceRepository` exists as an integration wrapper, but the live Bougie routes still use the proven Phase 1 helpers.

## Remaining Coupling

- Bougie production routes still call `lib/dropshipping/db.ts` directly.
- The full Bougie SQL repository implementation has not been moved behind `CommerceRepository`.
- Current admin UI still consumes `DropshipAdminProduct`, not a generic engine admin DTO.
- Storefront API still maps engine-like records into Epos-compatible product fields.

