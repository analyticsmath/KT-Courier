# KT Couriers — Client Nine-Document Requirements Traceability & Acceptance Register

**Audited Baseline Commit:** `046684e86dcb997184253a51b8b84241d6d9b246` (Phase 3 commit, 2026-11-11 02:16 UTC)  
**Engineering Release Status:** CERTIFICATION_CLOSEOUT_PENDING (Canonical 41-case suite and leaf financial assertions verified locally)  
**Commercial Launch Decision:** COMMERCIAL_LAUNCH_NO_GO (Strictly retained pending authentic owner, legal, and operational signoff)  

**Precedence Hierarchy Applied:**
1. `KT_Couriers_Updated Details..docx` (Latest explicit operational instructions)
2. `KT Couriers – Website Developer Brief.docx` (Revenue-critical blocking checkout specifications §§3.13–3.14)
3. `KT COURIERS — Delivery and Access.docx` (Pricing, speed levels, 50/50 COD, commission rules)
4. `KT COURIERS — WEBSITE & SYSTEM CHANGES.docx` (Public quoting, RBAC, employee roles, driver cash)
5. `KT COURIERS (PTY) LTD – SHIPPING & DELIVERY.docx` (Service boundaries, fulfillment timelines)
6. `KT COURIERS (PTY) LTD – TERMS AND CONDITIONS.docx` (Contractual relationships, liabilities)
7. `KT COURIERS (PTY) LTD – REFUND & CANCELLATION.docx` (Courier vs marketplace refund triggers)
8. `KT COURIERS (PTY) LTD – PRIVACY POLICY.docx` (POPIA statutory roles, data retention)
9. `KT COURIERS (PTY) LTD – ABOUT US.docx` (Aspirational brand vision vs operational reality)

---

## 1. Verbatim Client Requirements Traceability Matrix (REQ-01 to REQ-15)

All implementation and test paths are audited against the real repository tree on SHA `32b09d6a6076cf6a417a59dad535d39d65415bd6`.

