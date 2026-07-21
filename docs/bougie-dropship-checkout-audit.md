# Bougie Dropship Checkout Audit

## Current Checkout Architecture

- Cart state lives client-side in `components/header-actions.tsx` using `localStorage` key `bougie-cart-preview`.
- Product cards dispatch `bougie:add-to-cart` events from `components/shop-products.tsx`.
- Checkout submits JSON to `POST /api/orders`.
- `lib/orders.ts` validates customer/address/items, reloads native products from `epos_products`, calculates shipping, writes `site_orders` and `site_order_items`, captures the customer, then attempts Epos sync.
- Shipping is calculated by `lib/shipping.ts` and `POST /api/shipping/calculate`.
- Admin order management is in `components/admin-dashboard.tsx` via `/api/admin/orders`.

## Payment Processor Found

No online payment processor was found. There are no Stripe, PayPal, Square, or hosted checkout session integrations. The existing flow is a custom order submission that saves the order and attempts Epos order/customer sync.

This phase preserves that behavior. New payment fields are added to support a future processor, but no new processor is introduced in this branch.

## Native Product Flow

1. Customer adds native product to cart.
2. Customer enters shipping address.
3. Server reloads native product rows.
4. Server validates stock and price.
5. Server calculates native shipping.
6. Server creates local order and order items.
7. Server attempts Epos customer/order sync.
8. Admin can retry Epos sync from Orders.

## Database Tables Involved

- `epos_products`
- `epos_product_stock`
- `product_site_meta`
- `site_shipping_settings`
- `site_orders`
- `site_order_items`
- `customer_accounts`
- Dropship source tables:
  - `supplier_sources`
  - `supplier_products`
  - `supplier_variants`
  - `dropship_published_products`

## Changes Required For Dropship Products

- Allow published dropship variants to enter the cart.
- Server-side reload published dropship variants from supplier tables.
- Recalculate retail price from publication settings.
- Validate publication, variant existence, stock, feature flags, and manual fulfillment enablement.
- Add product type and supplier snapshot columns to `site_order_items`.
- Add mixed-cart flags and payment/fulfillment fields to `site_orders`.
- Create `dropship_fulfillment_queue` records for dropship order items.
- Add admin queue actions for supplier order reference, tracking, and fulfillment status.

## Risks

- There is no real payment processor/webhook, so “payment confirmed” currently means the existing custom order request was accepted.
- Epos cannot receive dropship line IDs, so mixed carts must sync only native lines to Epos.
- Dear-Lover inventory can change after local order creation. Admin must re-check before supplier order submission.
- Supplier shipping cost is an estimate and may differ from final Dear-Lover order cost.

## Proposed Migration Strategy

1. Keep native checkout path intact.
2. Add server-side dropship validation and snapshots.
3. Add manual fulfillment queue.
4. Test in Preview with fixture dropship products.
5. Add a real payment provider later only if Bougie chooses one.
6. After a real processor is added, move queue creation from order submission to verified payment success webhook.

## Manual Supplier Fulfillment Workflow

1. Customer submits an order containing dropship items.
2. Local Bougie order is created.
3. One queue record is created per dropship order item.
4. Admin opens `Admin -> Orders -> Dropship Fulfillment`.
5. Admin places the supplier order manually in Dear-Lover.
6. Admin records supplier order ID/reference.
7. Admin updates processing, tracking, shipped, delivered, failed, cancelled, or inventory-changed status.

