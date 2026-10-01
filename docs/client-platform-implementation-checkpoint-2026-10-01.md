# Client platform audit and implementation checkpoint — 2026-10-01

Status: IN PROGRESS. This document is a recovery checkpoint, not production-readiness approval.

## Scope and design authority

Both supplied documents were read in full: “KT COURIERS — Delivery and Access(3).docx” and “KT COURIERS — WEBSITE & SYSTEM CHANGES(3).docx”. The requested branch `feat/client-platform-requirements` initially pointed to the same commit as main (`4a3fa49996cf40c19608efd9a178468c3341ab3d`). No extra implementation had been committed to that branch.

The accepted hero van is preserved. No requested category-color scheme or arbitrary changes to shape, rounding, or visual direction were applied. Existing public and protected components remain the design foundation.

## Recovery status (latest, 2026-10-01)

The earlier uncommitted checkout was lost when the execution workspace reset. The feature table below records that earlier work; it is **historical and does not establish that the implementation currently exists**.

Rebuilt and remotely committed: anonymous public quotes, versioned Economy/Standard service tariffs, inactive Express draft, quote-to-booking flows, public quote navigation and initial configuration script (commit ec6b924).

Rebuilt in the current checkout: database foundations, verified-email employee invitations and custom grants, owner-only team administration, module checks at all existing business HTTP handlers and pages, scoped catalog/order/finance/marketing/settings integration, online-only contact copy, and strict TypeScript build settings. No owner identity substitution is used. New tables remain additive; no historical migrations were modified.

Validation at this checkpoint: 65 focused tests passed (quotes, employee authorization and invitations, delegated permissions, existing security foundations). The previous full TypeScript run passed before final UI and formatting edits; it is being rerun. Production deployment and the new migration have **not** been applied.

Rebuilt next: persistent separate delivery/support conversations, current-assignment driver checks, per-message idempotency, bounded history pagination, completed-delivery reviews and business replies, private profile images, browser-session image access, metadata-stripping raster normalization, marketing artwork upload and safe sharing, and quote/invitation continuation through login/signup/email verification. Actual stream size is checked before multipart parsing. Business courier cancellation retains the employee's real role and identity. The affected suite now passes 150 tests; the latest full TypeScript and lint checks pass.

Still to rebuild/finish: driver deposit workflow, scoped COD admin configuration, expense export, promotion drafts and full activation, superuser oversight, launch blockers, integration verification and deployment. No claim of customer readiness is made.

## Historical local implementation (lost checkout)

The following records the earlier lost checkout. Consult the recovery status above for the implementation that currently exists:

| Capability | Implementation and authority |
|---|---|
| Public quotes | `/quote`, anonymous cookie-owned quotes, real geocoding and Google route distance, province/region eligibility, size/weight/service inputs, immutable server prices, expiry and signed-in booking |
| Delivery tariffs | Versioned admin configuration; Economy S/M/L R89/R129/R179 (3–4 days); Standard R129/R179/R249 (final explicit 1–2-day wording); Express R5.50/km held inactive until parcel fees are supplied |
| Booking | Sender/recipient contact details, future collection time without changing the selected tariff, repeat delivery prefill and customer/business quote ownership |
| Business employees | Expiring invitations tied to verified email, Operations/Marketing/Finance/Customer-service presets, individual module grants, disable/reactivate/remove, no owner impersonation, immediate access checks |
| Employee integration | Business-scoped catalog, orders, finance, marketing and settings access; actual employee identity retained; explicit permission DENY remains effective |
| Chat | Persistent separate support and delivery threads, participant authorization, reassignment revokes prior-driver access, idempotent messages and bounded history pagination |
| Profiles and reviews | Private uploaded avatar images; completed-delivery customer reviews and authorized business replies |
| Driver cash | Actual collection obligations and all-time custody totals; full collected-amount deposits; stored bank references; admin confirmation through the canonical cash reconciliation ledger |
| COD configuration | Approved-business eligibility, service/province/region/order scope, configurable deposit split and maximum cash; context matching; overlapping equally specific policies fail closed |
| Expenses | Business-scoped real delivery, commission, subscription and managed-marketing expense records; dates, descriptions, references, status, totals and formula-safe CSV |
| Promotions | Persisted draft coupons and automatic campaigns, dates, percentages/fixed amounts, caps/minimum spend, usage limits, catalog targets, proposed budgets, revisions and submission for review |
| Marketing artwork | Private image upload for campaign/banner requests; marketing staff share business images; verification documents excluded from creative entitlement |
| Superuser support | Reason-required, time-limited business oversight view, real acting identity, audited access and owner-visible history |
| Public contact | Online-only service and info@ktcouriers.com; public quote calls to action |
| Engineering | Additive Prisma migration, database constraints, route inventory, Next 16 type corrections, strict build type checking restored |

