# Store Earning Release

Release is an internal operation; no route or store control exposes it. The earning row is locked and all evidence is reread in a Serializable transaction.

Release requires every condition below:

1. Status is `ACCRUED`.
2. Consolidated production validation is approved in reviewed source.
3. A release eligibility time exists.
4. The eligibility time has matured.
5. Refund reservation is zero.
6. No open/monitoring store earning reconciliation exists.
7. No open/monitoring related refund reconciliation exists.
8. Commission charge and projection evidence is coherent.
9. The payment has no reconciliation conflict.
10. Exact remaining entitlement is positive.
11. Store and wallet are active.
12. The existing owner-withdrawable account is valid.
13. The store payable account is valid and sufficient.
14. No release journal already exists (except idempotent replay).
15. No reversal journal exists.

The exact remaining amount is reclassified from `STORE_EARNINGS_PAYABLE` to Phase 13 `OWNER_WITHDRAWABLE`. No cash account changes. Journal, projection, status, timestamp, and safe history either all commit or all roll back. Existing release evidence returns an idempotent read.