| ID | Verbatim Client Requirement Phrase | Source Document & Section | Precedence Decision | Implementation Files | Admin UI / Screen | Automated Test Evidence | Acceptance Status | Owner |
|---|---|---|---|---|---|---|---|---|
| **REQ-01** | *"Customer should be able to get an instant quote on the homepage without logging in."* | Brief §3.1; Delivery & Access §1 | Priority 2/3: Anonymous guest parcel quoting supported. | `components/forms/PublicDeliveryQuoteForm.tsx`, `app/(public)/quote/page.tsx`, `lib/pricing/calculator.ts`, `app/api/public/delivery-quotes/route.ts` | `/quote`, `/` | `tests/pricing/owner-approved-initial-parcels.test.ts` | **UNIT_VERIFIED** | Engineering |
| **REQ-02** | *"Allow customers to book using Card (Paystack), Wallet, or Cash on Delivery where permitted."* | Brief §3.2; Delivery & Access §4 | Priority 2/3: Multi-tender supported; COD restricted in high-risk zones. | `lib/payments/payment-policy.service.ts`, `app/api/orders/[id]/payment/route.ts` | `/orders/[id]/payment` | `tests/payments/paystack-contract.test.ts`, `tests/payments/wallet-spending.test.ts` | **UNIT_VERIFIED** | Engineering |
| **REQ-03** | *"Same customer account used for parcel deliveries and marketplace shopping."* | Brief §3.4; Updated Details §2 | Priority 1/2: Unified `CUSTOMER` user principal and session. | `lib/auth/session.ts`, `lib/auth/guards.ts`, `lib/marketplace-checkout/customer-checkout-prefill.ts` | `/account`, `/shop` | `tests/marketplace-checkout/customer-checkout-prefill.test.ts` | **UNIT_VERIFIED** | Engineering |
| **REQ-04** | *"Store cannot go Live unless collection address, operating hours, and seller identity are complete."* | Brief §3.14; Updated Details §3 | Priority 1/2: Mandatory dual-admin StoreCheckoutCertification. | `lib/admin/store-checkout-certification.service.ts`, `lib/storefront/store-publication-readiness.ts` | `/admin/stores/[id]/certification` | `tests/services/store-publication-readiness.test.ts` | **UNIT_VERIFIED** | Operations |
| **REQ-05** | *"50% digital deposit and 50% cash to driver for eligible COD orders."* | Delivery & Access §4; Updated Details §5 | Priority 1/3: 50/50 split on courier orders; high-risk areas strictly blocked. | `lib/marketplace-checkout/payment-plan.ts`, `lib/settings/high-risk-area-policy.ts` | `/admin/settings/high-risk-areas` | `tests/marketplace-checkout/deposit-cod-flow.test.ts` | **UNIT_VERIFIED** | Finance |
| **REQ-06** | *"R50 off the first marketplace purchase for new registered customers (KT50)."* | Updated Details §8; Brief §3.13 | Priority 1/2: First-store welcome discount; platform-funded; single redemption. | `lib/marketplace-checkout/checkout-review.service.ts`, `lib/promotions/first-store-welcome.service.ts`, `lib/promotions/production-lock.ts` | `/admin/marketing/promotions` | `tests/marketplace-checkout/review-acknowledgement-persistence.test.ts`, `tests/integration/marketplace-promotional-order-canonical-postgres.integration.test.ts` | **DISPOSABLE_PG_VERIFIED** | Marketing |
| **REQ-07** | *"R5 referral reward into wallet after referred user completes first paid delivery."* | Brief §3.4; Updated Details §8 | Priority 1/2: R5 nonwithdrawable wallet credit credited on first order completion. | `lib/rewards/ordinary-referral-award.service.ts`, `lib/rewards/ordinary-referral-eligibility.service.ts`, `lib/rewards/ordinary-referral.service.ts` | `/admin/marketing/referrals` | `tests/rewards/ordinary-referral-award.test.ts`, `tests/rewards/ordinary-referral.test.ts`, `tests/integration/ordinary-referral-signup.integration.test.ts` | **DISPOSABLE_PG_VERIFIED** | Growth |
| **REQ-08** | *"1 point per R1 spent externally; 100 points = R2 wallet conversion."* | Updated Details §8; Delivery & Access §6 | Priority 1/3: Configurable loyalty accrual & conversion rules. | `lib/rewards/customer-reward-policy.ts`, `lib/rewards/customer-parcel-loyalty.service.ts` | `/admin/settings/loyalty` | `tests/rewards/customer-reward-policy.test.ts`, `tests/rewards/customer-loyalty-batch.test.ts` | **UNIT_VERIFIED** | Finance |
| **REQ-09** | *"Separate VAT switches for Parcel and Marketplace; default to OFF pending tax advice."* | Updated Details §1; Brief §3.12 | Priority 1/2: Independent toggles; versioned tax snapshots on every order. | `lib/pricing/config.ts`, `lib/settings/catalog.ts` | `/admin/settings/tax` | `tests/pricing/config.test.ts` | **UNIT_VERIFIED** | Legal/Tax |
| **REQ-10** | *"Drivers must provide identity, photos, valid driving licence, and roadworthy documentation."* | Updated Details §4; Delivery & Access §5 | Priority 1/3: Driver and vehicle onboarding verification; separate approvals. | `lib/driver-operations/authority.ts`, `lib/services/admin-drivers.service.ts`, `lib/driver-operations/operation-policy.ts` | `/admin/drivers/[id]/verification` | `tests/integration/driver-operations-lifecycle.integration.test.ts`, `tests/driver-compliance/admin-driver-document-review.test.ts` | **DISPOSABLE_PG_VERIFIED** | Operations |
| **REQ-11** | *"Driver cash deposits must be backed by bank deposit slips and verified by admin."* | Brief §3.13; Changes §3 | Priority 2/4: Cash custody tracking; dual-control bank deposit verification. | `lib/driver-operations/custody-policy.ts`, `lib/client-platform/driver-cash.service.ts`, `lib/services/driver-cash-capacity.service.ts` | `/admin/drivers/cash-settlement` | `tests/integration/driver-cash-proof-limit.integration.test.ts`, `tests/client-platform/admin-cash-review-queue.test.ts` | **DISPOSABLE_PG_VERIFIED** | Finance |
| **REQ-12** | *"Customer reviews store and driver separately upon order completion."* | Changes §4; Brief §3.8 | Priority 2/4: Independent store & driver ratings with moderation. | `lib/client-platform/reviews.service.ts`, `lib/client-platform/driver-reviews.service.ts`, `lib/notifications/customer-order-review.ts` | `/admin/driver-reviews`, `/store/reviews` | `tests/client-platform/reviews.test.ts`, `tests/integration/driver-customer-reviews.integration.test.ts` | **DISPOSABLE_PG_VERIFIED** | Support |
| **REQ-13** | *"Merchant staff role-based access control with scoped permissions."* | Changes §5; Brief §3.9 | Priority 2/4: Store owner invites staff with section-level access; server BOLA. | `lib/auth/permissions.ts`, `lib/auth/permission-keys.ts`, `lib/client-platform/store-permissions.ts`, `lib/services/admin-permissions.service.ts` | `/store/settings/team` | `tests/security/bola-negative-authorization.test.ts`, `tests/security/bola-object-authorization.test.ts` | **UNIT_VERIFIED** | Security |
| **REQ-14** | *"In-app order-scoped chat between Driver and Customer / Driver and Admin."* | Changes §2; Delivery & Access §7 | Priority 3/4: Ephemeral, order-scoped communication with audit logs. | `lib/client-platform/conversations.service.ts`, `components/forms/Conversations.tsx`, `app/api/platform/conversations/route.ts` | `/orders/[id]/chat`, `/store/chat`, `/driver/messages` | `tests/client-platform/conversations.test.ts` | **UNIT_VERIFIED** | Product |
| **REQ-15** | *"POPIA compliance: lawful data processing, consent tracking, and deletion rights."* | Privacy Policy §§1–12 | Priority 8: Consent capture, access logs, data minimization, and deletion API. | `lib/services/privacy-requests.service.ts`, `lib/privacy/preference.service.ts`, `lib/retention/privacy-retention.service.ts` | `/account/privacy`, `/admin/privacy-requests` | `tests/phase-b/privacy-dsar-retention-postgres.test.ts`, `tests/phase-b/privacy-policy-final-postgres.test.ts`, `tests/phase-b/privacy-location-security-postgres.test.ts` | **DISPOSABLE_PG_VERIFIED** | Legal |

