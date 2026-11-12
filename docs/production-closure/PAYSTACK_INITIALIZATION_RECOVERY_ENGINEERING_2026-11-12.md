# KT Couriers — Paystack First-Charge and Provider Recovery Engineering Closeout

**Review date:** 12 November 2026  
**Repository:** `analyticsmath/KT-Courier` · `main` only  
**Audited baseline:** `412ee8c466a4cea209dcf8c614a9f8c214f316c3`  
**Disposition:** Source-level Paystack preflight recovery hardened; no live-money release authorization or fabricated settlement.

## 1. Governing functional scope and source authority

The client's most recent question/answer controls any conflicting text in the nine documents. The November Website Developer Brief supersedes the other eight on conflicting requirements; Delivery and Access and Website & System Changes control the remaining six where they conflict. All nonconflicting obligations apply. Phase-one priority is parcel quotation/booking/card payment and the same customer account's marketplace checkout; driver, admin, ledger, COD and refund processes must remain correctly linked.

This change preserves the existing provider model: Paystack test/live configuration is strictly separated; a customer callback is not payment proof; a signed, amount-matched provider event is verified and ledger-posted before courier dispatch becomes financially eligible. Unregistered vendors may onboard, but collection-address and checkout certification cannot be bypassed.

## 2. Payment and delivery cross-role trace

| Step | Canonical source | Invariant |
| --- | --- | --- |
| Guest parcel quotation | `lib/client-platform/delivery.service.ts`, `app/api/public/delivery-quotes` | Correct configured price/coverage/parcel profile and a single-use quote |
| Customer or store parcel booking | `app/api/public/delivery-quotes/[id]/book/route.ts`, `lib/services/orders.service.ts` | Authenticated owner/workspace, approved store pickup, one order per quote, strict identical replay recovery |
| Payment creation and wallet split | `lib/services/payment-preparation.service.ts`, `lib/services/wallet-spending.service.ts` | Immutable order/amount, unique payment, reserved wallet funds, no double spend |
| Paystack customer handoff | `lib/services/payment-provider-session.service.ts`, `lib/payments/providers/paystack/paystack-adapter.ts` | Exact merchant reference; only trusted HTTPS Paystack URL; unknown outcome never creates fictional success |
| Provider event intake and confirmation | `app/api/payments/paystack/webhook/route.ts`, `lib/services/paystack-webhook-application.service.ts` | Modern raw-body HMAC or configured legacy verification, exact reference, provider amount/currency/domain and idempotent event |
| Ledger and courier dispatch | `lib/services/courier-order-confirmation.service.ts`, `lib/services/courier-payment-readiness.service.ts`, `lib/services/dispatch-assignment.service.ts` | One canonical success receipt and balanced journal; no assignment on missing/unknown digital payment |
| Marketplace purchase | `lib/marketplace-checkout/checkout-review.service.ts`, `lib/services/payment-preparation.service.ts`, `lib/services/marketplace-courier-order.service.ts` | Certified store, real route, immutable accepted checkout and one courier handoff |
| Driver completion | `lib/services/pickup-custody.service.ts`, `lib/services/delivery-execution.service.ts`, `lib/services/cash-on-delivery.service.ts` | Active authorized driver, sender OTP, recipient OTP, POD and scoped COD custody |
| Refund/payout/reconciliation | `lib/services/refund-provider-execution.service.ts`, `lib/services/withdrawal-payout.service.ts`, `lib/services/payment-reconciliation.service.ts` | Independent finance approvals, provider evidence, one ledger effect, unknown outcomes remain unresolved |

## 3. Confirmed Paystack ambiguity defect: PAY-RECOVERY-VERIFY-01

**Prior behavior:** Before creating a Paystack hosted checkout, `PaystackAdapter.createCheckoutSession` verifies the original merchant reference to recover a prior provider success. Its previous broad catch treated *any* verification error as 'reference absent' and then called `initializeTransaction` with the same merchant reference. Network failures, invalid credentials, generic 400/500 errors and ordinary provider uncertainty are **not** proof that the reference never existed. An already created pending/abandoned/failed/reversed reference was also eligible for a second initialize request after a non-success verify result. This can strand a customer in a duplicate-reference provider error or obscure an ambiguous financial outcome.

