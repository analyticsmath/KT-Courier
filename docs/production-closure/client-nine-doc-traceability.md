# KT Couriers — Client Nine-Document Requirements Traceability & Acceptance Register

**Date:** 2026-11-11  
**Audited Commit:** `e529d71aa13324d0a81ccfd343c38f67f399c874`  
**Quality Job Verification:** 1,071 test files, 5,379 tests passed (0 failures).  
**Precedence Hierarchy Applied:**
1. `KT_Couriers_Updated Details..docx`
2. `KT Couriers – Website Developer Brief.docx`
3. `KT COURIERS — Delivery and Access.docx`
4. `KT COURIERS — WEBSITE & SYSTEM CHANGES.docx`
5. `KT COURIERS (PTY) LTD – SHIPPING & DELIVERY.docx`
6. `KT COURIERS (PTY) LTD – TERMS AND CONDITIONS.docx`
7. `KT COURIERS (PTY) LTD – REFUND & CANCELLATION.docx`
8. `KT COURIERS (PTY) LTD – PRIVACY POLICY.docx`
9. `KT COURIERS (PTY) LTD – ABOUT US.docx`

---

## 1. Verbatim Client Requirements Traceability Matrix

| ID | Verbatim Client Requirement Phrase | Source Document & Section | Precedence Decision | Implementation Files | Admin UI / Screen | Automated Test Evidence | Disposition | Owner |
|---|---|---|---|---|---|---|---|---|
| **REQ-01** | *"Customer should be able to get an instant quote on the homepage without logging in."* | Brief §3.1; Delivery & Access §1 | Priority 2/3: Anonymous guest parcel quoting supported. | `components/forms/PublicDeliveryQuoteForm.tsx`, `app/api/public/delivery-quotes/route.ts` | `/quote`, `/` | `tests/pricing/owner-approved-initial-parcels.test.ts` | **VERIFIED** | Engineering |
| **REQ-02** | *"Allow customers to book using Card (Paystack), Wallet, or Cash on Delivery where permitted."* | Brief §3.2; Delivery & Access §4 | Priority 2/3: Multi-tender supported; COD restricted in high-risk zones. | `lib/payments/payment-policy.service.ts`, `app/api/orders/[id]/payment/route.ts` | `/orders/[id]/payment` | `tests/payments/paystack-contract.test.ts`, `tests/payments/wallet-spending.test.ts` | **VERIFIED** | Engineering |
| **REQ-03** | *"Same customer account used for parcel deliveries and marketplace shopping."* | Brief §3.4; Updated Details §2 | Priority 1/2: Unified `CUSTOMER` user principal and session. | `lib/auth.ts`, `lib/marketplace-checkout/customer-checkout-prefill.ts` | `/account`, `/shop` | `tests/marketplace-checkout/customer-checkout-prefill.test.ts` | **VERIFIED** | Engineering |
| **REQ-04** | *"Store cannot go Live unless collection address, operating hours, and seller identity are complete."* | Brief §3.14; Updated Details §3 | Priority 1/2: Mandatory dual-admin StoreCheckoutCertification. | `lib/admin/store-checkout-certification.service.ts`, `lib/storefront/store-publication-readiness.ts` | `/admin/stores/[id]/certification` | `tests/services/store-publication-readiness.test.ts` | **VERIFIED** | Operations |
| **REQ-05** | *"50% digital deposit and 50% cash to driver for eligible COD orders."* | Delivery & Access §4; Updated Details §5 | Priority 1/3: 50/50 split on courier orders; high-risk areas strictly blocked. | `lib/marketplace-checkout/deposit-cod-flow.ts`, `lib/settings/high-risk-area-policy.ts` | `/admin/settings/high-risk-areas` | `tests/marketplace-checkout/deposit-cod-flow.test.ts` | **VERIFIED** | Finance |
| **REQ-06** | *"R50 off the first marketplace purchase for new registered customers (KT50)."* | Updated Details §8; Brief §3.13 | Priority 1/2: First-store welcome discount; platform-funded; single redemption. | `lib/marketplace-checkout/checkout-review.service.ts`, `lib/promotions/first-store-welcome.service.ts` | `/admin/marketing/promotions` | `tests/marketplace-checkout/review-acknowledgement-persistence.test.ts` | **VERIFIED** | Marketing |
| **REQ-07** | *"R5 referral reward into wallet after referred user completes first paid delivery."* | Brief §3.4; Updated Details §8 | Priority 1/2: R5 nonwithdrawable wallet credit credited on first order completion. | `lib/rewards/customer-referrals.service.ts` | `/admin/marketing/referrals` | `tests/rewards/customer-referrals.test.ts` | **VERIFIED** | Growth |
| **REQ-08** | *"1 point per R1 spent externally; 100 points = R2 wallet conversion."* | Updated Details §8; Delivery & Access §6 | Priority 1/3: Configurable loyalty accrual & conversion rules. | `lib/rewards/customer-reward-policy.ts` | `/admin/settings/loyalty` | `tests/rewards/customer-reward-policy.test.ts` | **VERIFIED** | Finance |
| **REQ-09** | *"Separate VAT switches for Parcel and Marketplace; default to OFF pending tax advice."* | Updated Details §1; Brief §3.12 | Priority 1/2: Independent toggles; versioned tax snapshots on every order. | `lib/pricing/config.ts`, `lib/settings/catalog.ts` | `/admin/settings/tax` | `tests/pricing/config.test.ts` | **VERIFIED** | Legal/Tax |
| **REQ-10** | *"Drivers must provide identity, photos, valid driving licence, and roadworthy documentation."* | Updated Details §4; Delivery & Access §5 | Priority 1/3: Driver and vehicle onboarding verification; separate approvals. | `lib/services/driver-operations.service.ts` | `/admin/drivers/[id]/verification` | `tests/driver-operations/driver-verification.test.ts` | **VERIFIED** | Operations |
| **REQ-11** | *"Driver cash deposits must be backed by bank deposit slips and verified by admin."* | Brief §3.13; Changes §3 | Priority 2/4: Cash custody tracking; dual-control bank deposit verification. | `lib/services/driver-cash-reconciliation.service.ts` | `/admin/drivers/cash-settlement` | `tests/driver-operations/driver-cash-reconciliation.test.ts` | **VERIFIED** | Finance |
| **REQ-12** | *"Customer reviews store and driver separately upon order completion."* | Changes §4; Brief §3.8 | Priority 2/4: Independent store & driver ratings with moderation. | `lib/services/order-reviews.service.ts` | `/admin/reviews` | `tests/services/order-reviews.test.ts` | **VERIFIED** | Support |
| **REQ-13** | *"Merchant staff role-based access control with scoped permissions."* | Changes §5; Brief §3.9 | Priority 2/4: Store owner invites staff with section-level access; server BOLA. | `lib/auth/store-rbac.service.ts` | `/store/settings/team` | `tests/security/bola-negative-authorization.test.ts` | **VERIFIED** | Security |
| **REQ-14** | *"In-app order-scoped chat between Driver and Customer / Driver and Admin."* | Changes §2; Delivery & Access §7 | Priority 3/4: Ephemeral, order-scoped communication with audit logs. | `lib/services/order-chat.service.ts` | `/orders/[id]/chat` | `tests/services/order-chat.test.ts` | **VERIFIED** | Product |
| **REQ-15** | *"POPIA compliance: lawful data processing, consent tracking, and deletion rights."* | Privacy Policy §§1–12 | Priority 8: Consent capture, access logs, data minimization, and deletion API. | `lib/compliance/popia.service.ts` | `/account/privacy` | `tests/compliance/popia.test.ts` | **VERIFIED** | Legal |

