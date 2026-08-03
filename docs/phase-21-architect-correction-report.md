# KT Couriers Phase 21 — Financial, Courier and Recovery Composition Correction

## 1. Correction summary

Phase 21 now resolves concrete financial, courier, dispatch and pickup
composition before its production gate. The gate remains false: it is a
consolidated-validation control, not a substitute for an implementation.

## 2. Scope and migration discipline

This is a Phase 21 correction only. The sole changed migration is the existing,
unapplied `20260717130000_phase21_store_order_management` migration. No earlier
migration was modified, and no migration was applied during this work.

## 3. Authority audit

Phase 14 owns commission reversals, Phase 16 owns store-earning reversals,
Phase 15 owns refund reservation/provider execution/reconciliation, Phase 6
owns the frozen courier quote, Phase 7 owns dispatch eligibility, and Phase 8
owns canonical pickup custody. Phase 21 persists only its own immutable
operational evidence and links to those authorities.

## 4. Financial adjustment composition

`ExistingPhaseFinancialAdjustmentAuthority` locks the adjustment and store
order, reads only the completed frozen Phase 20 settlement snapshot and its
allocation evidence, checks the exact seller-basis minus commission equals
store-earning equation, enforces cumulative ceilings, and uses deterministic
cent allocation across frozen Phase 14 allocations. It never reads a current
commission plan and does not post a Phase 21 ledger journal.

The Phase 21 service first records a staged `APPLYING` state, invokes the
canonical authority outside its local transaction, then finalizes its own
receipt and evidence. Canonical Phase 14/16 writes occur in their serializable
transaction; the Phase 15 reservation is its own canonical serializable
workflow. A composed failure becomes a linked reconciliation case rather than
being concealed as a completed adjustment.

## 5. Phase 14 commission primitive

`reverseCommissionInTransaction` is a transaction-scoped Phase 14 primitive.
It locks the original accrual/allocation and required accounts in deterministic
order, validates the frozen amount and cumulative reversal, creates the
canonical reversal posting with operation idempotency, and appends immutable
commission history.

## 6. Phase 16 store-earning primitive

`adjustStoreEarningInTransaction` validates the original seller-basis,
commission and earning equation, locks the frozen earning and required payable
accounts, rejects release-state conflicts and cumulative excess, uses the
Phase 16 reversal policy, and records immutable earning history. No available
balance or current plan is written directly by Phase 21.

## 7. Phase 15 marketplace refund adapter

`createMarketplaceRefundRequest` reuses the Phase 15 aggregate. An
authenticated customer may elect a wallet refund only explicitly; a verified
guest marketplace checkout is limited to `ORIGINAL_PAYMENT_METHOD`, stores no
guest secret or fabricated customer identity, and reserves through the
canonical payment/refund/ledger records. Provider retries and unknown outcomes
remain in the existing Phase 15 execution and reconciliation paths.

## 8. Canonical courier-order bridge

`createMarketplaceCourierOrderFromFrozenEvidence` is the courier aggregate
boundary. It creates at most one prepaid `Order` from the frozen Phase 6 quote,
frozen pickup/destination evidence and existing marketplace payment evidence.
It does not create a second Payment, does not use a current quote, and has
replay/uniqueness checks for quote-to-order binding.

## 9. Dispatch and pickup custody composition

The bridge records only Phase 7 dispatch eligibility evidence; it never selects
a driver. Pickup handoff verifies an accepted active assignment, exact driver
ownership, live challenge, package count and two-party evidence, then calls the
existing Phase 8 `completePickup` authority. It does not mark customer delivery
complete or write a courier delivery status directly. Failed challenge attempts
are committed before the invalid-code error is returned.

## 10. Operational policy rejection lifecycle

An under-review policy can be rejected only with a bounded uppercase reason and
operation ID. Rejection records actor, time, reason and immutable policy
history. Rejected versions cannot activate; a new policy version is required.

## 11. Admin recovery routes

All routes require same-origin/rate-limit controls, exact `operationId` input,
explicit administrative permission, and the source lock through their canonical
service.

| Route | Permission | Canonical action |
| --- | --- | --- |
| `POST /api/admin/store-orders/[reference]/rescan` | `STORE_ORDERS_RESCAN` | creates a reconciliation case |
| `POST /api/admin/store-orders/[reference]/retry-adjustment` | `STORE_ORDERS_RETRY_ADJUSTMENT` | reuses adjustment composition |
| `POST /api/admin/store-orders/[reference]/retry-refund` | `STORE_ORDERS_RETRY_REFUND` | invokes Phase 15 provider execution |
| `POST /api/admin/store-orders/[reference]/retry-delivery-creation` | `STORE_ORDERS_RETRY_DELIVERY` | reuses canonical courier bridge |
| `POST /api/admin/store-orders/[reference]/reconcile-handoff` | `STORE_ORDERS_RECONCILE_HANDOFF` | refreshes canonical assignment evidence |

## 12. Bounded processors

The adjustment, refund, courier-creation and reconciliation processors accept
`--dry-run`, `--apply` and bounded `--limit`. Dry runs are read-only; apply
delegates to the canonical service and remains source-locked. No script accepts
financial, pricing, driver, delivery or status override input.

## 13. Schema and evidence links

The existing Phase 21 migration now adds nullable guest refund ownership,
refund links for adjustments/reconciliation, the one-to-one courier `Order`
bridge relation, rejection fields/history, and the associated foreign keys and
indexes. PostgreSQL named identifiers were checked to stay at or below 63
characters.

## 14. Source audits

`verify-store-order-invariants.mjs` checks the concrete Phase 14/16/15 imports,
composition-root authorities, canonical courier invariants, the absence of a
direct Phase 21 ledger writer, and the absence of direct delivery completion.

## 15. Focused tests

Ten focused policy, service and API files pass with 32 tests. They cover cent
allocation, guest/authenticated refund constraints, policy rejection input
validation, concrete authority wiring, no direct Phase 21 journal/delivery
write, all five recovery routes, and source-lock behavior. PostgreSQL and
browser scenarios remain intentionally deferred.

## 16. Checks run

The following checks passed: `npx prisma format`, `npx prisma validate`,
focused ESLint, focused Vitest (32/32), script syntax checks, Phase 21 preflight,
Phase 21 source-invariant audit, migration identifier-length audit, and
`git diff --check`.

## 17. Validation explicitly deferred

No dependency install, client generation, migration deployment, database
connection test, seed, Docker action, full test suite, typecheck, build,
browser test, provider call or production activation was run. Deep transaction,
constraint, provider-outcome, concurrency, dispatch-runtime and end-to-end
validation is deferred to Phase 26.5.

## 18. Remaining architectural risks

Because Phase 14/16 and Phase 15 retain their separate canonical transactions,
a failure after a financial reversal but before refund reservation is recovered
through immutable idempotency keys and an explicit reconciliation case; it is
not claimed to be a single cross-module database transaction. Phase 26.5 must
prove this recovery path against PostgreSQL and provider fixtures.

## 19. Architect hand-off

The Phase 21 source now contains concrete composition rather than interface-only
financial, courier, dispatch, pickup or recovery placeholders. Review should
focus on the frozen-evidence contracts, cross-authority recovery behavior, and
the Phase 26.5 validation plan.

CORRECTION COMPLETE — DEEP VALIDATION DEFERRED TO PHASE 26.5

READY FOR ARCHITECT IMPLEMENTATION REVIEW