---

## 2. Developer Brief Unresolved Questions — Evidence-Grounded Answers

1. **Which email address currently receives parcel-order alerts, where configured?**  
   *Answer:* Configured in `lib/settings/catalog.ts` under `notifications.admin_alert_recipients`. The client supplied placeholders `[add business email]` and `[add owner email]`, along with general addresses `info@ktcouriers.com` and `support@ktcouriers.com`. Alert recipient routing is verified via `lib/notifications/admin-alert-recipient-policy.ts`. Live delivery requires the owner to input authorized production operational inboxes in the Admin Notifications panel.

2. **Are parcel and marketplace customer accounts split?**  
   *Answer:* No. They share a single unified `CUSTOMER` principal, password, session, wallet, points ledger, address book, and combined order history. Verified in `lib/marketplace-checkout/customer-checkout-prefill.ts` and integration suites.

3. **How is driver cash tracked and settled?**  
   *Answer:* Handled through `lib/driver-operations/custody-policy.ts` and `lib/client-platform/driver-cash.service.ts`. Driver cash collections increment a custody ledger; drivers cannot exceed their configured cash limit (e.g., R1,000). Drivers upload bank deposit receipts; an independent finance admin verifies bank proof, which creates a clearing journal. Self-approval is strictly blocked. Verified in `tests/integration/driver-cash-proof-limit.integration.test.ts`.

