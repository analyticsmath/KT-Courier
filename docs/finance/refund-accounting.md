# Refund Accounting

All Phase 15 amounts are ZAR Decimal(18,2). Refunds never directly mutate account or wallet balances; immutable, balanced journals are the only movement authority.

## Reservation

`REFUND_RESERVE` gathers the exact amount from its current economic destinations:

```text
DEBIT  Platform Customer Funds Held          residual gross value
DEBIT  Platform Commission Revenue           applicable platform clawback
DEBIT  Beneficiary Commission Payable        applicable unreleased beneficiary clawback
CREDIT Customer Refund Held                  exact requested refund
```

Only non-zero applicable debits are posted, and their sum equals the held credit. Journal identity is `refund:<reference>:reserve`; idempotency is `refund:<reference>:reserve:v1`.

## Release

Cancellation and rejection post `REFUND_RELEASE` from the stored funding allocations:

```text
DEBIT  Customer Refund Held
CREDIT each exact original reservation source
```

No policy or commission calculation is rerun. One release journal is allowed, and release and completion evidence are mutually exclusive.

## Wallet completion

`REFUND_WALLET_CREDIT` is a liability reclassification:

```text
DEBIT  Customer Refund Held
CREDIT Customer Wallet Available
```

It makes no cash or revenue movement. It neither spends wallet funds nor changes payment/order status.

## External completion

Verified provider success posts `REFUND_EXTERNAL_PAYOUT`:

```text
DEBIT  Customer Refund Held
CREDIT Platform Cash Clearing
```

Cash sufficiency is rechecked under account locks. No provider fee, bank fee, commission expense, VAT, or fee deduction is posted. The customer receives the full approved refund.

## Atomicity and projections

Reservation commits with refund, allocations, journal, reserved projection, and history. Completion commits with its journal, reserved decrement, refunded increment, attempt/refund success, provider evidence, and history. Any error rolls back the whole database transaction. External network activity is never inside those transactions.
