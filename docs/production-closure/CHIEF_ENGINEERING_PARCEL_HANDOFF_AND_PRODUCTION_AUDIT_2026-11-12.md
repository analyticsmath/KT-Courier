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