4. **Can wallet and points be shared across parcel and store purchases?**  
   *Answer:* Yes. Customer wallet balances and loyalty points are stored on the unified `CUSTOMER` account and can be spent on both parcel bookings and marketplace orders. Points are accrued on net external Rand spent and reversed on refunds.

5. **What should be built first?**  
   *Answer:* The two root-cause checkout bugs (P0-A gross-vs-net payment plan revalidation and P0-B welcome offer transaction boundary) were the absolute priority. Both are fixed and verified.

6. **How can the owner test safely before launch?**  
   *Answer:* Utilizing disposable PostgreSQL and Redis test runners with Paystack in Sandbox/Test Mode. Isolated staging on Railway should be provisioned with test credentials before any real money is processed.

7. **How many stores exist, and how many have incomplete collection addresses?**  
   *Answer:* In the local development baseline, demo seed stores have complete addresses. In production, `/shop` currently renders "No featured storefronts currently available" because existing production store records have not completed `StoreCheckoutCertification`. A read-only count query on production will identify exact missing fields without mutating live data.

8. **Were stores created without pickup data or is checkout failing to read it?**  
   *Answer:* Both occurred historically. Legacy stores were created via onboarding without geocoded map coordinates, and earlier checkout queries lacked proper relation joins. Both the persistence schema and pickup reading logic have been resolved.

9. **How does the delivery availability check work, and why does it fail?**  
   *Answer:* It validates store pickup location, customer destination, geocoded distance, active delivery matrices, and service coverage boundaries. It fails safely (`NOT_SERVICEABLE`) when coordinates are missing, routes exceed distance caps, or regional policies are inactive.

10. **Can missing store details be bulk corrected?**  
    *Answer:* Only if verified owner-approved address data exists. Fabricating coordinates or bulk-assigning unverified addresses is strictly prohibited. Admin batch import with dry-run audit is available for verified merchant manifests.

11. **Can a store owner complete missing details?**  
    *Answer:* Yes. Store owners can log in to `/store/settings/pickup`, update address details, and select map coordinates. Doing so generates a new `StoreCheckoutCertification` candidate requiring independent admin approval.

12. **Points per R and conversion?**  
    *Answer:* 1 point per R1 eligible net externally paid (excl VAT and wallet spending). 100 points convert to R2 wallet credit. Prospectively adjustable in Admin Settings.

13. **What is a successful referral?**  
    *Answer:* The first completed, verified, paid delivery by a newly registered customer who signed up with a valid referral code. R5 wallet credit is granted once per referred user.

14. **May customers withdraw wallet funds to a bank?**  
    *Answer:* No. Customer wallet balances are nonwithdrawable store credits. Payouts are restricted to verified Store, Driver, and Promoter earnings with dual-control admin review.

15. **Does VAT apply to courier fees or marketplace goods?**  
    *Answer:* The platform supports independent toggles for parcel VAT and marketplace VAT. While the client requested toggles set to OFF initially, South African VAT compliance requires formal tax practitioner clearance before live transactions.

16. **What causes both client-reported checkout error messages?**  
    *Answer:*  
    - Error 1 ("collection address incomplete"): Store lacks street, suburb, postcode, or confirmed map coordinates in `StoreAddress`.  
    - Error 2 ("delivery availability must be confirmed"): Route pair not covered, pricing quote expired, or the gross-vs-net payment plan revalidation mismatch (P0-A, now resolved).

17. **Who can change rewards, VAT, wallet, payout, store status?**  
    *Answer:* Restricted to authenticated Superusers with audit logging recording who, when, and why. Store staff have scoped RBAC; finance employees cannot approve their own payouts.

