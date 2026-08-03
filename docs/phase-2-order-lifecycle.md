# Phase 2.2 — Order Lifecycle

## Status Enum

The `OrderStatus` Prisma enum now includes both legacy Phase 1 statuses and new Phase 2.2 operational statuses.

| Status | Label | Terminal | Notes |
|--------|-------|----------|-------|
| `DRAFT` | Draft | No | Pre-submission state |
| `PENDING` | Requested | No | Order created, awaiting admin review |
| `CONFIRMED` | Confirmed | No | Admin accepted the request |
| `PICKUP_SCHEDULED` | Pickup scheduled | No | Pickup planned |
| `PICKED_UP` | Picked up | No | Parcel collected |
| `IN_TRANSIT` | In transit | No | Moving to dropoff |
| `IN_PROGRESS` | In progress | No | Legacy — active in some flow |
| `DELIVERY_ATTEMPTED` | Delivery attempted | No | Attempt recorded, not complete |
| `DELIVERED` | Delivered | **Yes** | Canonical successful courier delivery status |
| `COMPLETED` | Completed legacy | **Yes** | Legacy compatibility for older records |
| `CANCELLED` | Cancelled | **Yes** | Cancelled before completion |
| `FAILED` | Failed | **Yes** | Could not be completed |

## Transition Matrix

```
DRAFT              → PENDING, CANCELLED
PENDING            → CONFIRMED, CANCELLED
PENDING            → FAILED
CONFIRMED          → PICKUP_SCHEDULED, CANCELLED, FAILED
PICKUP_SCHEDULED   → PICKED_UP, CANCELLED, FAILED
PICKED_UP          → IN_TRANSIT, DELIVERY_ATTEMPTED, FAILED
IN_TRANSIT         → DELIVERED, DELIVERY_ATTEMPTED, FAILED
IN_PROGRESS        → DELIVERED, DELIVERY_ATTEMPTED, CANCELLED, FAILED  (legacy active source)
DELIVERY_ATTEMPTED → IN_TRANSIT, DELIVERED, FAILED
DELIVERED          → [] (terminal)
COMPLETED          → [] (terminal)
CANCELLED          → [] (terminal)
FAILED             → [] (terminal)
```

As of Phase 5, transition enforcement is centralized in `lib/orders/order-state-machine.ts`. Real mutations run through `lib/services/order-status.service.ts`; `lib/validation/order.ts` re-exports `VALID_STATUS_TRANSITIONS` for legacy UI imports.

## `DELIVERED` vs `COMPLETED`

Phase 2.3 standardizes successful delivery on `DELIVERED`.

- Admin transitions should guide operators to `DELIVERED`.
- `COMPLETED` remains in the enum for old records and compatibility.
- `COMPLETED` is terminal and should not be offered as a normal next status.
- Customer and store copy treats both statuses as delivery completed, but UI labels `COMPLETED` as `Completed legacy` where it must be visible.
- Filters may include `COMPLETED` for historical lookup only.

## Role Permissions

| Action | CUSTOMER | STORE | ADMIN | SUPER_ADMIN |
|--------|----------|-------|-------|-------------|
| Create order | ✓ | ✓ | — | — |
| View own orders | ✓ | ✓ | — | — |
| Cancel (before pickup) | ✓ | ✓ | ✓ | ✓ |
| Update status (any valid) | — | — | ✓ | ✓ |
| Add public note | — | — | ✓ | ✓ |
| Add internal note | — | — | ✓ | ✓ |
| View internal notes | — | — | ✓ | ✓ |

## Customer Cancellable Statuses

Customers and store users can request cancellation only when the order is in an early-stage state. Current UI exposes cancellation for `PENDING` and `CONFIRMED`; the state-machine also treats `DRAFT` as cancellable if such records are introduced.

Once pickup is scheduled or the parcel is collected, cancellation requires admin assistance.

## Public vs Internal Notes

Every `OrderStatusHistory` record has two note fields:

- `note` — Public. Shown to customer, store, and admin. Included in status-change emails.
- `internalNote` — Admin-only. NEVER returned in customer/store-facing DTOs. NEVER sent in emails.

The `toOrderStatusHistoryDto()` (customer/store) omits both `internalNote` and `actorName`.
The `toAdminOrderStatusHistoryDto()` includes both.

## Files

| File | Purpose |
|------|---------|
| `lib/constants/order-status.ts` | Customer copy, cancellable statuses, notification statuses |
| `lib/orders/order-state-machine.ts` | Central transition rules, terminal statuses, actor rules |
| `lib/services/order-status.service.ts` | Transactional order status updates and history/audit writes |
| `lib/validation/order.ts` | Legacy transition matrix re-export, `isValidTransition`, schemas |
| `lib/dto/order.dto.ts` | Public and admin history DTOs, `deliveryRegionName` |
| `lib/services/orders.service.ts` | Customer/store order flow + `cancelOrder` |
| `lib/services/admin-orders.service.ts` | Admin status update with `internalNote` |
| `components/orders/CancelOrderButton.tsx` | Client cancel UI with confirmation |
| `components/admin/AdminOrderStatusUpdate.tsx` | Admin status panel with public + internal note |
