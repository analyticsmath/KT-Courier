# Core commission and earnings execution release

The owner has explicitly requested production operation of purchasing, delivery and vendor/driver settlement. Earlier source constants disabled all commission activation and earning accrual/release irrespective of valid evidence. This release enables those three engines after fresh verification of this exact source revision.

Business percentages remain in versioned commission policies. The editable owner-selected defaults are prepared separately; no policy is approved or activated by this source change. Maker/checker review, effective periods, overlap checks and active-store checks remain mandatory.

Store and driver accrual still require canonical verified successful payment evidence. Driver entitlement additionally requires a matching completed assignment, proof of delivery and event history. Release still enforces maturity, active owners/accounts, coherent commissions, refund reserves and open reconciliation/incident exclusions. Reversal remains bounded to exact immutable balances; released or reserved funds are protected. External withdrawal execution and provider refunds are separate capabilities.

Owner and finance earning projections now derive `productionLock` from the engine's source readiness rather than always returning `active: true`. Their unlock state does not assert that a particular earning is releasable.

Required evidence before merge:

- Full CI, including type checking, linting and financial/security regressions.
- Disposable PostgreSQL commission review and activation without a test bypass, including self-review refusal and overlapping-policy refusal.
- Disposable PostgreSQL store/driver accrual and release without a test bypass, including exact ledger balance, concurrent replay, rejected changed facts, maturity/suspension checks and transaction rollback.
- Browser owner/finance evidence and unauthorized/unreviewed reversal refusal.

This is software release evidence. It does not represent an actual customer charge, provider refund, bank payout or physical parcel handoff. Existing historical launch reports remain historical; they are not silently rewritten to claim completion of external operations.