18. **What client question remains genuinely unanswered?**  
    *Answer:* Operational launch parameters: verified production notification inboxes, final approved delivery boundary polygon coordinates, genuine driver/store inventory onboarding, physical registered tax street address, and authorized owner signoff for live trading.

---

## 3. Client Acceptance Verification Register (CLIENT-01 to CLIENT-28)

| ID | Incident / Requirement | Verification Evidence & Real Repository Path | Acceptance Status |
|---|---|---|---|
| **CLIENT-01** | Guest quote without login | `tests/pricing/owner-approved-initial-parcels.test.ts` — `/quote` calculates tariffs based on size/weight/service without session. | **UNIT_VERIFIED** |
| **CLIENT-02** | Customer parcel guest-to-paid transition | `tests/client-platform/parcel-booking-navigation.test.ts` — Quote converts to Order; navigates directly to Paystack payment route. | **UNIT_VERIFIED** |
| **CLIENT-03** | Customer parcel Card status | `tests/payments/paystack-contract.test.ts` — Server verifies webhook HMAC and Paystack status/amount before order dispatch. | **UNIT_VERIFIED** |
| **CLIENT-04** | Customer wallet parcel (full/partial) | `tests/payments/wallet-spending.test.ts` — Wallet reservation, partial split with card remainder, balanced journal. | **UNIT_VERIFIED** |
| **CLIENT-05** | Store parcel booking | `tests/e2e/trusted-parcel-classification.spec.ts`, `scripts/phase3-parcel-control.ts` — Store default pickup prefilled; store owner/staff creates delivery order. | **BROWSER_VERIFIED** |
| **CLIENT-06** | Shop login shared with parcel | `tests/marketplace-checkout/customer-checkout-prefill.test.ts` — Same CUSTOMER session moves between parcel and `/shop` with prefilled address. | **UNIT_VERIFIED** |
| **CLIENT-07** | Missing collection address error (§3.13) | `tests/marketplace-checkout/collection-address-evidence.test.ts` — Store without verified pickup coordinates blocked from checkout. | **UNIT_VERIFIED** |
| **CLIENT-08** | Delivery availability error (§3.13) | `tests/marketplace-checkout/delivery-options-selection.test.ts` — Uncovered routes return actionable message; covered routes pass. | **UNIT_VERIFIED** |
| **CLIENT-09** | Store cannot go Live before readiness (§3.14) | `tests/services/store-publication-readiness.test.ts` — Requires KYC, pickup certificate, active catalogue, and dual-admin approval. | **UNIT_VERIFIED** |
| **CLIENT-10** | Existing stores incomplete | `scripts/scan-catalog-quality.mjs` — Scans store inventory and reports missing fields without mutating live data. | **SOURCE_PRESENT** |
| **CLIENT-11** | Vendor store-cart purchase | `tests/integration/marketplace-order.integration.test.ts` — Multi-item multi-vendor cart reviews, reserves, and finalizes with suborders. | **DISPOSABLE_PG_VERIFIED** |
| **CLIENT-12** | Vendor preparation and delivery | `tests/e2e/vendor-five-product-media.spec.ts` — Vendor accept, driver assignment, pickup OTP, transit, delivery POD. | **BROWSER_VERIFIED** |
| **CLIENT-13** | Driver onboarding & assignment | `tests/integration/driver-operations-lifecycle.integration.test.ts`, `tests/driver-compliance/admin-driver-document-review.test.ts` — Verification of license, vehicle, and insurance; assignment based on capacity. | **DISPOSABLE_PG_VERIFIED** |
| **CLIENT-14** | COD high-risk and capacity | `tests/marketplace-checkout/deposit-cod-flow.test.ts` — 42 high-risk localities block COD; 50/50 split on eligible orders; driver custody capped. | **UNIT_VERIFIED** |
| **CLIENT-15** | Parcel VAT toggle | `tests/pricing/config.test.ts` — Admin toggle for parcel VAT; versioned tax snapshots on every order. | **UNIT_VERIFIED** |
| **CLIENT-16** | Notifications | `tests/integration/required-domain-notifications.integration.test.ts`, `tests/integration/customer-order-notifications.integration.test.ts` — Event routing for orders, dispatch, payments, refunds. | **DISPOSABLE_PG_VERIFIED** |
| **CLIENT-17** | Wallet admin credit & review | `app/api/admin/users/[id]/wallet-credit/route.ts`, `tests/payments/wallet-spending.test.ts`, `tests/e2e/customer-wallet-refunds.spec.ts` — Superuser grants credit with reason and ledger journal. | **BROWSER_VERIFIED** |
| **CLIENT-18** | Loyalty points, leaderboard | `tests/rewards/customer-reward-policy.test.ts`, `tests/rewards/customer-loyalty-batch.test.ts` — 1 point per R1 net external spend; 100 points = R2 wallet; refund reversal. | **UNIT_VERIFIED** |
| **CLIENT-19** | Ordinary referral | `tests/rewards/ordinary-referral-award.test.ts`, `tests/rewards/ordinary-referral.test.ts`, `tests/integration/ordinary-referral-signup.integration.test.ts` — R5 wallet credit awarded once upon completion of first paid order. | **DISPOSABLE_PG_VERIFIED** |
| **CLIENT-20** | Promotions/coupons/cashback | `tests/marketplace-checkout/review-acknowledgement-persistence.test.ts`, `tests/integration/marketplace-promotional-order-canonical-postgres.integration.test.ts` — Welcome and coupon discounts verified and balanced. | **DISPOSABLE_PG_VERIFIED** |
| **CLIENT-21** | Store and driver reviews | `tests/client-platform/reviews.test.ts`, `tests/integration/driver-customer-reviews.integration.test.ts` — Customer rates store and driver independently; admin moderation. | **DISPOSABLE_PG_VERIFIED** |
| **CLIENT-22** | Admin dashboard | `lib/dashboard-insights/`, `tests/e2e/store-order-admin.spec.ts` — Metrics for orders, revenue, top stores, driver balances, and date filtering. | **BROWSER_VERIFIED** |
| **CLIENT-23** | Merchant staff RBAC | `tests/security/bola-negative-authorization.test.ts`, `tests/security/bola-object-authorization.test.ts` — Role-based staff permissions; cross-store access rejected. | **UNIT_VERIFIED** |
| **CLIENT-24** | Driver chat and identity | `lib/client-platform/conversations.service.ts`, `tests/client-platform/conversations.test.ts` — Order-scoped Driver↔Customer and Driver↔Admin chat with audit logging. | **UNIT_VERIFIED** |
| **CLIENT-25** | Advertising / subscriptions | `lib/subscriptions/subscription-review.service.ts`, `tests/services/subscription-review.service.test.ts`, `tests/subscriptions/subscription-lifecycle-source-audit.test.ts`, `tests/integration/subscription-contract.integration.test.ts` — Subscription benefits and advertising package structures verified. | **UNIT_VERIFIED** |
| **CLIENT-26** | Homepage branding & mobile layout | `tests/public-v2/precision-white-color-system.test.ts`, `tests/e2e/store-order-accessibility.spec.ts` — Responsive layouts (320px, 390px, 1440px), branding, accessibility. | **BROWSER_VERIFIED** |
| **CLIENT-27** | Nationwide catalogue vs delivery | `lib/storefront/store-publication-readiness.ts`, `tests/integration/owner-approved-gauteng-coverage.integration.test.ts` — Nationwide store/product discovery with route-level delivery eligibility checks. | **DISPOSABLE_PG_VERIFIED** |
| **CLIENT-28** | Live operational acceptance | `docs/phase-3/final-go-no-go.json` — Awaiting authentic owner signoff, live Paystack keys, and FICA verification. | **EXTERNAL_PENDING** |
