# Phase 4 — Payments, Settlements, Growth and Integrations

## 1. Executive Verdict

The existing Phase 9–28 authorities were retained and their missing verified-payment hand-off was completed.

## 2. Canonical Authorities Reused

`Payment`/PayFast ITN, the in-transaction ledger posting primitive, marketplace finalizer, subscription activation hook, earnings, refunds, withdrawals, promotions, advertising, notifications, and developer-webhook projections remain their existing canonical authorities.

## 3. Duplicate or Obsolete Paths Avoided/Removed

No second ITN route, payment aggregate, ledger writer, marketplace finalizer, or subscription activator was introduced. The ITN route no longer directly invokes marketplace or subscription work.

## 4. Repository-Owned Gaps Found

Verified PayFast success committed payment evidence and a receipt journal atomically, but the HTTP route then called downstream domain hooks directly. There was no immutable, durable cross-domain verified-payment event.

## 5. Payment and PayFast Implementation

PayFast parsing, source/signature/merchant/amount/confirmation verification, precedence, idempotency, and receipt posting remain unchanged. Successful application now also writes the verified-payment event in the same transaction.

## 6. Verified-Payment Event Flow

`PAYMENT_SUCCEEDED_VERIFIED` is uniquely derived from the successful payment and verified webhook evidence. It carries safe immutable references, amount, currency, provider, payer reference where present, and schema version. A separate consumer receipt leases, completes, or reconciles downstream dispatch without mutating financial evidence.

## 7. Marketplace Finalization

The existing marketplace finalizer remains sole order/frozen-line/reservation/settlement authority. The bounded Phase 20 payment-finalization worker now consumes verified-payment events instead of querying successful payments directly.

## 8. Ledger and Wallet Integration

Gross PayFast receipt posting still uses the canonical ledger primitive and balanced cash-clearing/customer-funds-held entries. The event is created only after the payment, successful attempt, webhook, and receipt journal have been linked.

## 9. Commission Integration

Existing frozen commission-plan, allocation, and reconciliation authorities were retained; no new commission writer was added.

## 10. Store Settlements and Earnings

Existing marketplace settlement snapshots and store earning accrual/release authorities remain downstream of canonical finalization.

## 11. Driver Settlements and Earnings

Existing Phase 3 completion-evidence requirements, accrual/release distinction, and reconciliation authorities were retained.

## 12. Promoter Earnings

Existing qualified-conversion, frozen allocation, maturity/release, and withdrawal-boundary authorities were retained.

## 13. Refunds

Existing remaining-refundable, allocation, wallet completion, external execution boundary, and reconciliation authorities were retained.

## 14. Withdrawals and Payout Boundary

Existing owner-withdrawable reservation, review/approval, dual-control/manual-evidence, and fail-closed provider boundaries were retained.

## 15. Subscriptions

The existing verified subscription payment activation hook is now dispatched by the durable payment-event processor, not the PayFast HTTP request.

## 16. Promotions and Coupons

Existing reservation, budget-locking, verified-finalization redemption, and frozen refund-allocation authorities were retained.

## 17. Advertising

Existing server-resolved store ownership, funding/billing bounds, disclosure, moderation, and readiness lock were retained. No unsupported generic advertising-payment subject was fabricated.

## 18. Notifications

The verified-success transaction creates one safe `NotificationEventIntent`; delivery remains outside financial transactions through the existing notification processor and its fail-closed readiness boundary.

## 19. Developer API and Webhooks

Existing payment-status-history projection and unique public-webhook delivery authority remain the safe, idempotent payment-status webhook path. No raw PayFast evidence or internal ledger data is exposed.

## 20. Reconciliation

The payment scanner now detects successful payments missing a verified event and stale event dispatches. Consumer failures create a canonical payment reconciliation case and mark the receipt as reconciliation-required.

## 21. Security and Ownership

The ITN remains session-free and is limited to provider verification. Browser return/cancel surfaces remain informational. Downstream owners are resolved in their existing canonical services.

## 22. Idempotency and Concurrency

Event identity, payment/attempt/webhook unique constraints, consumer operation IDs, consumer uniqueness, row locking, short serializable claim transactions, stale leases, and downstream service idempotency prevent duplicate effects.

## 23. Production-Lock Classification

`SOURCE_IMPLEMENTATION_COMPLETE`; `FINAL_CONSOLIDATED_VALIDATION_PENDING`. Existing PayFast checkout/recurring/refund, payout, notification delivery, and live webhook delivery locks remain fail-closed until their external prerequisites and consolidated validation are satisfied.

## 24. Schema and Migration Changes

Added one additive, unapplied migration: `20260805000000_phase4_verified_payment_event_outbox`. It adds immutable event evidence, mutable consumer receipts, cardinality/amount/currency constraints, foreign keys, and evidence/immutability triggers. No accepted migration was changed.

## 25. Files Added

`lib/payments/verified-payment-event-processor.service.ts`; bounded payment-event worker and shell; focused processor test; Phase 4 report; Phase 4 additive migration.

## 26. Files Modified

PayFast application and ITN route; Prisma schema; payment and marketplace processors; payment reconciliation/invariant scripts; package script; directly affected focused source-contract tests.

## 27. Files Removed

None.

## 28. Focused Tests

Passed: six focused files, 27 tests: PayFast application, verified-event processor, PayFast source boundary, marketplace composition, subscription API contract, and subscription lifecycle source audit.

## 29. ESLint

Passed with 0 errors and 0 warnings across every changed JavaScript, TypeScript, and TSX file.

## 30. TypeScript

Passed: `npm run typecheck` (`tsc --noEmit`).

## 31. Conditional Prisma Checks

`npx prisma format` and `npx prisma validate` passed. The migration was not applied.

## 32. Conditional Route-Security Check

Passed: 589 route files and 683 exported route methods were classified successfully.

## 33. Heavy Validation Deferred

No production build, full test run, Docker, database deployment/reset/seed, browser automation, external provider call, or real delivery was run.

## 34. External Activation Items

PayFast production credentials and reviewed live validation; recurring/refund contracts; payout provider; production email/SMS/push; and third-party webhook endpoints.

## 35. Remaining Repository-Owned Gaps

None identified in the inspected Phase 4 composition paths.

## 36. Final Verdict

PHASE_4_IMPLEMENTATION_COMPLETE
