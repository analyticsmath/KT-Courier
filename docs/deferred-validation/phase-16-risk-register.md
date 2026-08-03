# Phase 16 Deferred Validation Risk Register

| Area | Deferred proof |
|---|---|
| Migration | Clean bootstrap and deployment |
| Prisma | Generation, typecheck and drift |
| Settlement | Future marketplace snapshot compatibility |
| Multi-store | Per-store allocation correctness |
| Commission | Attribution concurrency and projections |
| Accrual | Live locks and rollback |
| Refunds | Store-level item allocation |
| Partial refunds | Cumulative cent behavior |
| Release | Eligibility and refund race |
| Reversal | Commission coordination |
| Withdrawable | Correct Phase 13 account transfer |
| Permissions | Ownership and explicit DENY |
| Build | Production compilation |
| UI | Browser E2E |
| Cross-module | No Order, Payment or driver mutation |
| Production lock | Runtime fail-closed behavior |

## Carried Phase 9–15 risks

| Foundation | Carried risk |
|---|---|
| Phase 9 ledger | Live account lock ordering, deferred constraints, posting retry, immutable journal and balance projection proof |
| Phase 10 payments | Successful receipt/held-liability linkage and reconciliation state accuracy |
| Phase 11 PayFast | Provider evidence authenticity and absence of raw sensitive data |
| Phase 12 confirmation | Verified webhook/receipt concurrency and replay behavior |
| Phase 13 withdrawals | Canonical owner-withdrawable account ownership and downstream reserve/payout behavior |
| Phase 14 commissions | Allocation relation, reversal ordering, over-attribution concurrency, and projection drift |
| Phase 15 refunds | Funding reservation/completion ordering, cumulative projections, provider/wallet rollback, and reconciliation interaction |

These remain deferred because Phase 16 followed an implementation-only workflow. The reviewed source lock must remain false until consolidated validation closes these risks and the marketplace snapshot/lifecycle owners are approved.
