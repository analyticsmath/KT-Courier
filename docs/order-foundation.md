# Order Foundation — Phase 1.7

## Overview

Phase 1.7 implements the basic order flow for KT Couriers: customers and store accounts can create delivery requests, admins can manage order status. No driver assignment, no payments, no maps.

## Phase 1 Order Lifecycle

```
DRAFT → PENDING → CONFIRMED → IN_PROGRESS → COMPLETED
         ↓            ↓             ↓
      CANCELLED    CANCELLED    CANCELLED
```

- **DRAFT**: Created but not submitted (reserved; not exposed in Phase 1 UI)
- **PENDING**: Submitted by customer/store, awaiting admin confirmation
- **CONFIRMED**: Admin has confirmed, being prepared
- **IN_PROGRESS**: Out for delivery
- **COMPLETED**: Successfully delivered
- **CANCELLED**: Cancelled at any point before completion

As of Phase 5, valid transitions are enforced server-side by `lib/orders/order-state-machine.ts` and applied through `lib/services/order-status.service.ts`. `lib/validation/order.ts` re-exports the transition matrix for legacy UI imports. The `PATCH /api/admin/orders/[id]/status` endpoint returns HTTP 400 for invalid transitions.

## Order Number Format

`KT-{YEAR}-{6-digit-zero-padded-random}` — e.g., `KT-2026-047823`

Generated in `lib/utils/order-number.ts`:
- Up to 5 retry attempts using `crypto.randomInt(0, 999_999)`
- Fallback on collision: `KT-{YEAR}-{base36-timestamp}{hex-bytes}` (extremely unlikely)
- The `orderNumber` DB column has a `@unique` constraint as the final safety net
- Generated outside the transaction to keep the transaction short

## Address Handling

Each order has two addresses: **pickup** (`PICKUP` type) and **dropoff** (`DROPOFF` type). Addresses are stored in a shared `Address` table.

Phase 1 address fields:
- `line1` (required, 3+ chars)
- `city`, `province`, `postalCode`, `country` (optional)
- `contactName`, `contactPhone` (Phase 1: person at each location)
- `accessNotes` (gate codes, access instructions)
- `formattedAddress`, `placeId`, `latitude`, `longitude` (deferred — no maps in Phase 1)

The `recipientName` and `recipientPhone` fields on the `Order` model are the authoritative delivery contact, separate from the `dropoffAddress.contactName`/`contactPhone` (which default to the recipient values during order creation).

## Ownership Enforcement

`buildOwnerWhere()` in `lib/services/orders.service.ts` ensures users only see their own orders:

| Role | Filter |
|------|--------|
| CUSTOMER | `{ customerId: user.id }` |
| STORE | `{ storeId: <owned store id> }` — returns `{ storeId: "__no_store__" }` (no results) if no store found |
| ADMIN / SUPER_ADMIN | `{}` (sees all) |

The `storeId` is looked up from the `Store` table by `ownerUserId`. This prevents STORE users from viewing orders belonging to other stores.

## Transactional Order Creation

Order creation in `lib/services/orders.service.ts` uses a Prisma transaction:
1. Create pickup `Address`
2. Create dropoff `Address`
3. Create `Order` with `status: PENDING`
4. Create initial `OrderStatusHistory` entry

After the transaction (non-blocking, silently catches errors):
5. Create `PricingAuditLog` — records which rule was used and what price was calculated

The price estimate is calculated **before** the transaction using `estimateDeliveryPrice()` to keep the transaction short. The order number is also generated before the transaction.

## Status History

Every real status transition creates an `OrderStatusHistory` record:
- `orderId`, `status` (the new status), `actorUserId` (who made the change), `note` (optional)
- Displayed as a timeline on order detail pages

Same-status requests are idempotent no-ops and do not create duplicate history. Admin status updates also create an `AdminActivityLog` entry via `recordAdminActivity()`.

## Email notifications (Phase 1.9)

Order flows now trigger transactional emails via `notifyOrderConfirmed()` and `notifyOrderStatusChanged()` in `lib/services/notification-events.service.ts`:

| Event | Email sent to | Template |
|---|---|---|
| Order created | Customer/store user | `ORDER_CONFIRMATION` |
| Order created (if admin recipient configured) | Admin/support | `ADMIN_NEW_ORDER` |
| Admin status update | Customer or store owner | `ORDER_STATUS_CHANGED` |

All email sends are non-blocking (`.catch(() => {})`). Order creation and status updates do not fail if email delivery fails.

## Deferred Items (Out of Phase 1 scope)

- Driver assignment (`driverId`, `assignedAt`)
- Live tracking / maps / geocoding
- OTP delivery confirmation
- Payment processing / invoicing
- SMS/WhatsApp notifications
- Advanced delivery event emails (driver assigned, pickup confirmed, signature)
- Advanced analytics
- Route optimization
- Batch orders
