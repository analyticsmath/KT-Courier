# Payment Confirmation Ledger

A fully verified Payfast `COMPLETE` notification records external cash received, not earned platform revenue.

```text
DEBIT  PLATFORM-CASH-CLEARING-ZAR          ASSET
CREDIT PLATFORM-CUSTOMER-FUNDS-HELD-ZAR    LIABILITY
```

Both entries use the authoritative `Payment.amount`, exact Decimal ZAR, and gross amount. No `amount_fee` or `amount_net` value affects the journal. No Payfast fee expense, net settlement, commission, earning, refund, or revenue entry is posted in Phase 12.

The journal type is `EXTERNAL_PAYMENT_RECEIPT`. The caller supplies:

```text
idempotencyKey: payfast:payment:<payment-public-reference>:complete:v1
sourceReference: payfast:payment:<payment-public-reference>:complete
correlationId: <payment-public-reference>
```

The accepted Phase 9 ledger normalizer canonicalizes source references. Safe metadata contains only payment, attempt, event, provider-payment references, provider code, and the fee-deferral marker.

The shared ledger service exposes `postLedgerJournalWithinTransaction(tx, input)`. It uses the same normalization, balance policy, idempotency hash, sorted account locks, immutable journal/entry writes, projection updates, owner/currency/status checks, and non-negative policy as ordinary ledger postings. The public posting service continues to wrap that primitive in its own serializable transaction.

Payfast application lock order is event, payment, attempt, then ledger accounts sorted by ID. Journal, entries, projections, attempt success, payment success, evidence links, history, reconciliation resolution, and event application commit in one serializable transaction. A failure rolls all of them back. Unique payment evidence links, ledger source/idempotency identity, SQL checks, and triggers enforce at most one receipt journal per payment.

The required held account is seeded idempotently with zero balance, `purpose=HELD`, `category=LIABILITY`, `currency=ZAR`, and `allowNegative=false`. Live PostgreSQL atomicity and race behavior remain deferred.
