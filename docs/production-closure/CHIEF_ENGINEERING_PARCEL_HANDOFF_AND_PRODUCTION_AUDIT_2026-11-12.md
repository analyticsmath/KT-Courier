# KT Couriers — 12 Nov 2026 chief-engineering parcel/payment recovery audit

**Scope:** The owner-supplied nine legal/product requirements documents, the latest written client answers, the 5 Nov customer recording, current GitHub `main`, connected Railway production and Vercel production.

**Baseline inspected:** `38d6b4a8e118274f16b7580369840f505c346975`.

**Release classification:** **NOT_READY** for unqualified real-money/physical-delivery commercial acceptance. Code implementation, deployment health and live-money acceptance are different claims.

## Authority and conflict handling

1. The client's latest written answers and issue report supersede conflicting older requirements.
2. **KT Couriers – Website Developer Brief**, especially sections 3.4, 3.13, 3.14 and phase sequencing in section 11, supersedes the other eight documents where they conflict.
3. **Delivery and Access** and **Website & System Changes** supersede the other six documents only on conflicting points.
4. Shipping & Delivery, Terms and Conditions, About Us, Privacy, Updated Details, Refund & Cancellation and all other nonconflicting requirements remain in scope. Superseded clauses are not silently discarded from the requirements inventory.
5. Law, payment-provider rules and immutable financial safeguards cannot be overridden by nontechnical acceptance language.

## Confirmed source/production observations

- `main` baseline Git SHA above was deployed to Vercel production, Railway web, Railway operations and Railway category queries; Railway web, operations, PostgreSQL and Redis were online. Latest GitHub main CI was successful. An online process and successful build **do not** establish a successful parcel card charge, actual delivery, or payout.
- Railway's protected **read-only** deployment audit on 12 Nov reported 58 stores, 29 driver profiles (2 dispatch-ready before capacity checks), and multiple merchant pickup addresses marked incomplete. There is no authority to invent a street, Google Maps Place ID, postcode or driver's licence to satisfy a test.
- A current-store pickup must pass address fields, provider verification, approved seller identity, independent StoreCheckoutCertification with address fingerprint, and an effective ACTIVE StoreOrderOperationalPolicy. `lib/storefront/sql-store-publication.ts` already applies these gates to storefront store/product listings. `lib/marketplace-checkout/phase6-marketplace-quote-authority.ts` revalidates a real pickup and delivery route at checkout. Do **not** remove this requirement to make demo cart items purchasable.
- Railway's latest startup configuration preserved, rather than activated, the pre-existing draft store-fulfilment policy. Draft/unknown policy state must be reviewed and approved before the merchant real-money flow is represented as approved.
- `components/store/StoreSellerIdentityForm.tsx` already supports unregistered individuals: owner's legal name plus shop trading name, optional registration/VAT reference, `NOT_REGISTERED`, `RECEIPT`, guided `PAMMY_BAKES_V1` identity version, and **uploaded private verification evidence** resulting in a generated reference. Typing `PammyBakes` in the evidence-reference field is not proof of identity. Administrator independent review is still required.
- Current shared-customer account and saved-address projection is integrated into marketplace checkout; quote creation is anonymous; customer/store parcel booking uses the same owner-authorized payment page. Earlier client complaints are useful regression scenarios, not proof those exact source regressions remain on current `main`.
- Parcel digital payment is constructed through canonical `Order` -> owner-verified payment preparation -> Paystack checkout session -> signed provider webhook and ledger confirmation. A return URL or UI success message must never settle a payment.
- The client placeholders `[add business email]` and `[add owner email]` are **not email addresses**. Do not create fake owner recipients. Separate VAT switches, high-risk cash restrictions, referral, welcome offer, loyalty, wallets, COD settlement and notifications remain subject to exact-current-row and financial acceptance checks.

## Implemented engineering repair — confirmed parcel booking to payment handoff

**Failure mode:** A successfully consumed parcel quote can remain on the booking form if client-side `router.push` does not complete. The button previously returned to its reusable state while the canonical booking already existed, inviting a second POST that the backend correctly rejects with `QUOTE_USED`. That makes a customer perceive the card option as broken even though an order was created.

**Change:** After a successful booking API response, immediately persist the server-confirmed next-step URL in client state, provide a real Next `Link` to the canonical payment page (or approved FULL_COD order details), disable the already-completed form submission, and guard concurrent submits with a ref. When navigation throws, present an accurate recovery message rather than claiming the booking failed. Label the digital choice explicitly **Card / online payment** and name the secure Paystack handoff. No provider transaction or financial status is inferred. A fresh independent quote resets the local continuation state.

**Files:** `components/forms/PublicDeliveryQuoteForm.tsx`, `components/forms/ParcelBookedNextStep.tsx`, `components/forms/ParcelPaymentChoice.tsx`, tests for payment choice and booking continuation.

**Verification:** Targeted 14/14 tests, broader client-platform and parcel/payment/readiness tests passed; focused ESLint passed; Next route type generation and TypeScript `--noEmit` passed. Real provider and browser production acceptance remain separate gates. For authoritative results after merge/push, inspect the exact new SHA's GitHub CI and Production Certification, then Railway and Vercel deployed SHAs.

## Unresolved exact production acceptance — do not represent as solved

