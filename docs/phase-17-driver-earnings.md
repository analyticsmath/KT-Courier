# Phase 17 driver earnings

Phase 17 implements a dormant per-assignment driver entitlement, not dispatch, delivery completion, pricing, payout, or a generic driver balance. The subject is `COURIER_DELIVERY`; the authoritative identity is the completed `OrderAssignment`, its post-completion version, driver, order, POD and completion events. `Order.currentDriverProfileId` is never entitlement evidence because completion clears it.

The injected settlement snapshot contains only opaque references, timestamps, exact ZAR amounts, and commission charge links. Basis is supplied by future reviewed delivery-settlement orchestration and is never inferred from payment total. Reassignment is handoff-safe: only the assignment that owns the POD/completion evidence can accrue; multiple drivers require separate assignment snapshots, independent bases and funded settlement identities.

Accrual debits platform customer funds held and credits the driver's non-withdrawable payable. Release debits that payable and credits the same wallet's Phase 13 owner-withdrawable account. Reversal of unreleased value debits payable and credits customer funds held. There is no cash-clearing movement in these journals.

Commission charges attribute existing Phase 14 allocations without reposting commission. Immutable charge rows exactly back `driverAttributedAmount`; the database and service enforce `storeAttributedAmount + driverAttributedAmount <= amount`.

Refunds require an authoritative driver-level cumulative snapshot. The generic customer refund route fails closed when driver exposure exists. Released earnings are never silently clawed back from payable or owner-withdrawable; both refund and driver reconciliation are opened for a future coordinated policy.

Driver reads are ownership-scoped and omit PII, GPS, account IDs, provider IDs and raw POD content. Finance reads use the four Phase 17 permission keys with explicit DENY precedence. There is no public accrual, release, reversal, payout, adjustment, assignment, or delivery mutation.

`DRIVER_EARNINGS_PRODUCTION_VALIDATION_APPROVED` remains source-false. Only focused tests can supply an explicit in-process bypass. PostgreSQL, generation/typecheck, build, integration, E2E and cross-phase proof remain deferred as recorded in the risk register.
