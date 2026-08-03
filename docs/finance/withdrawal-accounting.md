# Withdrawal Accounting

Only owner-wallet liability accounts explicitly classified as `OWNER_WITHDRAWABLE` may fund a withdrawal. `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR` is never a withdrawal source.

| Operation | Debit | Credit | Effect |
| --- | --- | --- | --- |
| Reserve | Owner withdrawable liability | Owner withdrawal-held liability | Available owner liability decreases; held owner liability increases; total owner liability is unchanged. |
| Release | Owner withdrawal-held liability | Owner withdrawable liability | Held liability decreases; the original available balance returns. |
| Payout | Owner withdrawal-held liability | Platform cash-clearing asset | Owner liability and platform cash both decrease atomically. |

All entries use exact `Decimal` ZAR values through the Phase 9 transaction-aware posting primitive. No withdrawal fee, platform revenue, generic adjustment, or suspense posting is permitted.
