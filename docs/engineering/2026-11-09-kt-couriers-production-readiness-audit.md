# KT Couriers — Current-branch engineering and production-readiness audit

**Audit date:** 2026-11-09 (South Africa/Pakistan date boundary observed)
**Repository:** `analyticsmath/KT-Courier`
**Engineering source:** `engineering/phases-1-2-3-20261108`
**Production baseline:** `main` at `130bc06b508b31075deb004dd59e143e363177a2`
**Release decision:** **NO-GO — do not merge, deploy, activate money movement, or run production migrations based on this audit.**
**Evidence boundary:** GitHub source, CI and configuration readbacks; Vercel/Railway control-plane readbacks; targeted disposable routing tests. No live checkout, actual cash handling, card charge, refund, payout, production DB audit, or complete physical-device user acceptance in this review.

## 1. Binding document precedence and scope

On conflict only, the nine supplied client documents are interpreted in this order:

1. **KT Couriers – Website Developer Brief.docx** (2026-11-02): highest authority.
2. **KT COURIERS — Delivery and Access.docx** and **KT COURIERS — WEBSITE & SYSTEM CHANGES.docx**: prevail over the six remaining documents. Conflicts *between these two* are not arbitrarily resolved; escalate for owner confirmation.
3. **Shipping & Delivery**, **Terms and Conditions**, **About Us**, **Updated Details**, **Privacy Policy**, **Refund & Cancellation**: cumulative requirements unless a higher-priority document specifically supersedes them.

All nine matter. These documents do not themselves override South African mandatory law or grant credentials/authority to conduct live financial tests.

### Conflicts/decisions requiring explicit treatment

| Subject | Prior/lower-source statement | Controlling interpretation or open decision |
| --- | --- | --- |
| Scheduled versus Standard | Updated Details labels a separate “Scheduled” 2–3-day tariff | Delivery and Access separates **Standard as service level** and **Scheduled as future date/window**; no separate scheduled speed/tariff. |
| Standard turnaround | Delivery and Access contains both 2–3 days and an explicit “Please use Standard = 1–2 business days as the final definition”; Shipping policy also states 1–2 days | Use **1–2 business days** as the explicit final definition; have commercial owner confirm published service-level agreement. |
| Economy and Standard prices | Updated Details mixes Standard/Scheduled labels | Configure size-based Economy (R89, R129, R179), Standard (R129, R179, R249), Express distance/size rate; freeze chosen rule version in each accepted quote/order. All edit through admin. |
| Nationwide commerce vs courier coverage | “Stores nationwide” might appear to imply national deliveries | Store/catalog discovery can be nationwide by default; actual KT courier booking/fulfilment remains limited to admin-enabled operational area/service (initially Gauteng/Johannesburg/Pretoria and qualifying surrounding areas). No false province promises. |
| Cash on delivery | Some texts call COD generally supported | Developer Brief high-risk localities **cannot select cash**; Delivery and Access limits COD to admin-approved store/service/area/order and initial 50% online + 50% collected by driver. Record custody, deposits, reconciliation separately. |
| Refund destination | Refund Policy generally returns money to original instrument; Developer Brief's customer journey describes refund to wallet | Highest-priority Brief requests wallet refunds, but **mandatory consumer and payment rules require legal/finance review** before defaulting an externally paid refund to nonwithdrawable store credit. Model original funding allocation and authorized remedy instead of silently forcing wallet. |
| Driver employment classification | Older Terms state all drivers are independent contractors | Brief requires both **freelance and salaried** driver types; contractual and South African employment-law treatment requires legal review before customer-facing terms are published. |
| Company address | Historic materials include street-address artwork | Delivery and Access says **no public walk-in office**; contact via `info@ktcouriers.com` and do not represent a street as public storefront. A proper legal registered address may be required for regulated documentation and must be supplied by owner. |
| Commercial reward rates | Some documents give illustrative points, rank, commission and advertising prices | Superuser-managed, versioned rules; implement reasonable guarded defaults only where expressly authorized. Unconfirmed reward eligibility, marketing packages, geographical scope and fee changes cannot be activated as fact. |

## 2. Platform architecture assessment

Source architecture: Next.js 16 App Router, TypeScript, Prisma/PostgreSQL, Redis, Docker/Railway app, Vercel edge, Paystack active-provider architecture, immutable double-entry ledger with explicit postings, outbox/worker pipelines, role-separated customer, store, driver, superadmin surfaces. The codebase has meaningful modules, Prisma migrations, security suites, and extensive CI — not merely an empty website.

Existing branch work includes:
- Marketplace checkout exact-value payment preparation and pickup certification; store status, active pickup and availability preflight; parcel VAT governance; high-risk cash restrictions.
- Driver vehicle/compliance, dispatch/assignment, COD custody/deposit reconciliation, driver earnings and reviews.
- Customer identity unification, wallet grant ledger, loyalty earn/reverse/redemption, leaderboard and store/customer referral issuance and signup attribution.
- Ordinary referral first-paid-order **read-only eligibility** with Paystack receipt/ledger/webhook verification and anti-refund rules. **It deliberately does not post R5 or make wallet spend functional.**
- Store ownership checks, campaigns/promotions foundation, staff permission and notifications foundation. Existence of code is not acceptance evidence for the complete role journey.

