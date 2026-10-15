# KT Couriers delivery and marketplace launch review — 15 October 2026

## Authority and scope

Start branch: `codex/complete-delivery-workflows`, existing pull request #30. The eight client Word documents were read from the supplied originals. `WEBSITE & SYSTEM CHANGES` and `Delivery and Access` override the other six only where they conflict. The About Us, Updated Details, Terms and Conditions, Privacy Policy, Refund & Cancellation and Shipping & Delivery documents otherwise remain applicable.

Specific precedence decisions: Standard uses the expressly designated final **1–2 business days** definition; Scheduled is a future date/window layered over a service, not another tariff. Guest quotations do not require accounts. Store/product visibility is independent of operational courier coverage. Provinces and services are enabled separately. Business contact email is not a physical walk-in office. The initial 50/50 COD split is configurable and restricted to eligible scope. Draft commission examples do not constitute approval of final production percentages.

## Workflow and operator map

The table describes source implementation and its operational dependencies. A route or passing synthetic test does not certify an actual payment, genuine document review or physical delivery.

| Requirement | Source implementation / operator entry | Launch dependency or boundary |
| --- | --- | --- |
| Delivery van and consistent public brand | Public v3 homepage actors and brand assets; homepage media regression tests | Visual/browser acceptance remains required on release |
| Guest quote, parcel size/weight, verified route, selected service | `PublicDeliveryQuoteForm`, client-platform delivery service, parcel configuration, Maps providers | Active parcel/service definitions, operational region boundaries, working Maps keys |
| Booking, future collection/window, own order history, saved addresses | `DeliveryRequestForm`, order services, `/account/request-delivery`, `/account/orders`, `/account/addresses` | Authenticated account; accepted quote and payment gates |
| Per-customer/store negotiated delivery pricing | `/admin/pricing`, `PersonalizedRatesManager`, personalized-rate API and quote application | Active identified account, explicit tariff scope, dates and reason |
| Service prices, per-km tariffs, size limits and region/service activation | `/admin/delivery-configuration`, `/admin/parcel-profiles`, `/admin/regions`, `/admin/marketplace-delivery-policy` | Real approved operational coverage; no permanent Gauteng-only restriction |
| Driver identity, licence, profile photo and complete vehicle evidence | `/driver/onboarding`, `/driver/profile`, `/admin/drivers`, `/admin/vehicles`; private document access and separate reviews | Actual valid submitted documents and independent vehicle approval |
| Dispatch, offers, acceptance and availability | `/admin/dispatch`, driver workbench/assignments/availability; dispatch eligibility and concurrency invariants | Approved active driver, compliant vehicle, service region and capacity |
| Pickup, private evidence, actual GPS, delivery attempts, OTP and POD | Driver assignment APIs, delivery-recipient/OTP/proof authorities, location evidence and courier tracking map | Consented real device location and a physical pickup/delivery; no fabricated acceptance |
| Marketplace customer tracking | Owner/guest-secret scoped tracking API and `/order-confirmation/[reference]` | Coarse location during active custody only; no location after completion; provider required for map |
| Vendor registration/approval and catalog publication | Store signup/profile, `/store/catalog`, `/admin/stores`, catalog media/product/offer review | Business approval, seller identity, commission, stock, safe media and independent publication |
| Variants, prices, inventory and images | Structured variant controls, per-variant commercial fields, normalized upload, listing-draft transaction | Each custom variant has its own SKU/price/stock; no implicit Default offer |
| Cart, checkout, inventory reservation and verified payment | Marketplace review/payment/finalization repositories; payment outbox consumer and reservation expiry processor | Payment provider/webhook verification, immutable accepted quote and available inventory |
| Merchant acceptance, preparation, handoff and courier bridge | `/store/orders`, store-order actions and canonical courier-order bridge | Active store-order policy; merchant acceptance creates bridge, dispatch remains eligible-driver controlled |
| Initial partial online payment plus cash | Versioned payment policies, frozen marketplace payment plan, COD courier bridge | Initially **single-store courier checkout without promotion discount**. Multi-store/pickup/discounted cash baskets are refused before provider charge; full digital checkout is separate |
| Cash collection/deposit/reconciliation | `/driver/cash`, `/admin/cash-deposits`, cash custody and bank-remittance journals | Actual collected cash, genuine deposit evidence and authorized finance confirmation; collection is not bank receipt |
| Driver and store earnings, held and available balances | Canonical accrual/release services, owner earnings/wallet/withdrawals, finance reports | Exact funding, completed assignment/POD, effective commission rules, reviewed clearance, no open disqualifying incident |
| Configurable earning hold periods | `/admin/earning-clearance-policy`, independent review service and clearance batch | No approved policy leaves new earnings held. Existing assigned eligibility dates are preserved |
| Automatic completed-delivery earning progression | `process-earning-lifecycle` registered production processor | Newly connected in this review; bounded source-only commands and independent persisted cursors, no external payout |
| Refunds and cancellations | Customer request/claim flows, store financial adjustments, refund finance review and provider reconciliation | COD cancellation refunds actual digital receipt and cancels uncollected cash; later cash adjustments require finance review |
| Customer avatar, profile, notifications, reviews, chat and wallet | Account profile/avatar lifecycle, reviews/support/wallet, notification inbox and preferences | Provider configuration and published recipient/template/route governance for external notifications |
| Driver/customer and driver/admin communication | Driver messages and scoped order/support conversations | Participant ownership and relevant delivery context; private history retained |
| Store plan, wallet, reviews, chat and expense export | Store subscription, earnings/withdrawals, reviews, chat and expenses pages | Actual plan and commercial approval; canonical finance data and date filters |
| Coupons, campaigns, banners and advertising | Store promotions/advertising; admin promotion/advertising and managed-marketing lifecycle | Authored prices, budgets, dates, placement and independent review. External ad-network publishing requires actual provider integration/operation |
| Granular business employee access | Store employees, membership/permission services, store employee browser acceptance | Owner-scoped module permissions, disable/reactivate and explicit-deny enforcement |
| Superuser support access and audit | Admin business-support access, store support-history, permissions and activity | Identified privileged actor, bounded support session and audit trail |
| Promoter/KT50 rank and commission configuration | Promoter programmes/referrals/qualification/earnings; admin programme versions and commission rules | Genuine final approved commercial schedule and activation; illustrative values are not permanent rules |
| Legal pages, company identity, privacy requests and retention | Admin company/legal configuration, public policies, privacy-request and retention authorities | Client-supplied legal identity/registered address where needed; legal review of supplied policy conflicts is separate from software verification |

