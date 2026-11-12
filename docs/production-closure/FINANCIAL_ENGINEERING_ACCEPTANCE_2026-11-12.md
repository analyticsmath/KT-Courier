# KT Couriers — Financial lifecycle engineering acceptance

**Review date:** 12 November 2026
**Repository:** analyticsmath/KT-Courier; main only
**Source baseline:** 9b39d2c06798439e8c630b3b45ebb67ca6bfb0f4
**Scope:** customer parcel card/wallet/COD; vendor/store earnings; driver earnings and cash custody; Paystack transfers; admin finance and audit; partial/full refunds, promotional subsidy and reconciliation.
**Engineering disposition:** Core financial implementation is present and tested; the exact amended commit must pass remote CI and certification. This document does not grant live financial release or assert that any historic real-world card payment was settled.
**Commercial release disposition:** No unverified payout activation, operator approval, tax exemption or production ledger mutation is authorized by this document.

## A. Canonical money movement and source-of-truth invariants

| Path | Source authority | Evidence / invariant |
|---|---|---|
| Customer parcel booking + card | lib/client-platform/delivery.service.ts; lib/services/payment-provider-session.service.ts; lib/services/paystack-webhook-application.service.ts | Map-verified quote and immutable amount; Paystack provider return alone cannot mark paid. Verified charge-success webhook, independent Paystack status check, one balanced receipt journal, one durable verified-event intent before successful order dispatch |
| Provider success recovered during checkout initialization | lib/payments/providers/paystack/paystack-adapter.ts; lib/services/payment-provider-session.service.ts; lib/services/payment-reconciliation.service.ts | Provider API reports success but receipt not journaled: keep PROCESSING, flag reconciliation and preserve the original operation ID. Concurrent already-signed and journaled success remains SUCCEEDED. Never post a synthetic successful ledger journal |
| Customer wallet / partial wallet + card | lib/services/wallet-spending.service.ts; lib/services/paystack-webhook-application.service.ts | Reserved wallet amount consumed only inside verified external receipt transaction; no second consumption on webhook replay |
| Eligible deposit + COD | lib/services/cash-on-delivery.service.ts; lib/driver-operations/custody-policy.ts | Digital deposit must be verified; driver cash portion and cash custody tracked separately; high-risk policy and cash custody caps remain enforced |
| Vendor marketplace sales, discounts and delivery | lib/marketplace-checkout/prisma-marketplace-finalization.repository.ts; lib/promotions/platform-subsidy-ledger.service.ts; lib/marketplace-checkout/settlement-batch.service.ts | Merchant gross, customer net, platform-funded subsidy and marketplace commissions conserve at group/order level; no unsupported subsidy account fallback |
| Store earning lifecycle | lib/services/store-earning-release.service.ts; lib/marketplace-checkout/settlement-batch.service.ts | Earning accrual and release occur only on reviewed canonical order/settlement evidence; refunds and disputes reserve or reverse liabilities |
| Driver earning lifecycle | lib/services/driver-earning-release.service.ts; lib/services/earning-lifecycle-batch.service.ts | Completed parcel events result in reviewed driver earning liabilities, subject to clearance/dispute checks; not a direct invented bank transfer |
| Store/driver bank withdrawal | lib/services/paystack-transfer-execution.service.ts; lib/services/paystack-transfer-reconciliation.service.ts | Separate request/approval/processing, protected payout destination, unique operation and provider transfer reference, strictly matched ZAR amount/currency/beneficiary/transfer code/reference before debit held liability/credit cash clearing |
| Transfer unknown/failed/reversed | lib/services/paystack-transfer-execution.service.ts; lib/services/payment-reconciliation.service.ts | Unknown outcome stays unresolved and cannot trigger duplicate initiation; reversed payout needs one stable idempotent reversal journal, not a timestamp-dependent series; unverified or missing cash-clearing account remains a reconciliation case |
| Refund/cancellation/partial order adjustment | lib/services/refund-reconciliation.service.ts; lib/store-orders/full-order-adjustment.ts; lib/store-orders/financial-adjustment-composition.ts | Customer refund cannot exceed actual external customer-funded amount; promotion expense reversal is separate from customer cash refund; each financial adjustment is bounded and idempotent |
| Admin finance review, payout authorization, audit | lib/withdrawals/withdrawal-dual-control.ts; lib/services/withdrawal-payout.service.ts; lib/services/payment-confirmation-query.service.ts | No maker self-approval, no cross-owner BOLA, no fabricated Paystack settlement. Reconciliation case and receipt references are visible to authorized finance staff |

## B. Defects closed in this engineering change

