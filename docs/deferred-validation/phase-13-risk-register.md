# Phase 13 Deferred Validation Risk Register

| Area | Deferred proof |
| --- | --- |
| Migration | Clean bootstrap, legacy-placeholder preflight, null-only compatibility constraint, exact ignored Prisma mapping, and canonical deployment. |
| Prisma/build | Client generation, schema validation, full typecheck, and Next.js compilation. |
| Reservation | Live serializable locks, projections, and rollback. |
| Concurrency | Concurrent double-withdrawal and idempotency races. |
| Ledger | Reserve/release/payout journal projections and journal uniqueness. |
| Dual control | Runtime permission/DENY and maker-checker enforcement. |
| Destination privacy | Database, logs, response, and bundle audit for sensitive financial data; proof that ignored legacy withdrawal columns never become a payout fallback. |
| Cash liquidity | Insufficient cash-clearing transaction behavior. |
| Reconciliation | Stale/unknown scanner and resolution paths. |
| Browser | Owner and finance E2E flows plus accessible interaction. |
| Cross-module | Proof that no order/payment/earnings/commission/refund state changes occur. |
| Production lock | Runtime fail-closed production proof. |

The retained legacy `WithdrawalRequest` columns can be physically removed only at the consolidated cleanup gate, after deployment, retention, archival, and dependent-client compatibility evidence is reviewed. Phase 10–12 provider, reconciliation, ledger, migration, Docker, production build, CI, and browser risks remain carried forward. No deep validation was performed in Phase 13.
