# Phase 20 risk register

| Area | Deferred proof |
| --- | --- |
| Migration | Clean deployment and complete historical chain |
| Prisma | Generation, typecheck and drift |
| Guest carts | Browser cookie rotation and isolation |
| Cart merge | Live concurrent updates |
| Repricing | Catalog/version races |
| Delivery | Phase 6 quote compatibility |
| Reservations | PostgreSQL locking, expiry and no-negative-stock proof |
| Payments | PayFast preparation and authoritative ITN orchestration |
| Unknown outcomes | Stock hold/reconciliation correctness |
| Orders | Atomic multi-store creation |
| Inventory | Reservation-to-sale commitment |
| Commission | Frozen-policy accrual |
| Store earnings | Exact Phase 16 orchestration |
| Refund readiness | Line/store financial allocations |
| Security | Hoarding, replay and IDOR testing |
| Privacy | Contact/address protection and retention |
| Accessibility | Full browser validation |
| Performance | Checkout latency and payloads |
| Production lock | Runtime fail-closed proof |

Frozen seller identity, plan and allocation evidence has focused source tests, but
live PostgreSQL constraint deployment, concurrent review/acknowledgement races,
legal/VAT authority population, provider and end-to-end settlement proof remain
Phase 26.5 risks.

Applicable Phase 10–19 provider, financial, catalog, storefront and production
lock risks remain carried forward.
