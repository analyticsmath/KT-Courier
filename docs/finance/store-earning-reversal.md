# Store Earning Reversal

Finance reversal is the only Phase 16 admin mutation. Its strict request accepts an operation ID, one approved reason code, and an optional bounded safe note. It accepts no amount, account, replacement status, balance, or journal identifier.

Reversal is permitted only for an accrued entitlement, or a reviewed reconciliation-required entitlement, with positive exact remaining amount, no refund reservation, no released amount/journal, no prior reversal, and coherent related commission reversal evidence. Partial completed refunds reduce the remaining amount; they are never overwritten.

If release exists, the service opens `REVERSAL_AFTER_RELEASE` reconciliation and blocks. If related commission treatment is not reversed/coherent, it opens `REVERSAL_BLOCKED_BY_COMMISSION` and blocks. It never claws back owner-withdrawable directly.

The canonical journal debits store payable and credits customer funds held. Journal, projection, state, timestamp, safe history, and eligible reconciliation resolution share the Serializable transaction. Duplicate canonical reversal evidence is returned idempotently.
