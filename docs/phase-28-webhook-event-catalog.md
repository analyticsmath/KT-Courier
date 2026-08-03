# Phase 28 webhook event catalog

The `WEBHOOK_EVENT_ADAPTER_INVENTORY` in `lib/developer-api/contracts.ts` is
the executable authority. Each supported record is projected from a durable
canonical source into an immutable version-1 CloudEvent. Provider callbacks,
outbox payloads, Prisma DTOs, ledger evidence, payment credentials, and other
internal evidence are never forwarded.

| Canonical source authority | Canonical source event type | Public webhook event | Version | Resource-owner resolver | Scope | Public projection adapter | Support | Unsupported reason |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `order-status-history` | `PENDING` | `za.co.ktcouriers.order.created.v1` | 1 | order customer or store owner | `orders:read` | `order-status-v1` | supported | — |
| `order-status-history` | `ORDER_STATUS_CHANGED` | `za.co.ktcouriers.order.updated.v1` | 1 | order customer or store owner | `orders:read` | `order-status-v1` | supported | — |
| `order-status-history` | `CANCELLED` | `za.co.ktcouriers.order.cancelled.v1` | 1 | order customer or store owner | `orders:read` | `order-status-v1` | supported | — |
| `store-order-intent` | `ACTION_REQUIRED` | `za.co.ktcouriers.store_order.action_required.v1` | 1 | store owner | `store_orders:read` | `store-order-intent-v1` | supported | — |
| `store-order-intent` | `READY` | `za.co.ktcouriers.store_order.ready.v1` | 1 | store owner | `store_orders:read` | `store-order-intent-v1` | supported | — |
| `order-assignment-event` | `ASSIGNMENT_CREATED` | `za.co.ktcouriers.driver.assigned.v1` | 1 | order customer or store owner | `tracking:read` | `assignment-v1` | supported | — |
| `order-operational-event` | `PICKUP_COMPLETED` | `za.co.ktcouriers.delivery.picked_up.v1` | 1 | order customer or store owner | `tracking:read` | `operational-v1` | supported | — |
| `order-operational-event` | `DELIVERY_COMPLETED` | `za.co.ktcouriers.delivery.completed.v1` | 1 | order customer or store owner | `tracking:read` | `operational-v1` | supported | — |
| `order-operational-event` | `DELIVERY_FAILED` | `za.co.ktcouriers.delivery.failed.v1` | 1 | order customer or store owner | `tracking:read` | `operational-v1` | supported | — |
| `payment-status-history` | `SUCCEEDED` | `za.co.ktcouriers.payment.succeeded.v1` | 1 | payment customer, then owned order/store | `payments:read` | `payment-outcome-v1` | supported | — |
| `payment-status-history` | `FAILED` | `za.co.ktcouriers.payment.failed.v1` | 1 | payment customer, then owned order/store | `payments:read` | `payment-outcome-v1` | supported | — |
| `refund-status-history` | `SUCCEEDED` | `za.co.ktcouriers.refund.completed.v1` | 1 | refund customer, then payment owner | `refunds:read` | `refund-outcome-v1` | supported | — |
| `refund-status-history` | `FAILED` | `za.co.ktcouriers.refund.failed.v1` | 1 | refund customer, then payment owner | `refunds:read` | none | unsupported | `RefundStatus` has no failed terminal event. |
| `subscription-event-intent` | `SUBSCRIPTION_ACTIVATED` | `za.co.ktcouriers.subscription.activated.v1` | 1 | subscription customer or store owner | `subscriptions:read` | `subscription-lifecycle-v1` | supported | — |
| `subscription-event-intent` | `SUBSCRIPTION_RENEWAL_SUCCEEDED` | `za.co.ktcouriers.subscription.renewal_succeeded.v1` | 1 | subscription customer or store owner | `subscriptions:read` | none | unsupported | Phase 22 has no durable success intent. |
| `subscription-event-intent` | `SUBSCRIPTION_PAYMENT_FAILED` | `za.co.ktcouriers.subscription.renewal_failed.v1` | 1 | subscription customer or store owner | `subscriptions:read` | `subscription-lifecycle-v1` | supported | — |
| `subscription-event-intent` | `SUBSCRIPTION_CANCELLED` | `za.co.ktcouriers.subscription.cancelled.v1` | 1 | subscription customer or store owner | `subscriptions:read` | `subscription-lifecycle-v1` | supported | — |

The fan-out invariant is exact: source event → canonical resource owner →
active application with the same owner/store → active same-environment scope
grant containing the event scope → active verified same-environment
subscription selecting the event. A subscription alone never grants access.
Owner resolution failure, active-owner failure, scope mismatch, missing signing
secret, and endpoint eligibility are recorded as reconciliation evidence.