Target invariants for implementation/release:
1. Only server-authoritative quote, area, order, and payment-source decisions; no client-provided price/owner/driver ID may grant authority.
2. Each accepted order stores exact configuration/rate/area/VAT/surcharge version and immutable charge components; later admin edits affect only new orders.
3. Each externally funded payment/refund/payout requires verified provider event, unique idempotency key, balanced ledger journals, replay-safe processor, and recoverable reconciliation.
4. COD is explicit debt/custody/driver remittance, not a fictional externally cleared cash receipt. High-risk area exclusions apply at quote confirmation AND final checkout.
5. Driver OTP/POD and dispatch state changes are race-safe and auditable; sensitive driver identity/GPS/photo accessible only to authorized purpose.
6. Customer/store wallets, points, referral/cashback debt and promotion expense have independent immutable, owner-scoped, capped audit trails.
7. Regulatory catalog categories, licenses, age/ID checking, returns, customer privacy and location permissions are explicitly gated.

## 3. Current control-plane reality (read-only checks, 2026-11-09)

| Component | Verified readback | Not established |
| --- | --- | --- |
| GitHub | Feature initially **47 ahead / 0 behind** `main`, initial head `67a05ca9727c6359514920a0f3e26af3e27a2a93`. Draft PR #37 exists; no merge. | No exact-current-head full live release acceptance. |
| GitHub CI, original source | CI `42534870775`: 10 applicable jobs passed (18 conditional skips); production certification `42534870918`: 24 component jobs passed; final launch-veto failed **by design**. | These runs do not authorize real-money features or an untested successor SHA. |
| Railway production | Project `e9554aaa-1b53-4595-8731-e8c2885ac594`; web from **main**, online; Postgres/Redis online; webhook/workers must be separately verified. The production web pre-deploy command performs schema migration and production initializers. | Production backup, recovery, least-privilege audit, commercial activation or exact-feature-head deployment. |
| Railway staging | Project `9fbe0ad5-4707-4e6a-a00d-af313f62e547`, isolated PostgreSQL/Redis volumes, web online using feature branch; latest **deployed** source `a82568fd8807f7066e7694dcd93d96bd78f15a18`. Later feature pushes show **SKIPPED** deployment. No attached public domain. | Latest branch SHA deployed/certified, identity isolation, role-based browser/financial acceptance, media bucket/provider end-to-end. |
| Railway pending changes | Current environment inventory reports **no staged patch** in either production or staging; this supersedes historical docs claiming a pending destructive patch. | It does not certify `admin-replacement-inspection` offline service safety. |
| Vercel production | Connected project `prj_vlJrGktEcTIOCMZTAj6QTnrZEev2` owns verified `ktcouriers.com`, `www.ktcouriers.com`; production READY at main SHA `130bc06...`. | `KT_EDGE_ROLE` value and real routing/browser auth/provider contract verified in deployed production. |

### Targeted corrections pushed directly to this branch

- `eb3aa2c90df5bc5afd9513e65b2bfb39a56b2eca`: fix `PRODUCTION_EDGE_PROJECT` ID in `lib/deployment/edge-routing.ts` from stale `prj_Q6i3g8JIv1ibkXGspPotBem2FFLD` to the connected, verified domain-owning Vercel `prj_vlJrGktEcTIOCMZTAj6QTnrZEev2`, retaining fixed Railway origin and fail-closed production-role restrictions.
- `de7329e8b03e013284eebb4786f053db505d3031`: regression assertion for verified project identity. The targeted Vitest suite passed **6/6** in a temporary isolated workspace, restoring its original source afterward.
- `f201dc9ef686fb44b6f6ec750b59acf28732b4bf`: fix misleading footer province rollout caption; it now distinguishes Gauteng courier launch and South Africa marketplace.

GitHub commits are not Railway/Vercel production deployments. Staging intentionally skips new branch pushes through a restricted watch pattern. Historical CI receipts apply to their named SHAs only.

## 4. Persona completion and acceptance matrix

| Persona/service | Source groundwork observed | Remaining acceptance or engineering work |
| --- | --- | --- |
| Guest/customer | Public no-login quote route, shared identity, store and parcel ordering, checkout, wallet/loyalty UI, reviews | Anonymous geocoded quote → price hold → account/login → mixed wallet/card/COD → confirmed order → tracking/delivery → cancellation/refund on actual latest SHA and devices. Refund destination requires legal review. |
| Vendor/store | Store onboarding/status/pickup certification, catalog/store orders, employee scopes, promotions, wallet foundation | Inventory/live-store real acceptance, per-store paid checkout, product packaging classification for multi-item baskets, marketing campaign actual publishing, own bookings, nationwide discovery versus delivery eligibility. |
| Driver | Driver profile and compliance, assignment/POD, COD cash and deposit proofs, earnings/withdrawal sources | Physical ID/vehicle/photo verification, genuine GPS/camera/OTP and sign-off, COD deposit reconciliation, salaried/freelance handling, payouts with bank/finance approval, personal data minimization. |
| Superadmin | Finance/security foundations, role guarded endpoints, store/driver controls, customer wallet grants, review/loyalty tools | End-to-end notifications and configurable recipients, real audited reporting, independent review for high-risk areas/discounts/VAT/commissions, least-privilege operational audit. |
| Financial/marketplace platform | Double-entry ZAR ledger, Paystack integration, commission/promotion engines, refund/reconciliation services | Exact full-value external provider certification; end-to-end 50/50 COD; provider dispute/chargeback recovery; refund/funding allocation; **ordinary referral R5 posting and referral wallet spending not implemented**; approval of terms and payouts. |
| Security/operations | Role authorization tests, config gating, multiple CI suites, Railway resources | Security regression and data-retention validation, staged restore and approved production backup/restore, worker readiness, rate-limit and queue recovery, monitoring, rollback and product/finance/legal signoff. |

