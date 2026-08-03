# Store Earning Reconciliation

Reconciliation cases are observable, idempotently keyed operational evidence. Reasons cover settlement/commission mismatch, over-attribution, duplicate settlement, missing or wrong ledger links, refund mismatch or refund-after-release, invalid release/reversal/account evidence, stale accrual, and application failure.

Statuses are `OPEN`, `MONITORING`, `RESOLVED`, and `CLOSED`; open and monitoring cases block release. Repeated scanner observations increment a counter and update safe evidence without creating financial mutations.

Resolution requires restored financial invariants plus a canonical operation reference and controlled resolution code. There is no manual amount, balance adjustment, journal replacement, mark-released, or arbitrary state endpoint. Released-earning refunds and post-release reversals remain review items rather than automatic owner-withdrawable clawbacks.

The scanner observes accrual journal linkage, commission charge totals, stale accruals, and released/refund projection conflict. The invariant verifier performs broader SQL accounting, projection, journal, cross-module, Decimal, and production-lock checks. Both are operational tools and were not executed during implementation.