## Gaps repaired during this review

1. Production Certification run 38761368588 failed in catalog browser acceptance because `store-product-catalog.spec.ts` still filled the removed JSON `Variant matrix`. The test now uses the current structured controls, asserts the exact Blue variant and its own commercial data, and retains lost-response replay, duplicate submission, authorization and cross-store refusal checks. Another job in that run stopped during Prisma installation with `ECONNRESET`; that is dependency-network failure, not evidence of a passing ledger test.
2. `produceDriverSettlement` and `assignEarningClearance` existed but had no application/worker caller. The new earning lifecycle processor connects completed-delivery accrual, reviewed hold assignment and canonical internal release. It does not accept caller-supplied amounts/drivers or execute external payouts. Domain refusals remain held work and appear as safe reason codes. Infrastructure failures remain retry/health failures. Dry run does not write or advance cursors. Independent bounded cursors prevent a blocked early row from starving later deliveries; a crash safely replays canonical operations.
3. Added permission-filtered admin navigation for delivery service/tariff configuration, vehicle approval, commission plans and earning-clearance policy. Existing payment/store-order policy entries are retained without duplicates.
4. The manual processor API previously checked only `processors.read`, ignoring the selected processor's domain execution permission and internal-only flag. It now enforces both, including for dry run, and refuses alternate singleton partitions. Negative API coverage proves monitoring-only, anonymous, denied, internal-only and cross-origin callers cannot execute; authorized domain operators retain their own actor identity. This closes a financial/operational authorization gap discovered during the final review.

## Verification and release gates

Initial local full suite: **4,121 tests across 849 files passed** before the earning-worker connection. Focused worker/navigation/clearance checks were then run. The new PostgreSQL acceptance exercises dry run, automatic real-service accrual/clearance/release, exact R90.22 payable from R100.25 gross with 10% reviewed deduction, replay and unfunded-source refusal in an isolated synthetic database. Its result must be observed in CI; adding the test is not evidence that it passed.

Required merge evidence: exact-head CI and Production Certification, including isolated PostgreSQL, complete browser selection, lint, generated Next route types, build, security and financial tests. Do not skip or narrow a failed required selection to obtain a green badge. Deployment parity must be checked after merge for Vercel, Railway web and operations worker.

## Outstanding production acceptance

Issue #27 remains the launch acceptance record. At review start, Vercel production and Railway web/operations reported successful deployments from `main`; PR #30 was not yet deployed. The prior production audit in the issue reported 25 driver profiles and zero dispatch-ready drivers. This review has not treated that historical count as a fresh database audit.

Launch still needs genuine driver/vehicle and vendor approvals; a physical dispatch/pickup/GPS/OTP/POD journey; scoped final commission/COD/remittance and store-order settings; approved notification templates, recipient policies and event routes; bounded real payment/refund/settlement/payout evidence; and actual backup/restore evidence. Synthetic fixtures cannot replace these.

Railway has an unrelated pending deletion patch `9a3370a3-8d07-4ef9-9e8d-a57ff488fccb` for `admin-replacement-inspection`. It was inspected and not applied. Normal Git-triggered deploys must not be replaced by committing this unrelated staged deletion.

Software merge/deployment and full live commercial acceptance are distinct. Do not close issue #27 or describe the project as 100% launched until its real acceptance conditions are met.
