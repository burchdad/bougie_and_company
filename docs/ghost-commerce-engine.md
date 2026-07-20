# Ghost Commerce Engine

Ghost Commerce Engine is the reusable supplier-commerce layer proven first inside Bougie & Company. Bougie remains the implementation site, while the engine owns supplier adapters, normalized catalog data, pricing, inventory sync, publishing, and future order lifecycle capabilities.

## Release Status

Current release candidate: `v0.1.0-alpha`

Phase 1 is complete when production defaults remain dormant:

```env
DROPSHIPPING_ENABLED=false
DROPSHIPPING_CHECKOUT_ENABLED=false
DROPSHIPPING_USE_FIXTURE=false
```

## Proven Phase 1 Scope

- Supplier abstraction layer
- Dear-Lover live adapter
- Isolated dropshipping database schema
- Live product, image, variant, inventory, warehouse, and pricing sync
- Admin review workflow
- Product publish and unpublish workflow
- Storefront rendering in `/shop#dropshipping`
- Dropship checkout feature flag kept disabled
- Native Bougie products preserved

## Module Shape

The first extraction step is a facade at `lib/ghost-commerce-engine` that re-exports the working Bougie dropshipping engine through product-oriented boundaries:

```text
lib/ghost-commerce-engine/
├── adapters/
├── interfaces/
├── pricing/
├── publishing/
└── sync/
```

This creates a stable future import path without moving the working Bougie implementation in the same change. Future extraction can move internals behind these boundaries while keeping app-facing imports stable.

## Supplier Roadmap

- Dear-Lover
- Bloom Wholesale
- FashionGo
- Faire
- Syncee
- Printful
- Printify
- CJ Dropshipping
- Future suppliers

## Phase 2 Order

1. Order placement to supplier
2. Order status sync
3. Tracking number ingestion and customer visibility
4. Scheduled inventory sync
5. Scheduled price sync
6. Customer order history
7. Returns and cancellations
8. Multi-supplier cart support
9. Bloom Wholesale adapter
10. Additional suppliers

## Guardrails

- Keep supplier-specific parsing inside adapters.
- Keep normalized product, variant, inventory, and pricing contracts supplier-agnostic.
- Keep checkout disabled until supplier order placement is implemented and tested.
- Keep production feature flags off by default.
- Add suppliers behind the adapter registry rather than branching storefront code per supplier.