1. **PAY-FIN-01 — orphan payout initiation:** The Paystack transfer client is resolved and checked before writing a PROCESSING withdrawal payout. Missing/invalid config cannot strand a new payout attempt without provider initiation.
2. **PAY-FIN-02 — same-operation replay failure:** An existing original payout idempotency key is checked and bound to exact withdrawal, actor and request hash before APPROVED/active checks. PROCESSING/UNKNOWN replay does not call Paystack a second time; reuse for a different operation is rejected.
3. **PAY-FIN-03 — incomplete provider beneficiary evidence:** Missing beneficiary or transfer code; wrong amount, currency, provider reference or configured environment cannot mark a transfer as PAID. A mismatch opens a finance reconciliation case without a settlement journal.
4. **PAY-FIN-04 — reversal replay double-credit:** Paystack reversed transfer uses a deterministic per-attempt ledger idempotency key. Previously reversed attempts return DUPLICATE; transfer code must bind to original attempt.
5. **PAY-FIN-05 — missing reversal clearing authority:** When a settled payout is reversed but the cash-clearing account is unavailable, no false REVERSED-without-ledger final receipt is recorded. Finance reconciliation remains recoverable.
6. **PAY-FIN-06 — false-positive scanner receipts:** Transfer scan results distinguish successful payout application from reconciliation-required outcomes; unknown/missing provider fields do not inflate itemsSucceeded.
7. **PAY-FIN-07 — unbounded scheduled finance scans:** Stale payment and withdrawal scan records are ordered by (updatedAt, id) and bounded by the requested batch size; source/pending records are not discarded.
8. **PAY-FIN-08 — phantom paid checkout:** A provider-side Paystack success returned during payment-session recovery may not directly set Payment=SUCCEEDED. The system records PROCESSING plus an explicit PROVIDER_CONFIRMATION_UNAVAILABLE case (providerSuccessUnsettled evidence) until the independent signed webhook posts the balanced receipt and verified-event outbox; an already-journaled concurrent success is replayed safely.
9. **PAY-FIN-09 — live operations scheduler parity:** Railway's production-processors service now includes the four registered payment/refund/withdrawal/Paystack-transfer reconciliation processors. All are cadence-limited independently of the separate scheduler-runner, which Railway was not configured to run. Registry, workers and finance result counters remain the canonical authority.
10. **QA hygiene:** Two unused variables in an existing promotion test removed without changing accounting assertions.

## C. Automated code verification

Validation commands:
- npm run test:coverage — all Vitest coverage-scope tests; zero failures required.
- npm run typecheck — Next.js generated route types plus TypeScript checks.
- npm run lint — zero errors and zero warnings target.
- npm run migrations:check — 113 incremental, 8 archived; no migration mutation introduced by this change.
- prisma validate — schema valid; uses a dummy local connection string, not a production database.
- Financial focused suites cover tests/payments, tests/refunds, tests/processors, tests/withdrawals, tests/driver-earnings, tests/store-earnings, tests/ledger and tests/services/payment-provider-session.service.test.ts.
- Exact GitHub commit must pass independent main CI and Production Certification including browser and real disposable PostgreSQL/Redis evidence. A pending or failed remote result is not a pass.

## D. Owner-led dummy-account acceptance, after engineering gates

Use disposable customer/store/driver/admin identities. Test-mode provider account only, isolated database and no copied production card credentials. Suggested exact scenarios, with one unique request identifier for every distinct action:

1. Customer creates Economy, Standard and Express quotes; serviceability, size/weight, version and taxes are frozen. Customer books standalone parcel and pays through Paystack. Signed charge.success creates one Payment success, one journal with debits=credits, and dispatch-eligible payment readiness; duplicate webhook changes nothing.
2. Customer pays with wallet/card split. Verify wallet reservation/consumption, external receipt amount and total held funds agree; invalid/timed-out provider leaves unresolved, never fake paid.
3. Eligible customer deposit + COD only if policy approved; driver records exact remaining cash, OTP/POD, deposit proof and independent finance review. Prohibited high-risk, cash-cap and self-review cases are refused.
4. Store user uses owned mapped pickup address to dispatch an outbound parcel; customer and store cannot alter pickup source after quote without revalidation. Driver assignment/pickup/delivery produce order/earning evidence.
5. Two-store marketplace purchase with first-purchase welcome: validate group gross versus net, platform subsidy debit/credit and seller settlement basis; partial cancellation reverses net cash and corresponding subsidy without over-refunding the customer.
6. Finance approves a store and driver withdrawal with independent maker/checker. Verify Paystack recipient, amount, currency, environment and transfer code/reference before one payout journal; retry exact operation after timeout performs no second transfer.
7. Simulate a verified failed or reversed provider transfer in test mode. Confirm one reversal journal only, with held liability restored and finance case open. Replay signed event and scanner produces no second reversal.
8. Admin reviews reconciliation cases, provider receipts, ledger journal links, COD deposits, payout disputes and role-based authorization. Refuse cross-owner read/update and records without supporting evidence.

## E. Explicit boundaries (not missing code)

- Merchant onboarding of real pickup addresses, driver document verification and actual payout beneficiary onboarding are legitimate future user/operator operations. They are not reasons to declare the underlying engineering flow unimplemented.
- Production withdrawals remain protected by WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED=false and WITHDRAWAL_PAYOUT_ENABLED=false. Unit/integration-complete code does not equal operator/legal authority to disburse funds. Do not flip these flags without genuine finance approval.
- A generic stale-payment reconciliation scan opens/updates an admin case. It **does not** auto-post payment from an unauthenticated or unsigned provider status. Provider webhook redelivery or a separately reviewed source-authenticated recovery transaction is required for a real success receipt. Do not mark old Mastercard transactions settled without independent Paystack/payment-ledger records.
- Commercial launch, subscription funding, operational commission rates, production promotions and statutory VAT treatment require the applicable owner/accountant approvals where absent; this document never grants them.
- Do not create ledger rows manually, use fabricated provider evidence, reveal secret keys, or run a real payout from this engineering acceptance.

**Acceptance principle:** “Code verified” means reproducible passing static checks, focused and broad automated tests, exact-commit CI, strict financial invariants and an actionable evidence chain. “Live financial settlement verified” additionally requires actual provider/bank and production journal evidence supplied by authorized operators.