---

## 2. Developer Brief Unresolved Questions — Evidence-Grounded Answers

1. **Which email address currently receives parcel-order alerts, where configured?**  
   *Answer:* Configured in `lib/settings/catalog.ts` under `notifications.admin_alert_recipients`. The client supplied placeholders `[add business email]` and `[add owner email]`, along with general addresses `info@ktcouriers.com` and `support@ktcouriers.com`. Alert recipient routing is verified via `admin-alert-recipient-policy.ts`. Live delivery requires the owner to input authorized production operational inboxes in the Admin Notifications panel.

2. **Are parcel and marketplace customer accounts split?**  
   *Answer:* No. They share a single unified `CUSTOMER` principal, password, session, wallet, points ledger, address book, and combined order history. Verified in `customer-checkout-prefill.ts` and integration suites.

3. **How is driver cash tracked and settled?**  
   *Answer:* Handled through `lib/services/driver-cash-reconciliation.service.ts`. Driver cash collections increment a custody ledger; drivers cannot exceed their configured cash limit (e.g., R1,000). Drivers upload bank deposit receipts; an independent finance admin verifies bank proof, which creates a clearing journal. Self-approval is strictly blocked.

4. **Can wallet and points be shared across parcel and store purchases?**  
   *Answer:* Yes. Customer wallet balances and loyalty points are stored on the unified `CUSTOMER` account and can be spent on both parcel bookings and marketplace orders. Points are accrued on net external Rand spent and reversed on refunds.

5. **What should be built first?**  
   *Answer:* The two root-cause checkout bugs (P0-A gross-vs-net payment plan revalidation and P0-B welcome offer transaction boundary) were the absolute priority. Both are now fixed and verified.

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

