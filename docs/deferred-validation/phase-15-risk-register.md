# Phase 15 Deferred-Validation Risk Register

Status: implementation complete; deep validation deferred. Relevant unresolved Phase 9–14 ledger, payment-confirmation, Payfast, withdrawal, and commission risks remain inherited until consolidated validation.

| Area | Deferred proof | Risk/control pending validation |
|---|---|---|
| Migration | Clean bootstrap/deployment | SQL ordering, triggers, renamed legacy columns and fail-closed placeholder handling need isolated PostgreSQL proof. |
| Prisma | Generate, typecheck and drift | Generated client was intentionally not refreshed; compile alignment remains unproven. |
| Partial refunds | Cumulative rounding under PostgreSQL | Pure Decimal vectors exist; persisted multi-refund cents need database scenarios. |
| Concurrency | Over-refund races | Serializable Payment locking and constraints are implemented but not stress-tested. |
| Commission | Clawback and downstream release | Original-allocation deltas and block policy need database evidence across Phase 14 fixtures. |
| Ledger | Reservation/release/completion rollback | Atomic services and deferred constraints need injected-failure/PostgreSQL proof. |
| Wallet | Projection and privacy | Liability provisioning, winner reread, transaction DTOs and negative-balance controls need integration/E2E proof. |
| Payfast auth | Official signature compatibility | Local fixed vectors do not prove compatibility with current official production API. |
| Payfast amount | Exact protocol unit | Unresolved; serializer and real network are fail-closed. Architect must supply authoritative protocol evidence. |
| Payfast API | Real response and query behavior | Status mapping and choice between query paths remain unresolved and disabled. |
| Network | Unknown-outcome handling | Timeout/transport normalization exists; real ambiguous delivery must not be tested against production casually. |
| Permissions | Maker-checker and DENY | Source logic and contract tests exist; seeded role/user DENY behavior needs integration proof. |
| Build | Production compilation | No build or full typecheck was run. |
| UI | Browser E2E | Customer/admin flows are scaffolded but not executed. |
| Cross-module | No order/payment mutation | Source audit exists; runtime regression proof is deferred. |
| Production lock | Runtime fail-closed behavior | Source constant is false with no environment bypass; deployment behavior needs consolidated proof. |

No production activation should occur until every row has reviewed evidence or an explicitly accepted residual risk.
