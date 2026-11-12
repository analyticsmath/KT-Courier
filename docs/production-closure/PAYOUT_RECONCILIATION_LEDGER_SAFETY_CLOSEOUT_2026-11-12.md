# KT Couriers — Payout reconciliation and ledger-safety engineering closeout

Repository: analyticsmath/KT-Courier; branch: main
Audited source baseline: d964acef72b298b3131d0821518de9a5a6e061e0
Reviewed: 12 November 2026
Scope: customer payment receipts, vendor and driver earnings, finance-admin approval, Paystack transfer attempts, provider-event ordering, payout reversal accounting, COD/wallet, refund/reversal lifecycle.

## A. Verified code corrections

| Defect | Source | Corrective invariant |
|---|---|---|
| Old payout events could change a newer withdrawal | lib/services/paystack-transfer-execution.service.ts | New payout effects require matching WithdrawalRequest.currentPayoutAttemptId, pending withdrawal state, and unresolved attempt state. Out-of-order late success/failure/blocked events create reconciliation cases, never a duplicate payout journal or cleared in-flight reservation. |
| Transfer failed/blocked could act on mismatched transfer code | same | Compare provider transfer code to stored attempt when available; mismatch records a finance case without posting or resetting the withdrawal. |
| A reversed payout could never create a canonical ledger reversal | same | Every settled reversal has a reversalOfJournalId referencing the original payout journal, with identical ZAR amounts and inverse account directions. Canonical ledger validation enforces exactly one direct reversal and rejects double reversal. |
| PAID record with missing payout journal could be labeled reversed | same | PAID without source journal creates a reconciliation case; no fabricated reversal journal or terminal reversal receipt. |
| A reversed pre-settlement attempt could later be marked paid | same | Reversed safeEvidenceReference disqualifies a subsequent success event; contradictory provider evidence goes to finance review. |
| Retry of successful payout could conceal a changed provider amount | same | Validate amount, ZAR currency, beneficiary, transfer code, provider identity/environment on repeated success before returning DUPLICATE. |
| Ambiguous transfer could not be resolved by later definitive failure | same | UNKNOWN remains terminal under the generic payout state machine. The signed-webhook or provider-verified failure handler alone resolves that same locked attempt to FAILED without starting another provider transfer. |
| OTP could apply to a replaced payout attempt | same | OTP finalization requires the current unresolved attempt, not merely a matching transfer reference. |

These changes do not manufacture a charge, simulate bank settlement, reverse accounting manually, or disable live payment authentication. They preserve source-bound records and provider-proven idempotency.

## B. Validation evidence

Local source verification on the audited baseline plus patch:
- Payment suite: 66 files / 437 tests passed.
- Refund suite: 26 files / 115 tests passed.
- Processor suite: 10 files / 66 tests passed.
- Withdrawal, driver-earning, store-earning and ledger suites: 59 files / 184 tests passed.
- Focused transfer suite: 38 tests passed (included within payment suite), with new late-event, reversal, insufficient-journal and replay cases.
- TypeScript: typecheck passed with zero errors.
- Targeted ESLint: zero errors; migrations:check passed, 113 incremental and 8 archived.
- Full coverage was attempted but exceeded the local test-runner window before emitting a final receipt. Do NOT record that run as a pass.
- Full repository ESLint is to be confirmed by exact-commit GitHub CI; the longer local run did not emit a completion receipt.
- Independent exact-commit GitHub CI, database integration and browser certification must be attached after the final commit is created. Baseline GitHub CI is not evidence of a new commit's success.

## C. Immutable ledger assertions

1. Every verified customer card receipt requires authenticated Paystack provider evidence, amount/currency/reference consistency, balanced double-entry journal, and one downstream verified-payment outbox intent. A return-page visit alone cannot mark paid.
2. Wallet and deposit-plus-COD postings remain distinct from customer external cash; a driver cash deposit must have a custody chain and independent finance verification.
3. Store and driver earnings remain liabilities until their actual reviewed settlement; refund reversals and order adjustments must not overstate externally funded customer refunds.
4. Paystack payout requires a genuine approved destination, independent maker/checker, one active payout attempt and unique idempotency reference. Unknown/ambiguous provider requests are never automatically retried with a new transfer.
5. Payout settlement debits withdrawal-held liability and credits platform cash clearing only on validated provider success. Provider reversed after settlement posts one exact inverse referencing the original payout journal. Reversal before settlement cannot invent a settlement that never occurred.
6. Old or conflicting provider events create source-linked reconciliation cases and do not rewrite the current attempt.

## D. Owner-assisted dummy-account proof

Use controlled customer, store, driver and finance-admin accounts with an isolated test payment environment and source-linked receipt IDs:
1. Customer books Economy, Standard and Express delivery; records pickup/dropoff quotes, immutable price and actual booking. Prove card, wallet and eligible split deposit-plus-COD outcomes and duplicated webhook idempotency.
2. Vendor books outbound parcel from their own configured mapped pickup; verify driver assignment, sender OTP, recipient proof of delivery and earnings release.
3. Driver collects allowed COD, records custody and bank-deposit evidence; separate finance admin reviews and approves. Reject self-approval, high-risk cash and maximum-custody violations.
4. Marketplace multi-store purchase and parcel fulfillment: verify merchant gross, customer net, platform welcome subsidy, proportional refunds and liability conservation.
5. Vendor and driver each submit a withdrawal. Independent finance user approves, then Paystack test transfer succeeds; inspect payout attempt, bank recipient, ledger original, and resolved finance case.
6. Repeat transfer.success with identical evidence: no duplicate journal. Replay with changed amount/beneficiary/code: reconciliation required. Send transfer.failed and transfer.blocked for older attempt: current withdrawal remains protected.
7. Reverse an already-paid transfer: verify one reversal journal exactly linked to original and held liability restored. Replay reversal, reverse without original, and send late contradictory success: no duplicate or invented posting.
8. Inspect admin dashboards, ledger journal links, BOLA/role permissions, refund cases, driver cash cases and reconciliation history.

## E. Scope and authorization truth

This file certifies implementation scope and reproducible local code tests, not an actual historic Mastercard receipt, Paystack live bank settlement, tax exemption, confirmed pickup records or human signature. Owner-supplied merchant and driver onboarding data is not a missing engineering feature. The code can be ready to test while specific real users remain unonboarded. Do not flip commercial payout or launch-approval flags without genuine operator authority. Commercial release remains distinct from code verification. All financial events must be reconciled through authenticated source evidence, never manually fabricated data.

