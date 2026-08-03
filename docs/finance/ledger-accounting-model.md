# Ledger accounting model

## Double entry

A posting command produces exactly one `LedgerJournal` containing every line of the atomic event. Total debit value must equal total credit value. An entry amount is always positive; `DEBIT` or `CREDIT` carries direction.

The journal is final at creation. Entries are evidence and are never edited or deleted by runtime services. Corrections use a new inverse journal.

## ZAR money

Phase 9 supports ZAR only. Inputs are decimal strings and persisted money uses `DECIMAL(18,2)`. Zero, negative, exponential, whitespace-padded, excessive-precision, non-finite, native-number, and out-of-range values are rejected. No floating-point conversion or implicit rounding participates in accounting.

API and service DTOs serialize authoritative values as fixed two-decimal strings. The admin renderer groups and localizes these strings without converting them to JavaScript numbers.

## Categories and normal side

| Category | Normal side | Normal-side entry | Opposite-side entry |
|---|---|---|---|
| ASSET | DEBIT | increases balance | decreases balance |
| EXPENSE | DEBIT | increases balance | decreases balance |
| LIABILITY | CREDIT | increases balance | decreases balance |
| REVENUE | CREDIT | increases balance | decreases balance |
| EQUITY | CREDIT | increases balance | decreases balance |

Normal side is derived centrally and is not stored as an independently editable field.

## Projections

Each `LedgerAccount` stores `currentBalance`, `debitTotal`, `creditTotal`, and `version`. These values are updated in the same Serializable transaction as the journal and entries. They are a query projection, not independent evidence.

For debit-normal accounts, `currentBalance = total debits - total credits`. For credit-normal accounts, `currentBalance = total credits - total debits`. The invariant verifier recomputes all three numeric projections from entries. Any difference is a financial-integrity failure.

## Account purposes

The stable purpose registry includes `AVAILABLE`, `PENDING`, `HELD`, `CASH_CLEARING`, `SETTLEMENT_CLEARING`, `PLATFORM_REVENUE`, `ADJUSTMENT`, `SUSPENSE`, and `OPENING_BALANCE_CONTROL`. Defining these names does not activate future workflows. Phase 9 seeds only platform cash-clearing and adjustment/control accounts.

## Locking and retry

Posting gathers distinct account IDs, sorts them ascending, and locks them with parameterized `SELECT ... FOR UPDATE`. It then re-reads account/wallet state before calculating projections. Serializable isolation plus conditional version updates protects against double spend and stale projection writes.

Retry recognizes only concurrency failures (`P2034`, `40001`, `40P01`) and an explicit retryable version conflict. Retry is bounded. Semantic errors are returned immediately.

## Idempotency receipt

The unique journal idempotency key is the durable receipt. Its SHA-256 request hash includes normalized journal type, currency, stable references, semantic memo/metadata, policy version, reversal target, and sorted financial lines. It excludes timestamps, generated IDs, actor display data, and object property order.

Same key and same hash means replay. Same key and different hash means conflict. A failed transaction consumes neither the key nor a source/reversal relation.

## Reconciliation equations

For every journal, entry count is at least two and `sum(DEBIT.amount) = sum(CREDIT.amount) = journal stored totals > 0`.

For every account, stored debit and credit totals match its entries, and current balance matches the category normal-side recomputation. For every reversal, line sequence/account/amount is preserved and direction is inverted. One original has at most one direct reversal.

