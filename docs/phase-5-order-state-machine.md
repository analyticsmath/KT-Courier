# Phase 5 Order State-Machine Hardening

## Summary

Phase 5 centralizes order status transition rules in `lib/orders/order-state-machine.ts` and routes real order status mutations through `lib/services/order-status.service.ts`.

The goal is to make order lifecycle changes explicit, validated, audited, and testable before future payment, wallet, marketplace, and promoter modules depend on order state.

## Database Status

Local PostgreSQL was not reachable at the start of Phase 5 on `localhost:5433`. The local Docker startup script was attempted, but Docker was not reachable. Phase 5 continued with code and tests that do not require a live database.

No Prisma schema change was needed for Phase 5. Existing `OrderStatusHistory` fields cover actor, public note, and internal note needs. Existing `OrderOperationalEvent` fields cover operational/admin audit context.

## Current OrderStatus Values

The existing Prisma `OrderStatus` enum is used as-is:

- `DRAFT`
- `PENDING`
- `CONFIRMED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
- `PICKUP_SCHEDULED`
- `PICKED_UP`
- `IN_TRANSIT`
- `DELIVERY_ATTEMPTED`
- `DELIVERED`
- `FAILED`

No enum values were added or renamed.

## Terminal Statuses

Terminal statuses are:

- `DELIVERED`
- `COMPLETED`
- `CANCELLED`
- `FAILED`

Terminal orders cannot transition back to active states. Same-status requests are treated as idempotent no-ops and do not create duplicate `OrderStatusHistory` rows.

## Allowed Transition Model

Base operational transitions:

- `DRAFT -> PENDING`
- `DRAFT -> CANCELLED`
- `PENDING -> CONFIRMED`
- `PENDING -> CANCELLED`
- `PENDING -> FAILED`
- `CONFIRMED -> PICKUP_SCHEDULED`
- `CONFIRMED -> CANCELLED`
- `CONFIRMED -> FAILED`
- `PICKUP_SCHEDULED -> PICKED_UP`
- `PICKUP_SCHEDULED -> CANCELLED`
- `PICKUP_SCHEDULED -> FAILED`
- `PICKED_UP -> IN_TRANSIT`
- `PICKED_UP -> DELIVERY_ATTEMPTED`
- `PICKED_UP -> FAILED`
- `IN_TRANSIT -> DELIVERY_ATTEMPTED`
- `IN_TRANSIT -> DELIVERED`
- `IN_TRANSIT -> FAILED`
- `DELIVERY_ATTEMPTED -> IN_TRANSIT`
- `DELIVERY_ATTEMPTED -> DELIVERED`
- `DELIVERY_ATTEMPTED -> FAILED`
- `IN_PROGRESS -> DELIVERY_ATTEMPTED`
- `IN_PROGRESS -> DELIVERED`
- `IN_PROGRESS -> CANCELLED`
- `IN_PROGRESS -> FAILED`

## Actor Rules

Customer:

- May cancel only owned early-stage orders.
- Early-stage means `DRAFT`, `PENDING`, or `CONFIRMED`.
- Cannot cancel after pickup has started.
- Cannot mutate terminal orders.

Store:

- May cancel only owned store orders in early-stage states.
- Cannot cancel after pickup completion or terminal states.

Driver:

- Must be the assigned driver.
- Assignment must be accepted.
- May move `CONFIRMED -> PICKUP_SCHEDULED`.
- May move `PICKUP_SCHEDULED -> PICKED_UP`.
- May move `PICKED_UP -> IN_TRANSIT`.
- May record delivery attempt/failure from delivery-eligible statuses.
- May complete delivery only after OTP/proof context has been satisfied by existing delivery services.
- Cannot cancel the whole order.

Admin and Super Admin:

- May perform explicit status management through existing admin permission checks.
- Cancellation and failure transitions require a reason.
- Admin status changes write status history and admin operational audit events.
- Terminal orders cannot be silently reopened.

System:

- May use base operational transitions for internal workflows.
- Payment-dependent rules are intentionally not implemented in Phase 5.

Promoter:

- Has no order transition permissions in Phase 5.
- Is not treated as customer, store, driver, admin, or super admin.
- Redirects to a neutral public target after auth because the promoter portal is future scope.

## Status History Behavior

Every real status transition writes one `OrderStatusHistory` row through `transitionOrderStatusInTx`.

Same-status requests are idempotent no-ops and do not write duplicate history.

Real transitions use an optimistic status guard, updating only when the stored status still matches the validated source status.

Initial order creation still writes the initial `PENDING` history row as creation history, not as a transition.

## Operational Event Behavior

Existing pickup and delivery services continue to write their workflow-specific `OrderOperationalEvent` records:

- `PICKUP_STARTED`
- `PICKUP_COMPLETED`
- `PICKUP_FAILED`
- `DELIVERY_STARTED`
- `DELIVERY_OTP_VERIFIED`
- `DELIVERY_COMPLETED`
- `DELIVERY_ATTEMPTED`
- `DELIVERY_FAILED`
- `POD_CREATED`
- `ADMIN_DELIVERY_OVERRIDE`

Admin manual status changes use the existing `ADMIN_OPERATION_NOTE_ADDED` event type with `statusBefore` and `statusAfter` for audit context.

## Admin Override Rules

Admin override behavior is explicit in service calls. Manual delivery override requires a reason and writes:

- Proof of delivery.
- Order status history.
- `ADMIN_DELIVERY_OVERRIDE` operational event.
- Admin activity log.

General admin status updates also write status history, admin activity, and an admin operational event.

## Intentionally Not Implemented

Phase 5 did not implement:

- Payments.
- Refunds.
- Wallets.
- COD settlement.
- Marketplace checkout.
- Product CRUD.
- Cart APIs.
- Subscription billing.
- Promoter dashboard.
- Recruitment workflow.
- Public API/webhook runtime.
- Reporting/export generation.
- Frontend redesign.

## Testing Summary

Vitest coverage was added for:

- Pure state-machine transition rules.
- Transactional order status service behavior.
- Customer cancellation integration.
- Driver delivery transition integration.
- Admin dispatch regression.
- PROMOTER role regression.
