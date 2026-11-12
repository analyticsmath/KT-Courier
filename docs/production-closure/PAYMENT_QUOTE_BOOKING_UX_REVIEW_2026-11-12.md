# KT Couriers — Exact-Commit Payment and Guest-Quote Booking UX Engineering Closure
Date: 12 November 2026
Source baseline: `fcd0935191479199678ea4b25cc54ba26ca11710` on `main`.
Authority: Client's direct written answers > Website Developer Brief > (in conflict) Delivery and Access and Website & System Changes > remaining client documents. Nonconflicting requirements remain binding.

## 1. Observed defects and code decisions

### P0 — Payment POSTs incorrectly required Content-Length
The order-payment and Paystack checkout-session endpoints shared `validatePaymentJsonRequest` in `lib/payments/customer-api-policy.ts`, rejecting any JSON POST with no `Content-Length` (treated as zero). Modern HTTP/2 and reverse-proxy request paths can validly omit that header. Consequently, a legitimate card checkout request could fail before payment preparation, although the body was present.

**Repair:** Both payment mutation routes now await `readBoundedPaymentJsonRequest`. It validates the media type, accepts absent length, streams the actual bytes with a **2,048-byte hard cap**, rejects forged oversized declarations, empty or invalid UTF-8/JSON, and keeps the signed-in payer, origin validation, rate limits, operation-ID/idempotency and payment-ledger/Paystack authority unchanged. No extra transaction or provider charge is created on parsing failure.

**Tests:** `tests/payments/payment-json-body-policy.test.ts` covers no-length JSON, chunked JSON, declared length, actual-size overflow, multi-byte characters, empty/malformed body and incorrect header/type.

### UX — Guest quote resuming after signup/login stranded contact entry below quote configuration
The public quotation page, contact form and payment method selection were rendered together, below a potentially long address/parcel configuration form. Returning from login/verification with `/quote?reference=` showed the quote form first and forced scrolling down to continue. Customers also had to infer which screen represented the booking step.

**Repair:** `/quote/book?reference=<opaque-quote-id>` is now a dedicated authenticated page with compact numbered progress, active quote details and visible sender/recipient contact and payment controls near the top. Guest sign-in and signup both preserve this safe same-origin return URL through email verification. Legacy signed-in `/quote?reference=` URLs redirect into the dedicated step. Users calculating a quote while already logged in choose **Continue to delivery details**. The public quote form no longer renders contact/booking inputs underneath the quote; booking is a deliberate second step. Quote reads, server-derived price, expiry, ownership, high-risk cash policy and booking API are unchanged.

**Vendor/employee authorization:** The booking URL retains a `workspace=store` indicator for business-originated parcels. Its server page confirms store/deliveries membership through the real pickup/address service, including authorized staff with a primary CUSTOMER role. The API continues to require `X-KT-Workspace: STORE` and checks seller pickup against the verified saved collection address. A forged workspace query does not confer merchant ownership.

**Tests:** New `tests/client-platform/parcel-booking-step-ui.test.ts` and updated `tests/client-platform/parcel-booking-navigation.test.ts`, `tests/auth/return-url.test.ts`, and `tests/e2e/anonymous-courier-quote.spec.ts`. Playwright assertions require the dedicated route at both desktop/mobile widths, no quoted-address form on the booking page, continued guest quote ownership, approved online choice, forbidden COD, exactly one order and navigation into payment.

### UX — Pending payment gave no safe visible recovery
`PaymentCheckoutClient` already blocked another checkout while payment was PROCESSING, but offered no way for the payer to obtain the latest ledger-backed payment state on the page. Browser redirects and delayed Paystack webhooks could therefore appear stuck.

**Repair:** A button fetches the existing **owner-scoped GET payment status** and validates the returned order reference, payment public reference and ZAR currency before displaying success or pending notice. It does not issue a POST, start another charge, fake payment success or reset a provider uncertainty hold. Processing continues to suppress new charges. Changed a legacy PayFast-specific invalid payer email error to the existing provider-neutral `PAYMENT_PAYER_EMAIL_REQUIRED` code, already mapped to a human-readable 422.

**Tests:** `tests/payments/payment-checkout-status-ui.test.ts`, `tests/payments/payment-checkout-status-refresh.test.ts`; real client interaction tests ensure one GET, no POST or extra charge, and rejection of a payment response for a different reference.

## 2. Payment-provider alignment, not a new financial shortcut
Paystack official provider docs:
- https://paystack.com/docs/payments/webhooks/ — verify webhook signature over raw bytes (new `Paystack-Signature` with whsec_ timestamped HMAC and legacy x-paystack-signature as appropriate); exact retry/idempotent handling.
- https://paystack.com/docs/payments/verify-payments/ and https://paystack.com/docs/payments/accept-payments/ — only a verified successful transaction and matching minor-unit amount/currency authorizes fulfilment; redirect alone does not.
- https://paystack.com/docs/api/transaction/ — server initializes transaction with ZAR amount in subunits and reference.
The existing webhook signature, verified provider success, wallet reservation/consumption, frozen quote, ledger and dispatch safeguards were audited and intentionally retained. No provider credentials, real bank settings, automatic payouts or production financial approvals were changed.

## 3. Source-level acceptance and exact-SHA gates
Changed code spans guest `/quote`, authenticated `/quote/book`, customer and staff store delivery, owner-scoped payment preparation, checkout session creation and customer payment status. Local full Vitest, ESLint, TypeScript, migration safety, and exact new-SHA GitHub CI/Playwright/PG acceptance must be reported separately. Any new commit invalidates prior GitHub success as exact-SHA proof.

### Developer real-account acceptance matrix (to execute after code checks pass)
1. Guest customer gets a serviceable Johannesburg/Pretoria quote, then signs up with a genuine email, completes verification and lands **on the dedicated booking page**, not the long quote form. Validate quote ownership, expiry, sender/receiver fields and one order per quote.
2. Customer books digital-only, reaches the canonical order-payment screen, uses an explicitly authorized Paystack test method, and observes provider-confirmed success, ledger journal, dispatch readiness and notifications. Test interrupted return and **Check payment status**, ensuring it cannot create a second charge.
3. Customer switches to marketplace without signing in again, reuses owned saved addresses, checks out only at a certified collection address and receives correct merchant/driver fulfilment.
4. Vendor owner and authorized staff book under the STORE workspace (never personal CUSTOMER ownership), use genuine verified collection and payment. Test a forged or unapproved store-workspace link.
5. Approved driver accepts dispatch, pickup sender OTP, live tracking, recipient OTP/POD and completion, with retry/failed attempt/reassignment rejection checks.
6. Approved COD: correctly scoped high-risk restrictions, cash limit, actual driver custody, uploaded genuine daily deposit proof, independent admin clearance and balanced ledgers; no default cash eligibility.
7. Finance reviews provider reconciliation, wallet debit/split, partial deposit, refunds/reversals and chargeback holds. Use actual system-generated references; never fabricate balances or provider success.

**Commercial release remains separate from code completeness:** Real user identity, operational coverage, merchant seller documents, real collection maps, driver vehicles, provider merchant acceptance, notification inbox routing, bank deposits and owner/legal approvals require genuine data and approval. Do not turn a code-green result into a false physical-delivery or settled-money certificate.