## 5. Nine outstanding launch gates

Source of record: `docs/production-closure/engineering-gates.json`. It reports **19 implemented / 6 open / 3 validation-blocked**, classification `NOT_READY`; independently reconcile exact-current-head changes before altering counts.

- **OPEN** `marketplace_parcel_classification`: multi-item aggregate packing, dispatch dimensions and approved service limits.
- **OPEN** `notification_required_domains`: reviewed templates/routes, admin event alerts, delivery proof.
- **VALIDATION_BLOCKED** `commercial_financial_certification`: finance/bank/Paystack, fees, refunds, COD, ledger payouts.
- **OPEN** `customer_vendor_driver_full_functional_acceptance`: genuine all-role transactional and physical device tests.
- **OPEN** `visual_acceptance`: responsive, mobile, keyboard/assistive acceptance.
- **OPEN** `media_full_functional_acceptance`: upload, private access, cleanup and real provider lifecycle.
- **OPEN** `critical_skip_closure`: independent skip/defer review and full exact-commit suites.
- **VALIDATION_BLOCKED** `fresh_production_protected_row_audit`: approved, least-privilege read-only DB audit and recoverability.
- **VALIDATION_BLOCKED** `github_certification_and_deployment`: precise SHA bound release, staged evidence, rollout/rollback.

## 6. External competitive reference — capability benchmark only

These industry docs inform *tests and completeness criteria*, not KT's presently activated features:

- [Uber Direct proof of delivery](https://developer.uber.com/docs/deliveries/guides/proof-of-delivery): signature/barcode/photo/ID/PIN pickup/dropoff/return methods. For KT, use service-appropriate verification, private evidence and durable retention.
- [DoorDash Drive quote API](https://developer.doordash.com/en-US/docs/drive/how_to/Parcel/api_quotes_overview/): quote validates serviceability, address correction and itemized fee before committing to delivery. KT's anonymous quote should have the same safety properties, with version snapshots.
- [DoorDash Drive webhooks](https://developer.doordash.com/en-US/docs/drive/reference/webhooks/): event-driven driver/delivery updates. KT needs replay-safe webhook/outbox, delivery-state ownership and customer/merchant notification matrices.
- [Uber Direct tracking](https://developer.uber.com/docs/deliveries/get-started): useful trackable delivery state and participant-appropriate tracking links; do not expose private routes, GPS or customer identity to unrelated accounts.

## 7. Release sequence and hard stop conditions

1. **Engineering closure on the requested branch only.** Fix/refactor remaining role journeys, multi-store packing, payout/source correctness, multi-method wallet checkout, and notification scope; keep money movement behind configuration and superuser policy. Add negative authorization and concurrency tests, publish all code to same branch.
2. **Source-bound CI** after every substantive change: `npm ci`, Prisma generation/migration safety, TypeScript, lint, unit/API/security, disposable PostgreSQL/Redis, full Next production build, browser at 320/390/1440 and explicit nine-case Paystack simulator acceptance. No disabled or silently skipped release-critical tests.
3. **Staging isolation and acceptance** with independent data/storage/queues, safe sandbox payment credentials and documented bounded scenarios; verify deployment SHA and no production data movement. Run every major persona to completion including COD mock, failed/refunded payment, driver POD, stock/substitution, wallet/referral, and admin reconciliation.
4. **Operational/commercial/legal approvals** for final VAT, area tariffs, high-risk cash geography, COD limits/settlement instructions, commissions, offer eligibility, POPIA/CPA, refund instrument, terms for salaried/freelance drivers, regulated goods and exact published policy versions.
5. **Release rehearsals**: reviewed backup with isolated restore and drift diff, least-privilege production audit, migrations forward compatibility, worker resume/queue health, observability alerts, runbook, release window and rollback safety (DB migrations cannot be rolled back simply by Vercel rollback).
6. **Only after all gates pass**, merge PR #37 against rechecked main/head SHAs and promote controlled Railway+Vercel builds; run production smoke with agreed cap and observe financial/dispatch invariants.

**Current decision: NO-GO.** A healthy deployment and thousands of offline tests are not evidence that genuine paid, licensed, compliant courier/marketplace commerce is production-ready. No deployment, main merge or money activation is authorized by this audit.