Main new service directory: `lib/client-platform/`. Main migration: `prisma/migrations/20261001000000_client_platform_requirements/migration.sql`. Initializer: `scripts/initialize-client-delivery.ts`.

Draft coupon authoring is NOT live discount redemption. Campaign artwork upload is NOT production sponsored-banner activation. Cash receipt submission does NOT clear custody balances before bank confirmation.

## Verification evidence and interruption

- First targeted run: **68 tests passed across six files** (quotes, access/payment policy, chat/cash, existing permission tests, cash reconciliation and proxy security).
- Whole implementation run before final corrections: **2,882 passed, 41 failed across 696 test files**.
- Unchanged baseline comparison: **2,849 passed, 30 failed across 693 test files**, plus an existing syntax error in the payment-session test file. Existing failures include old visual source expectations, checkout/source gates, missing local database access and processor runtime assumptions.
- Added route inventory entries and intentionally changed source contracts were corrected after comparison. Final regression rerun remains pending.
- TypeScript passed before the last settings/media integration edits. A production build compiled successfully, then caught a nullable store-owner reference in the new profile integration. That reference was corrected; the final build remains pending.
- An isolated PostgreSQL/PGlite upgrade proof was prepared in `scripts/verification/client-platform-migration.mjs`. It applies the previous Prisma schema and the additive migration, then tests checks, foreign keys and retry/uniqueness invariants. Setup needed pg_trgm and a fixture delivery enum correction. No completed passing proof is claimed.
- No browser screenshot testing was performed, consistent with the user's preference.
- During final verification, the workspace execution service disconnected and remained unresponsive. The last attempted commands could not be confirmed. This checkpoint is saved through the repository connector so the findings survive that interruption.

## Deployment status

**No implementation commit, push, PR merge, production database migration or application deployment has been completed.** Production still serves the previous version. This checkpoint commit contains documentation only.

The deployed route is Vercel → Railway, with the production database on Railway. Actual service pre-deploy configuration includes migration and existing demo/showcase seed commands; it must be preserved when adding the idempotent client-delivery initializer. Do not apply unrelated previously staged Railway environment changes.

A server-only `PROMOTION_CODE_HMAC_KEY` of at least 32 characters is needed for draft coupon codes; it was absent from the inspected production variable names. No key was set during this work.

## Unresolved launch dependencies

1. Express parcel-size fees and the exact marketplace R90–R170 size/distance/risk formula were not supplied. Do not invent these tariffs or activate Express with a zero parcel fee.
2. Live marketplace checkout currently requires approved merchant legal identities and commission policies. Fictional demonstration merchants cannot supply those approvals.
3. Existing production coupon evaluation/redemption services include stubs. The production promotion validation lock remains false. Closing this requires real eligibility, funding/reservation, redemption, reversal and concurrency validation.
4. Advertising, subscription, reporting, earnings-release and withdrawal production gates remain separate unfinished validation work. They must not be silently switched on.
5. Driver provider-wallet linkage, payment/funding support and provider-side accounts require an actual provider capability/contract. Never invent provider credentials, external account support or bank receipts.
6. Final migration/build/regression checks and deployed authenticated workflow verification remain outstanding. The current evidence does not justify “100% customer-ready.”

## Resume order

1. Recover the working checkout at `/workspace/scratch/e02b155a769f/KT-Courier` and inspect the uncommitted implementation; fetch this documentation checkpoint.
2. Finish the pending migration proof and targeted regressions; add settings/media authorization and reconciliation retry coverage.
3. Run strict type checking, lint, migration safety and the full production build. Compare full-suite failures with the baseline rather than weakening existing financial guards.
4. Review remaining usability gaps (saved-address selection, older chat history preservation, promotion detail routes, deposit review states).
5. Commit/push the implementation, create the reviewable PR, deploy only verified changes, preserve existing Railway configuration, initialize tariffs once and verify real deployed quote/access behavior.
6. Continue the live financial feature work and obtain the missing business configuration before declaring customer readiness.