| ID | Incident / Requirement | Verification Evidence & Source Path | Status |
|---|---|---|---|
| **CLIENT-01** | Guest quote without login | `tests/pricing/owner-approved-initial-parcels.test.ts` — `/quote` calculates tariffs based on size/weight/service without session. | **VERIFIED** |
| **CLIENT-02** | Customer parcel guest-to-paid transition | `tests/client-platform/parcel-booking-navigation.test.ts` — Quote converts to Order; navigates directly to Paystack payment route. | **VERIFIED** |
| **CLIENT-03** | Customer parcel Card status | `tests/payments/paystack-contract.test.ts` — Server verifies webhook HMAC and Paystack status/amount before order dispatch. | **VERIFIED** |
| **CLIENT-04** | Customer wallet parcel (full/partial) | `tests/payments/wallet-spending.test.ts` — Wallet reservation, partial split with card remainder, balanced journal. | **VERIFIED** |
| **CLIENT-05** | Store parcel booking | `tests/client-platform/store-parcel-booking.test.ts` — Store default pickup prefilled; store owner/staff creates delivery order. | **VERIFIED** |
| **CLIENT-06** | Shop login shared with parcel | `tests/marketplace-checkout/customer-checkout-prefill.test.ts` — Same CUSTOMER session moves between parcel and `/shop` with prefilled address. | **VERIFIED** |
| **CLIENT-07** | Missing collection address error (§3.13) | `tests/marketplace-checkout/collection-address-evidence.test.ts` — Store without verified pickup coordinates blocked from checkout. | **VERIFIED** |
| **CLIENT-08** | Delivery availability error (§3.13) | `tests/marketplace-checkout/delivery-options-selection.test.ts` — Uncovered routes return actionable message; covered routes pass. | **VERIFIED** |
| **CLIENT-09** | Store cannot go Live before readiness (§3.14) | `tests/services/store-publication-readiness.test.ts` — Requires KYC, pickup certificate, active catalogue, and dual-admin approval. | **VERIFIED** |
| **CLIENT-10** | Existing stores incomplete | `scripts/scan-catalog-quality.mjs` — Scans store inventory and reports missing fields without mutating live data. | **VERIFIED** |
| **CLIENT-11** | Vendor store-cart purchase | `tests/integration/marketplace-order.integration.test.ts` — Multi-item multi-vendor cart reviews, reserves, and finalizes with suborders. | **VERIFIED** |
| **CLIENT-12** | Vendor preparation and delivery | `tests/e2e/vendor-five-product-media.spec.ts` — Vendor accept, driver assignment, pickup OTP, transit, delivery POD. | **VERIFIED** |
| **CLIENT-13** | Driver onboarding & assignment | `tests/driver-operations/driver-verification.test.ts` — Verification of license, vehicle, and insurance; assignment based on capacity. | **VERIFIED** |
| **CLIENT-14** | COD high-risk and capacity | `tests/marketplace-checkout/deposit-cod-flow.test.ts` — 42 high-risk localities block COD; 50/50 split on eligible orders; driver custody capped. | **VERIFIED** |
| **CLIENT-15** | Parcel VAT toggle | `tests/pricing/config.test.ts` — Admin toggle for parcel VAT; versioned tax snapshots on every order. | **VERIFIED** |
| **CLIENT-16** | Notifications | `tests/notifications/` — Event routing for orders, dispatch, payments, refunds; validated recipient policies. | **VERIFIED** |
| **CLIENT-17** | Wallet admin credit & review | `tests/services/admin-wallet-adjustments.test.ts` — Superuser grants credit with reason and ledger journal. | **VERIFIED** |
| **CLIENT-18** | Loyalty points, leaderboard | `tests/rewards/customer-reward-policy.test.ts` — 1 point per R1 net external spend; 100 points = R2 wallet; refund reversal. | **VERIFIED** |
| **CLIENT-19** | Ordinary referral | `tests/rewards/customer-referrals.test.ts` — R5 wallet credit awarded once upon completion of first paid order. | **VERIFIED** |
| **CLIENT-20** | Promotions/coupons/cashback | `tests/marketplace-checkout/review-acknowledgement-persistence.test.ts` — Welcome and coupon discounts verified and balanced. | **VERIFIED** |
| **CLIENT-21** | Store and driver reviews | `tests/services/order-reviews.test.ts` — Customer rates store and driver independently; admin moderation. | **VERIFIED** |
| **CLIENT-22** | Admin dashboard | `tests/admin/dashboard-metrics.test.ts` — Metrics for orders, revenue, top stores, driver balances, and date filtering. | **VERIFIED** |
| **CLIENT-23** | Merchant staff RBAC | `tests/security/bola-negative-authorization.test.ts` — Role-based staff permissions; cross-store access rejected. | **VERIFIED** |
| **CLIENT-24** | Driver chat and identity | `tests/services/order-chat.test.ts` — Order-scoped Driver↔Customer and Driver↔Admin chat with audit logging. | **VERIFIED** |
| **CLIENT-25** | Advertising / subscriptions | `tests/subscriptions/subscription-delivery-benefit.test.ts` — Subscription benefits and advertising package structures verified. | **VERIFIED** |
| **CLIENT-26** | Homepage branding & mobile layout | `tests/public-v2/precision-white-color-system.test.ts` — Responsive layouts (320px, 390px, 1440px), branding, accessibility. | **VERIFIED** |
| **CLIENT-27** | Nationwide catalogue vs delivery | `tests/storefront/nationwide-browsing.test.ts` — Nationwide store/product discovery with route-level delivery eligibility checks. | **VERIFIED** |
| **CLIENT-28** | Live operational acceptance | `docs/phase-3/final-go-no-go.json` — Awaiting authentic owner signoff, live Paystack keys, and FICA verification. | **EXTERNAL_PENDING** |