| Priority | Required observation/evidence | Scope owner |
|---|---|---|
| P0 | Real or provider-sanctioned end-to-end **parcel** card initialization, return, signed webhook, confirmed settlement, single immutable balanced journal, customer receipt and driver dispatch eligibility at exact SHA | Engineering + authorized payment owner |
| P0 | Marketplace shopper signed-in from parcel account, saved-address reuse, actual reviewed merchant pickup/active route/coverage, order reservation, Paystack confirmation and inventory/settlement accounting | Engineering + actual merchant/operations approval |
| P0 | A real prepared/approved driver and vehicle can accept, collect with sender OTP, capture sender/recipient handovers, GPS/POD and complete delivery in the configured region | Engineering + driver/operations validation |
| P0 | Effective independently approved StoreOrderOperationalPolicy and pickup certifications exist for the stores the owner authorizes to sell. Incomplete stores stay unavailable and receive actionable missing-field guidance | Owner/operations via admin + engineering regression |
| P1 | Real Paystack settlement, wallet/card split, refunds, COD bank deposit proof, daily reconciliation, no duplicate webhook/payout, high-risk cash exclusion, approved commission and payment modes | Authorized finance/operator + engineering |
| P1 | Real identities, documents, POPIA access, role-bound customer/vendor/driver/admin operations, owner notification recipients, independently reviewed legal notices | Operators/legal + engineering |
| P2 | Other nine-document feature acceptance: loyalty, R5 paid-first-order referral, R50 first marketplace offer, marketing, promotions, notifications, exports, reports, social/profile, growth and admin-configured nationwide expansion | Engineering + commercial owner |

**Required operating discipline:** Main branch only as requested; no staged production environments. Use isolated/disposable local resources to run tests without touching live customer funds or production database rows. Do not manufacture approvals, force database status flags, disable webhook verification, fabricate merchant coordinates or real-money transaction receipts. A genuine production readiness claim needs exact-commit CI, security, database/browser, restore and actual provider/field acceptance.


## 12 November additional code-level closure — lost-response parcel booking recovery

**Finding:** The direct parcel quote is single-use, with a unique `Order.pricingQuoteId`. This correctly prevents duplicate orders, but an HTTP response lost after a successfully committed booking caused a retry to see a USED quote and receive a misleading expired/used error, even though the order and payment handoff were already created.

**Repair:** `POST /api/public/delivery-quotes/[id]/book` now recovers an already committed parcel order with HTTP 200 when its quote belongs to the same authenticated actor and workspace, the order is genuinely tied to a USED `client-delivery-v1` quote, and the normalized sender/recipient, parcel description, scheduled time and digital/COD method match. New bookings retain HTTP 201 and the original transactional quote claim. A conflicting replay returns a typed HTTP 409 and makes no payment/order changes. A concurrent winner between initial lookup and quote read/claim is also recovered. Existing separate Paystack payment preparation, signed events, double-entry ledger and dispatch authority are untouched.

**Code:** `lib/client-platform/parcel-booking-recovery.ts`, `app/api/public/delivery-quotes/[id]/book/route.ts`, `lib/client-platform/contracts.ts` and `tests/client-platform/parcel-booking-recovery.test.ts`.

**Verified before publication:** focused TypeScript with generated Next.js route types, ESLint and five focused files (22 tests) passed. An additional **191 test files / 1,201 tests** across client-platform, payments, driver operations, marketplace checkout, parcel payment methods and storefront readiness passed. A separate **98 files / 390 tests** covering refunds, ledger, withdrawals, store/driver earnings, processors, tracking and notifications passed. These are source-level regression results, **not real-money receipts or a physically completed delivery**. The exact published GitHub commit must subsequently pass its CI and prescribed certification checks, then reach Railway web/operations and Vercel production.

**No shortcuts:** The independent seller pickup, marketplace fulfilment policy, active coverage, driver/vehicle, high-risk cash policy, real payment-provider confirmation, journal idempotency and commercial approvals remain enforced. No new database migration, production row mutation or payment activation flag accompanies this repair.

### Remaining user-visible decisions for an unqualified commercial go-live claim

- **Parcel + marketplace customer payment:** Test an authorized card charge against the configured provider and verify webhook signature, transaction reference, currency, minor-unit amount, one balanced receipt, fulfilment readiness, bank settlement and client invoice. A deployed Paystack variable name or CI pass is not a card receipt.
- **Marketplace checkout:** Onboard genuine verified collection addresses and independently approve store pickup certification, serviceable route and active StoreOrderOperationalPolicy before making a merchant purchasable. Incomplete stores must remain non-purchasable rather than inventing coordinates or overriding fail-closed policy.
- **Driver handover:** Run a genuine, approved driver/vehicle and connected user journey for dispatch acceptance, sender pickup OTP, recipient delivery OTP, private POD, GPS/exception handling, driver earning and the corresponding notification delivery.
- **Financial closure:** Reconcile provider confirmation, wallet debit/split, refund liabilities, dispute and payout authorization, driver COD custody and bank proof against the immutable ledger with maker/checker protections.
- **Additional client requirements:** Complete acceptance of VAT switches, editable pricing/regions, high-risk exclusions, referrals, first-store offer, loyalty/wallet, owner notifications and all nine-document requirements. Do not supply fake business emails, real bank details, merchant verification or owner signoff.

**Launch classification remains NOT_READY until the live acceptance evidence exists.** Code completeness and operator readiness must be reported as distinct states.
