# Store Earning Accounting

## Account

Each active store uses its existing canonical active STORE/ZAR wallet. Phase 16 idempotently provisions one active ZAR liability account with purpose `STORE_EARNINGS_PAYABLE`, `allowNegative = false`, and zero opening evidence. It never manufactures opening balance, cash, settlement, or entitlement evidence.

## Accrual

For exact authoritative `netStoreEarningAmount`:

| Direction | Account | Amount |
|---|---|---|
| Debit | Platform customer funds held (`HELD`) | Exact net store earning |
| Credit | Store earnings payable | Exact net store earning |

The journal type is `STORE_EARNING_ACCRUAL`. It moves no cash and credits no owner-withdrawable account. Journal, commission projections, immutable aggregate, charge links, and history commit in one Serializable transaction.

## Release

For `amount - refundedAmount - reversedAmount - releasedAmount` after every eligibility check:

| Direction | Account | Amount |
|---|---|---|
| Debit | Store earnings payable | Exact remaining entitlement |
| Credit | Existing Phase 13 owner-withdrawable | Exact remaining entitlement |

The journal type is `STORE_EARNING_RELEASE`. It is a liability reclassification, not cash movement or payout initiation.

## Reversal

For the same exact remaining entitlement before release:

| Direction | Account | Amount |
|---|---|---|
| Debit | Store earnings payable | Exact remaining entitlement |
| Credit | Platform customer funds held | Exact remaining entitlement |

The journal type is `STORE_EARNING_REVERSAL`. A released amount cannot be clawed back through this flow.

All values are Prisma Decimal-derived canonical ZAR strings. The policy contains no floating-point financial arithmetic.
