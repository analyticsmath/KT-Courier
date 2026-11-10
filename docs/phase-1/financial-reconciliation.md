# KT Couriers — Phase 1 Financial Reconciliation & Ledger Proof

## 1. Monetary & Provider Authority Invariants

1. **Exact Integer ZAR Cents / `Prisma.Decimal`**:
   - Every parcel quote, marketplace checkout calculation, Paystack transaction initialization, webhook verification, and double-entry ledger journal uses exact ZAR cents (`BigInt` cents or `Prisma.Decimal(12, 2)`). IEEE-754 floating-point arithmetic is never used to authorize charges, splits, or balances.
2. **Paystack-Only Customer Card Channel (`lib/payments/providers/paystack/paystack-config.ts`)**:
   - Customer online payment in both Parcel (`/orders/:orderNumber/payment` -> `POST /api/orders/[id]/payment` -> `POST /api/payments/[publicReference]/checkout-session`) and Marketplace (`/checkout/[reference]` -> `POST /api/checkout/[reference]/pay` -> `POST /api/payments/[publicReference]/checkout-session`) initializes a Paystack transaction (`provider = "PAYSTACK"`, currency `"ZAR"`, amount in kobo/cents).
   - Configuration authority is enforced strictly by `resolvePaystackConfiguration()` in [`lib/payments/providers/paystack/paystack-config.ts`](file:///d:/KT-Courier/lib/payments/providers/paystack/paystack-config.ts) using `PAYSTACK_MODE` (`disabled` | `test` | `live`), `PAYSTACK_SECRET_KEY` (`sk_test_...` | `sk_live_...`), `PAYSTACK_CREDENTIAL_VERSION`, `PAYMENT_APP_ORIGIN`, and `CHECKOUT_PUBLIC_ENABLED`.
   - Time-boxed sandbox testing on a production deployment requires `PAYSTACK_TEMPORARY_SANDBOX_ENABLED="true"`, `PAYSTACK_TEMPORARY_SANDBOX_UNTIL` (UTC ISO timestamp `<= 6 hours` ahead), `PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY` (`sk_test_...`), and `PAYSTACK_TEMPORARY_SANDBOX_PUBLIC_KEY` (`pk_test_...`). Once expired, `resolvePaystackConfiguration()` fails closed and never silently falls back to live money (`tests/payments/paystack-temporary-production-test.test.ts`). Undefined variables such as `PAYSTACK_ALLOW_TEST_IN_PRODUCTION` or `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` are ignored and cannot unlock Paystack.
3. **Never Trust Browser Redirects**:
   - Browser return routes (`/payments/paystack/return` and `/payments/paystack/cancel`) are strictly non-authoritative status/polling surfaces (`tests/payments/paystack-return-presentation.test.ts`).
   - Only a cryptographically verified Paystack webhook (`POST /api/webhooks/paystack`) or server-to-server Paystack Transaction Verify response (`GET /transaction/verify/:reference`) can transition a `Payment` to `PAID`.

## 2. Webhook Signature & Replay Idempotency Proof

Verified in [`lib/payments/paystack-Rollout.ts`](file:///d:/KT-Courier/lib/payments/paystack-Rollout.ts), [`lib/payments/webhook-processor.ts`](file:///d:/KT-Courier/lib/payments/webhook-processor.ts), [`tests/payments/paystack-webhook-signature.test.ts`](file:///d:/KT-Courier/tests/payments/paystack-webhook-signature.test.ts), [`tests/payments/paystack-webhook-durability.test.ts`](file:///d:/KT-Courier/tests/payments/paystack-webhook-durability.test.ts), and [`tests/payments/paystack-financial-invariants.test.ts`](file:///d:/KT-Courier/tests/payments/paystack-financial-invariants.test.ts):

- **Accepted Signatures**:
  - Standard Paystack header: `x-paystack-signature = HMAC-SHA512(rawBodyBuffer, PAYSTACK_SECRET_KEY)` compared via `crypto.timingSafeEqual`.
  - Canonical internal v1 header: `kthm1:t=<unixSeconds>,v1=<HMAC-SHA512("${timestamp}.${rawBody}", PAYSTACK_SECRET_KEY)>` within the 300-second freshness window.
- **Forged / Tampered Signature Rejection**:
  - Invalid or missing signatures are rejected with HTTP `400` (`INVALID_WEBHOOK_SIGNATURE`) before any order, inventory, or ledger mutation occurs.
- **Concurrent & Duplicate Replay Safety**:
  - `PaymentWebhookEvent` enforces a unique constraint on `(provider, providerEventId)`.
  - Concurrent or repeated deliveries of the same `charge.success` event + simultaneous client return verification (`verifyPaymentAttempt`) serialize on the `Payment` row and `FinancialIdempotencyRecord`, producing **at most 1** `PAID` transition, **at most 1** `LedgerJournal`, and **at most 1** `MarketplaceOrder` / `Order` confirmation.

## 3. Double-Entry Ledger & Order Reconciliation Matrix

| Channel & Scenario | Payment State Transition | Order & Inventory State | Ledger Journal & Entry Invariant | Verified Test Suite |
|---|---|---|---|---|
| **Parcel Card Payment (`charge.success`)** | `Payment`: `PENDING` -> `PAID`; `PaymentAttempt`: `INITIALIZED` -> `SUCCEEDED` | `Order.paymentStatus` -> `PAID`; `Order` eligible for dispatch; outbox event queued | 1 balanced `LedgerJournal` (`sourceType = "PAYMENT_RECEIPT"`); `DEBIT` Paystack Clearing Account (`ASSET`), `CREDIT` Platform Courier Revenue / Customer Clearing; `sum(DEBIT) === sum(CREDIT)` | `tests/payments/paystack-financial-invariants.test.ts` (23/23 PASS) |
| **Marketplace Card Payment (`charge.success`)** | `Payment`: `PENDING` -> `PAID`; `PaymentAttempt`: `INITIALIZED` -> `SUCCEEDED` | `MarketplaceCheckout`: `LOCKED` -> `COMPLETED`; 1 `MarketplaceOrder` + N `MarketplaceStoreOrder` records created once; reserved stock committed once | 1 balanced `LedgerJournal` (`sourceType = "PAYMENT_RECEIPT"`); store merchandise liability and courier delivery fee allocated per store order; `sum(DEBIT) === sum(CREDIT)` | `tests/integration/marketplace-payment-settlement.integration.test.ts`, `tests/payments/marketplace-reservation-payment.test.ts` |
| **Failed / Abandoned Card Payment (`charge.failed` or user cancel)** | `Payment`: `FAILED` or `CANCELLED`; `PaymentAttempt`: `FAILED` / `ABANDONED` | Parcel `Order` remains unpaid (`PENDING` / `PAYMENT_FAILED`); Marketplace checkout never creates `MarketplaceOrder` and releases expired stock reservations | **Zero** revenue `LedgerJournal` entries posted (`ledgerJournalCount === 0`) | `tests/payments/paystack-contract.test.ts` (24/24 PASS), `tests/payments/paystack-financial-invariants.test.ts` |
| **Amount or Currency Mismatch at Provider** | `PaymentAttempt` flagged for reconciliation; `Payment` never marked `PAID` | Order remains unpaid; discrepancy recorded in `PaymentWebhookEvent` / reconciliation audit | **Zero** false-paid ledger entries posted | `tests/payments/paystack-financial-invariants.test.ts` |
