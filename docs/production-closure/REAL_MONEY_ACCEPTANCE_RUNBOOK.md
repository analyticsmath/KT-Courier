# Controlled real-money acceptance

Status: BLOCKED_LIVE_ACCEPTANCE. No production charge, refund, settlement or payout is authorized by this runbook or by this closure task.

## Written authorization before execution

Authorizing human and role: ___
Release SHA and green certification run: ___
Authorized test customer/store/driver accounts: ___
Exact amount and currency (human supplied): ___
Allowed charge/refund/payout operations and ceiling: ___
Provider account/environment: ___
Time window and abort conditions: ___
Finance/operator owner: ___
Authorization artifact reference: ___

Before starting, confirm current approved pricing, coverage, parcel, COD/commission scope if applicable; healthy web/operations/PostgreSQL/Redis; verified notification governance; recovery proof; no pending dangerous Railway patch; protected-table before/after deployment comparison. Use normal application paths, never SQL-created payments or provider dashboard status overrides.

## Execute and collect restricted evidence

1. Obtain an anonymous authoritative quote. Authenticate for booking. Confirm the persisted input/profile/service versions and exact payable amount.
2. Initialize the authorized low-value Paystack payment. Record masked/reference-hashed evidence, provider environment, internal payment/attempt identifiers and timestamp in a restricted finance artifact. Do not record card data, authorization headers or keys.
3. Complete the provider checkout once. Browser return is not proof of payment. Verify signed durable webhook intake, applied inbox state, one verified event, one consumer receipt and one canonical order finalization.
4. Verify the ledger journal balances, configured allocations, store/driver/platform earning states and order ownership. Check duplicate deliveries/events do not produce another financial effect.
5. If the result is unknown, stop. Open/review canonical reconciliation; do not mark successful, charge again or edit ledger balances to force a result.
6. Only under separate refund authorization, request and approve the controlled refund through the real workflow. Preserve maker/checker/processor separation. Verify provider outcome or reconciliation, exact refund ceiling, reversal journal and earning adjustment.
7. Only under separate payout/settlement authorization, execute the appropriate normal finance path. Verify beneficiary authority, provider transfer outcome and journal/earning reconciliation. Do not pay a fabricated beneficiary or use credentials from source/test fixtures.
8. For an explicitly authorized COD exercise, verify the digital half before assigned-driver collection, the exact remaining cash, custody receipt, actual bank deposit, separate bank-receipt review and suspense handling. Never simulate production cash receipt.
9. Store redacted outcome references, amounts, chronology and invariants in the restricted operator artifact. Record only its non-secret reference and SHA-bound acceptance in the readiness surface; obtain independent review.

Abort for stale quote/configuration, unmatched amount, unknown provider result, duplicate financial effects, failed ledger balance, unexpected protected-data change, unhealthy processor or ownership failure. Use reconciliation and the rollback/recovery runbook. The engineering agent must not initiate this exercise without distinct human authorization.