**Fix:**

1. `PaystackClient.request` maps only an explicit `status:false` with exact `Transaction reference not found` or `Transaction not found` in an HTTP **200 or 404** verify response to `PAYSTACK_TRANSACTION_NOT_FOUND`. Paystack's verify API can use HTTP 200 with an API-level false result. Generic 400, 5xx, 200 with a different failure message and network exceptions are not treated as missing references.
2. `PaystackAdapter.createCheckoutSession` only proceeds to Paystack initialize on that explicitly classified missing-reference outcome. Unavailable/authentication/timeout/ambiguous errors propagate to the caller's existing non-success reconciliation handling, with **no second initialize call**.
3. If the reference already exists at Paystack, the adapter verifies exact reference, amount in minor units, currency and provider environment **for every returned status**, not only success. A matching success retains existing 'verified with provider but not journaled' handling; every other status is held for reconciliation instead of initializing another provider transaction.
4. Paystack API calls without a caller-provided abort signal now receive a 20-second request deadline. Session initialization retains its existing shorter caller-provided deadline. The change does not create blind retries on mutation POSTs, alter wallet balances or bypass webhook-ledger confirmation.

**Changed source:** `lib/payments/providers/paystack/paystack-client.ts`, `lib/payments/providers/paystack/paystack-adapter.ts`.

**Tests:** `tests/payments/paystack-adapter-recovery.test.ts` now verifies explicit missing-reference classification for 200/404, other provider errors remaining blocked, no repeat init for pending/ongoing/failed/abandoned/reversed/processing references, preservation of amount/currency/environment, and default deadline. Existing signed webhook, finance and provider-session tests remain in place.

## 4. Independent provider research

- Paystack [Transaction Errors](https://paystack.com/docs/api/errors/transaction/) differentiates an unknown transaction reference from duplicate-reference initiation and other provider errors.
- Paystack [API Errors](https://paystack.com/docs/api/errors/) distinguishes HTTP status from the API `status` field; a transaction verify may return an HTTP 200 with an unsuccessful API result.
- Paystack [Verify Payments](https://paystack.com/docs/payments/verify-payments/) requires inspecting the transaction's own `data.status` and warns against double fulfilment.
- Paystack [Webhooks](https://paystack.com/docs/payments/webhooks/) specifies raw-body HMAC SHA-512 and a bounded timestamp window for the modern signing secret; the repository retains its existing modern/legacy migration controls.

These references justify a conservative decision boundary. They do not establish live Paystack account approval or a real settled transaction.

## 5. Evidence for the source patch

- Focused Paystack/recovery/provider-session suite: **5 test files / 87 tests passed**.
- Full Vitest source suite (from a directory name that does not accidentally trigger a legacy test filter): **1,090 test files / 5,524 tests passed**.
- Generated Next.js route typing and strict TypeScript `tsc --noEmit`: **passed**.
- Focused ESLint: **passed**. Repository-wide lint and migration safety were exercised before the default deadline change; migration safety reports unchanged 113 incremental, 8 archived.
- No migration, production database row, provider secret, Paystack mode, commission policy, payout status or operator approval was mutated by this patch.

The GitHub CI and browser/PostgreSQL certification must be evaluated against **the exact new committed SHA**, not inherited from its parent commit. Live dummy-role testing remains a separate owner-led exercise using authorized test-mode Paystack, real email verification and operationally approved stores/drivers.

## 6. Engineering handover and remaining external evidence

Customer: signed-in parcel + correct quote + booked order + Paystack session + verified webhook + one ledger receipt + dispatch. Vendor: independently certified pickup, owned parcel, merchant order checkout/packing/handoff, no cross-store payer or pickup authority. Driver: actual active driver and vehicle, acceptance/pickup OTP/transit/recipient OTP/POD and earning event. Admin/finance: route/policy controls, dispatch exceptions, COD cash limit/deposit proof, separate settlement confirmation, refunds and payout reviews.

A green source build and complete controlled CI demonstrate substantial **code readiness**, but commercial `NOT_READY` remains correct until real email/provider/merchant/driver and bank acceptance is recorded. Do not manufacture funds, charge status, store geocodes or driver approvals.
