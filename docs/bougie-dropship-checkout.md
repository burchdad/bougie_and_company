# Bougie Dropship Checkout

## Architecture

Bougie keeps one storefront cart and one local `site_orders` record. Items are split internally:

- Native items continue through the existing Epos sync path.
- Dropship items are saved as local order items and routed to `dropship_fulfillment_queue`.

## Checkout Lifecycle

1. Customer adds native and/or published dropship products to cart.
2. Client submits public IDs and quantities only.
3. Server reloads each item from the database.
4. Server validates status, stock, quantity, and price.
5. Server calculates totals.
6. Server writes the order and immutable item snapshots.
7. Native items sync to Epos.
8. Dropship items enter manual supplier fulfillment.

## Payment Lifecycle

No online payment processor currently exists in the app. `payment_provider` is set to `custom_order_request`, and `payment_status` defaults to `payment_confirmed` to match the existing order-submission behavior.

Future payment-provider work should move fulfillment queue creation behind a verified payment success webhook.

## Manual Fulfillment Workflow

Admin path: `Admin -> Orders -> Dropship Fulfillment`.

Admin can update:

- supplier order ID
- supplier order reference
- fulfillment notes
- status
- carrier
- tracking number

Supported status values include:

- `ready_for_supplier_order`
- `supplier_order_submitted`
- `supplier_processing`
- `shipped`
- `delivered`
- `failed`
- `cancelled`
- `SUPPLIER_INVENTORY_CHANGED`

## Mixed-Cart Decision

Mixed carts are supported.

One Bougie order is created. Native lines are sent to Epos. Dropship lines enter the manual fulfillment queue. Customer-facing cart totals remain one combined total.

## Shipping Strategy

Native shipping uses existing Bougie address-based shipping settings.

Dropship supplier shipping uses:

```env
DROPSHIP_SHIPPING_MODE=per_item
```

Available modes:

- `per_item`: sum estimated supplier shipping per dropship item times quantity.
- `highest_item`: charge the highest estimated supplier shipping once.
- `flat`: use `DROPSHIP_FLAT_SHIPPING_RATE`.
- `included`: do not add supplier shipping.

Dear-Lover shipping is treated as estimated supplier shipping.

## Inventory Caveats

Dear-Lover remains the inventory authority. Bougie revalidates before local checkout submission, but a local order does not guarantee supplier fulfillment until the supplier accepts the manual order.

If supplier inventory changes after checkout, admins should mark the queue record `SUPPLIER_INVENTORY_CHANGED` and contact the customer.

## Environment Variables

```env
DROPSHIPPING_ENABLED=true
DROPSHIPPING_CHECKOUT_ENABLED=true
DROPSHIPPING_MANUAL_FULFILLMENT_ENABLED=true
DROPSHIP_SHIPPING_MODE=per_item
DROPSHIP_FLAT_SHIPPING_RATE=0
```

Checkout fails closed unless both dropship checkout and manual fulfillment are enabled.

## Preview Setup

Use fixture mode first:

```env
DROPSHIPPING_ENABLED=true
DROPSHIPPING_CHECKOUT_ENABLED=true
DROPSHIPPING_MANUAL_FULFILLMENT_ENABLED=true
DROPSHIPPING_USE_FIXTURE=true
```

Then test a live synced Dear-Lover product, stopping at local payment/order confirmation and `ready_for_supplier_order`.

## Production Enablement Checklist

- Confirm native-only checkout still works.
- Confirm dropship-only checkout creates queue records.
- Confirm mixed checkout creates one local order.
- Confirm native lines sync to Epos.
- Confirm dropship lines do not sync as Epos products.
- Confirm supplier costs are admin-only.
- Confirm public APIs do not expose raw supplier JSON.
- Confirm admin routes reject unauthenticated requests.

## Rollback

Set:

```env
DROPSHIPPING_CHECKOUT_ENABLED=false
DROPSHIPPING_MANUAL_FULFILLMENT_ENABLED=false
```

Published dropship products remain browseable, but checkout rejects them.

## Known Limitations

- No online payment processor or webhook exists yet.
- No automated Dear-Lover order submission.
- No customer account order history page was added in this branch.
- Shipping/tracking emails are not implemented beyond existing contact/order capture patterns.

## Phase 3 Automated Supplier Order Roadmap

1. Add real payment provider and verified webhook.
2. Move queue creation to payment success.
3. Add Dear-Lover order-capable adapter.
4. Add supplier order idempotency.
5. Add status/tracking polling.
6. Add refund/cancel flows.

