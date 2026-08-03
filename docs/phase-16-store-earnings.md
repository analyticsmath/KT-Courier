# Phase 16: Store Earnings

## Scope

Phase 16 introduces a journal-backed store entitlement and payable foundation. An upstream marketplace phase may eventually provide an authoritative per-store settlement snapshot; Phase 16 validates that snapshot, attributes existing commission allocations, records an immutable earning, coordinates store-level refund funding, and defines release and reversal operations.

The implementation supports multiple stores for one opaque subject because settlement identity is `(subjectType, subjectId, storeId, settlementVersion)`. Each store receives its own wallet, payable account, charge links, projections, and history.

## Non-goals and marketplace boundary

This phase does not create marketplace, seller-order, order-item, fulfilment, tax, discount, shipping-allocation, or driver-earning models. It does not infer a store formula from the current courier `Order` or `PricingQuote`. No order completion hook automatically accrues an earning. Accrual and release are internal services only; there is no public accrual, store release, create, delete, balance-adjustment, or mark-released endpoint.

The upstream producer must supply the immutable snapshot described in [store-settlement-snapshot.md](finance/store-settlement-snapshot.md). Until Phase 20/21 establishes and validates that producer and lifecycle, all financial mutations remain source-locked.

## Architecture

`StoreEarning` is the aggregate. It retains opaque subject/store/payment identities; exact Decimal basis, commission, and net values; snapshot and calculation versions; a SHA-256 calculation hash; journal links; release eligibility; refund/release/reversal projections; and status. `StoreEarningCommissionCharge` records allocation-level commission evidence. `CommissionAllocation.storeAttributedAmount` is the concurrent projection preventing attribution beyond the original allocation. Append-only history records safe transitions, while reconciliation cases record mismatches without permitting a manual financial override.

The store-facing query service resolves exactly one active store owned by the active STORE user. It returns money strings and safe references only—no customer PII, hashes, wallet/account IDs, or raw evidence. Finance reads require exact permissions and check explicit DENY before ordinary role permission evaluation.

## Accounting flows

Accrual moves the exact net earning from platform customer-funds-held liability to the store's `STORE_EARNINGS_PAYABLE` liability. It does not move cash and does not credit owner-withdrawable. Release moves only the remaining entitlement from store payable to the existing Phase 13 `OWNER_WITHDRAWABLE` account. Reversal moves only the remaining entitlement from store payable back to customer funds held. Detailed journal contracts are in [store-earning-accounting.md](finance/store-earning-accounting.md).

## Refund coordination

Store earning funding is allowed only through an authoritative store refund snapshot. Generic payment-level inference is fail-closed whenever a payment has remaining store earning exposure. Reservation increments `refundReservedAmount`; cancellation/rejection decrements it; successful completion moves the same exact value from reserved to refunded. Cumulative Decimal calculation ensures the final full refund consumes all remaining cents. A released earning is never automatically clawed back; it opens or requires reconciliation instead.

## Idempotency and concurrency

Accrual uses an operation key plus canonical request/calculation hash and an independent unique settlement identity. Payment is locked first, commission allocations are locked by sorted ID, and all projection, journal, aggregate, charge, and history writes share one Serializable transaction. Release/reversal/refund operations lock the earning and commit journal/projection/state/history atomically. Database deferred checks repeat the important sum, ownership, and journal-shape invariants at commit.

## Production activation

`STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED` is deliberately `false` in reviewed source. Accrual, release, and reversal fail closed with `CONSOLIDATED_VALIDATION_NOT_APPROVED`; reads remain available for migrated evidence. There is no environment-controlled activation.

Phase 20 must own the authoritative marketplace settlement producer. Phase 21 must own lifecycle timing and release-eligibility evidence. Phase 13 remains the only withdrawal foundation: release credits its existing owner-withdrawable account and never initiates a payout.

## Deferred validation

No migration, seed, package installation, Docker environment, full suite, build, browser run, CI run, audit, or marketplace settlement was executed during implementation. The isolated PostgreSQL and Chromium suites are scaffolding only. See [the Phase 16 risk register](deferred-validation/phase-16-risk-register.md).
