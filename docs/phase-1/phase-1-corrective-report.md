# KT Couriers — Phase 1 Corrective Execution Report (`P1-CORR-01` – `P1-CORR-06`)

- **Repository**: `analyticsmath/KT-Courier`
- **Branch**: `main` (sole development branch; no feature branches created)
- **Reviewed Baseline SHA**: `ddabcf42f63cb428e51848c5e2075458b5f10e9d`
- **Execution Date**: `2026-11-10`

---

## 1. Executive Release Classification

| Dimension | Classification | Authority & Evidence |
|---|---|---|
| **Phase 1 Engineering Implementation & Automated Browser/PostgreSQL Verification** | **ENGINEERING ACCEPTED (`CODE_VERIFIED` + `STAGING_VERIFIED`)** | All `P1-CORR-01` through `P1-CORR-06` corrective defects are resolved on `main`. Real Chromium Playwright browser E2E suites (`tests/e2e/vendor-five-product-media.spec.ts`, `tests/e2e/marketplace-checkout-payment.spec.ts`, `tests/e2e/anonymous-courier-quote.spec.ts`, `tests/e2e/driver-canonical-delivery.spec.ts`), real PostgreSQL 16 integration suites (`tests/integration/store-seller-identity.integration.test.ts`, `tests/integration/marketplace-payment.integration.test.ts`, `tests/integration/store-go-live-certification.integration.test.ts`), `npm run docker:migration-smoke`, and `npm run test:coverage` (`1,066` files / `5,335` tests) passed with `0` failures and `0` skips. |
| **Unrestricted Live Real-Money Customer Launch (`Phase 3` Veto Gate)** | **NO-GO (`EXTERNAL_APPROVAL_REQUIRED`)** | [`docs/production-closure/engineering-gates.json`](file:///d:/KT-Courier/docs/production-closure/engineering-gates.json) truthfully remains `NOT_READY` (`19` implemented, `6` open, `3` validation-blocked). `node scripts/check-closure-engineering-gates.mjs` exits `1` by design until authentic owner/legal/financial/operator approvals and live Paystack/Resend production receipts are supplied. |

---

## 2. Corrective Items Implemented & Verified

### 2.1 `P1-CORR-01`: Fix GitHub Browser-Certification Failure (`tests/e2e/vendor-five-product-media.spec.ts`)
- **Root Cause**: In GitHub Actions `Production Certification` run `42764945369` (job `browser` `129659117211`), [`tests/e2e/vendor-five-product-media.spec.ts`](file:///d:/KT-Courier/tests/e2e/vendor-five-product-media.spec.ts) attempted `.fill('SYNTHETIC_OWNER_DETAILS_NOT_REAL_APPROVAL')` on `getByLabel('Supplied evidence reference')`, which is intentionally `<input readonly>` in [`components/store/StoreSellerIdentityForm.tsx`](file:///d:/KT-Courier/components/store/StoreSellerIdentityForm.tsx).
- **Corrective Implementation**:
  1. Preserved `readOnly` on `sourceEvidenceReference` in [`components/store/StoreSellerIdentityForm.tsx`](file:///d:/KT-Courier/components/store/StoreSellerIdentityForm.tsx).
  2. Updated [`tests/e2e/vendor-five-product-media.spec.ts`](file:///d:/KT-Courier/tests/e2e/vendor-five-product-media.spec.ts) (lines 62–135, 175) to:
     - Generate a disposable synthetic PNG via `sharp`.
     - Select the file via `getByLabel('Verification file', { exact: true }).setInputFiles(...)` and click `getByRole('button', { name: 'Upload supporting document', exact: true })`.
     - Await `POST /api/store/seller-identity/documents` and assert `HTTP 201` with `document.publicReference` matching `/^PMO-[0-9a-f-]{36}$/i`.
     - Verify in the disposable PostgreSQL database (`kt_phase75_e2e`) that `PrivateMediaObject` is `READY`, owned by `ownerType: "STORE"` and `ownerId: store.id`, with `purpose: "STORE_VERIFICATION_DOCUMENT"`.
     - Assert `getByLabel('Supplied evidence reference', { exact: true })` has attribute `readonly` and value equal to the uploaded `PMO-<uuid>`, then submit without calling `.fill()` on the read-only input.
     - Verify the created `StoreSellerLegalIdentityProposal` binds that exact `PMO-<uuid>` reference and that an unrelated store (`e2e-other-store@ktcouriers.local`) is denied access (`403`/`404` on `/api/private-media/:ref` and `422` when attempting to submit that `PMO-<uuid>` for its own store).
     - Supply `REVIEWED_${uploadedEvidenceRef}` in the independent admin review step and complete the entire 5-product catalog, media upload, cart packing, Paystack payment, vendor preparation, chat, and driver OTP delivery scenario.
- **Verification**:
  - Executed via `scripts/e2e-test.mjs` against disposable PostgreSQL + Redis + Next.js standalone + Chromium: **`1 passed (2.0m)`**, `0 failed`, `0 skipped`.

### 2.2 `P1-CORR-02`: Close Seller-Evidence Validation Gaps
- **Files Modified**:
  - [`lib/validation/store-seller-identity.ts`](file:///d:/KT-Courier/lib/validation/store-seller-identity.ts)
  - [`lib/services/store-seller-identity.service.ts`](file:///d:/KT-Courier/lib/services/store-seller-identity.service.ts)
  - [`app/api/store/seller-identity/route.ts`](file:///d:/KT-Courier/app/api/store/seller-identity/route.ts)
- **Corrective Implementation**:
  1. Removed `SYNTHETIC_[A-Z0-9_-]{8,96}` from `CANONICAL_SELLER_EVIDENCE_PATTERN`; `SYNTHETIC_*` strings are now rejected unconditionally in all environments.
  2. Restricted `EXISTING_REVIEWED_EVIDENCE` so it is **rejected** for any new applicant (`expectedIdentityReference` required) and permitted in `verifyStoreSellerEvidence()` only when:
     - `options.allowExistingReviewedRenewal === true`,
     - the store already holds an active `APPROVED` `StoreSellerLegalIdentity` whose `identityVersion` matches `expectedIdentityReference`, and
     - a prior `APPROVED` proposal for that store and `identityVersion` exists with an underlying `PMO-...` or `EXT-...` reference that itself passes `verifyStoreSellerEvidence()`.
  3. Added `ExternalSellerEvidenceSchema` and verified `EXT-[A-Za-z0-9][A-Za-z0-9._:-]{5,120}` against `SystemSetting` (`store.seller_identity.external_evidence.<ref>`), requiring `storeId === input.storeId`, `status === "REVIEWED"`, `documentDigest` (32–128 hex), and an active `ADMIN`/`SUPER_ADMIN` `authorizedByUserId` in `prisma.user`.
  4. Enforced `verifyStoreSellerEvidence()` both at seller submission (`submitStoreSellerIdentity()`) and at independent admin approval (`reviewStoreSellerIdentity()` when `decision === "APPROVE"`).
- **Verification**:
  - [`tests/client-platform/store-seller-evidence.test.ts`](file:///d:/KT-Courier/tests/client-platform/store-seller-evidence.test.ts) — `6 passed (6)`
  - [`tests/client-platform/store-seller-identity-api.test.ts`](file:///d:/KT-Courier/tests/client-platform/store-seller-identity-api.test.ts) — `9 passed (9)`
  - [`tests/integration/store-seller-identity.integration.test.ts`](file:///d:/KT-Courier/tests/integration/store-seller-identity.integration.test.ts) — `7 passed (7)` on real PostgreSQL 16.

### 2.3 `P1-CORR-03`: Reconcile Paystack Configuration & Documentation with Code
- **Files Modified**:
  - [`tests/payments/paystack-temporary-production-test.test.ts`](file:///d:/KT-Courier/tests/payments/paystack-temporary-production-test.test.ts)
  - [`docs/phase-1/release-runbook.md`](file:///d:/KT-Courier/docs/phase-1/release-runbook.md)
  - [`docs/phase-1/financial-reconciliation.md`](file:///d:/KT-Courier/docs/phase-1/financial-reconciliation.md)
- **Corrective Implementation**:
  - Documented the exact variables read by [`lib/payments/providers/paystack/paystack-config.ts`](file:///d:/KT-Courier/lib/payments/providers/paystack/paystack-config.ts): `PAYSTACK_MODE` (`test` | `live` | `disabled`), `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_CREDENTIAL_VERSION`, `PAYMENT_APP_ORIGIN`, `CHECKOUT_PUBLIC_ENABLED`, and the temporary production-sandbox override set (`PAYSTACK_TEMPORARY_SANDBOX_MODE`, `PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY`, `PAYSTACK_TEMPORARY_SANDBOX_PUBLIC_KEY`, `PAYSTACK_TEMPORARY_SANDBOX_CREDENTIAL_VERSION`, `PAYSTACK_TEMPORARY_SANDBOX_EXPIRES_AT`, `PAYSTACK_TEMPORARY_SANDBOX_REFERENCE`).
  - Added unit proof in [`tests/payments/paystack-temporary-production-test.test.ts`](file:///d:/KT-Courier/tests/payments/paystack-temporary-production-test.test.ts) (`10 passed (10)`) proving that `PAYSTACK_ALLOW_TEST_IN_PRODUCTION` and `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` are not read by the runtime and cannot unlock Paystack in production.

### 2.4 `P1-CORR-04`: Prove Real Customer Checkout Paths (Parcel + Marketplace + Negative Matrix)
- **Verified in Real Chromium + Disposable PostgreSQL (`kt_phase75_e2e`)**:
  - [`tests/e2e/anonymous-courier-quote.spec.ts`](file:///d:/KT-Courier/tests/e2e/anonymous-courier-quote.spec.ts) (`3 passed`): anonymous Johannesburg/Pretoria parcel quote calculation, tamper rejection (`422`), and anonymous booking refusal (`401`) with sign-in redirect preserving quote reference.
  - [`tests/e2e/marketplace-checkout-payment.spec.ts`](file:///d:/KT-Courier/tests/e2e/marketplace-checkout-payment.spec.ts) (`9 passed`):
    - Authenticated customer marketplace checkout initiation and Paystack `authorization_url` redirect.
    - Signed `charge.success` webhook (`x-paystack-signature` and `kthm1:`) creating `MarketplaceOrder` + `MarketplaceStoreOrder` and `1` balanced `LedgerJournal`.
    - Duplicate webhook + return verification idempotency (`1` `Payment` `PAID`, `1` `LedgerJournal`, `1` order).
    - Forged webhook signature rejection (`400 INVALID_WEBHOOK_SIGNATURE`, zero DB writes).
    - Abandoned/failed payment refusal (order never marked `PAID`, zero false fulfilment, zero revenue ledger journal).
    - Cross-customer BOLA denial (`403`/`404`) and amount mismatch rejection.
  - [`tests/e2e/driver-canonical-delivery.spec.ts`](file:///d:/KT-Courier/tests/e2e/driver-canonical-delivery.spec.ts) (`2 passed`): canonical driver dispatch, pickup, in-transit, POD capture, and atomic OTP completion.
  - [`tests/integration/marketplace-payment.integration.test.ts`](file:///d:/KT-Courier/tests/integration/marketplace-payment.integration.test.ts) (`2 passed` on PostgreSQL): end-to-end marketplace payment + ledger journal atomicity.

### 2.5 `P1-CORR-05`: Store Readiness & Notification Honesty
- **Store Readiness**:
  - Updated [`lib/storefront/store-publication-readiness.ts`](file:///d:/KT-Courier/lib/storefront/store-publication-readiness.ts), [`lib/admin/store-checkout-blockers.ts`](file:///d:/KT-Courier/lib/admin/store-checkout-blockers.ts), and [`lib/services/admin-stores.service.ts`](file:///d:/KT-Courier/lib/services/admin-stores.service.ts) so `isStorePubliclyCheckoutReady()` and `describeStoreCheckoutBlockers()` enforce and report `hasApprovedSellerIdentity` (`"Approved legal seller identity missing or expired"`) and `hasActiveOperationalPolicy` (`"Active store order operational policy missing or expired"`), alongside active store status, published catalog documents, complete `PICKUP` address with South African coordinates, and 2-admin `StoreCheckoutCertification` matching `pickupCertificationFingerprint`.
  - Verified in [`tests/services/store-publication-readiness.test.ts`](file:///d:/KT-Courier/tests/services/store-publication-readiness.test.ts) (`14 passed (14)`).
- **Notification Pipeline vs Live Provider Delivery**:
  - Outbox persistence, recipient validation, multi-recipient admin alert routing, and templates are `CODE_VERIFIED` and `STAGING_VERIFIED` (`34` test files / `176` tests passed).
  - Live external Resend/SMTP domain verification and physical inbox delivery remain classified as `EXTERNAL_APPROVAL_REQUIRED` (`G-22` / `notification_required_domains` in [`docs/production-closure/engineering-gates.json`](file:///d:/KT-Courier/docs/production-closure/engineering-gates.json)).

### 2.6 `P1-CORR-06`: Full Engineering Gate Verification Summary

| Command | Result | Details |
|---|---|---|
| `npx prisma generate` | **PASS** | Prisma Client v5.22.0 generated cleanly |
| `npx prisma validate` | **PASS** | `prisma/schema.prisma` is valid |
| `npm run migrations:check` | **PASS** | 1 baseline + 110 incremental = 111 active migrations, 0 drift |
| `npm run lint` | **PASS** | `0` warnings / `0` errors |
| `npm run typecheck` | **PASS** | `tsc --noEmit` `0` errors |
| `npm run build` | **PASS** | Next.js 16.2.3 production standalone build succeeded |
| `npm run test:coverage` | **PASS** | `1,066` test files passed (`5,335` tests, `0` failed, `0` skipped) |
| `npm run test:paystack:contract` | **PASS** | `24/24` passed |
| `npm run test:paystack:invariants` | **PASS** | `23/23` passed |
| `npm run test:payments` | **PASS** | `65` files / `407` tests passed |
| `npm run test:refunds` | **PASS** | `26` files / `115` tests passed |
| `npm run test:security:bola` | **PASS** | `2` files / `23` tests passed |
| `npm run test:processors` | **PASS** | `9` files / `63` tests passed |
| `node scripts/validate-phase3-evidence.mjs` | **PASS** | Dossier & receipt SHA-256 verification passed (`launch: NO_GO`) |
| `node --test scripts/*.test.mjs` | **PASS** | `65/65` certification, workflow, and zero-skip guard tests passed |
| `npm run docker:migration-smoke` | **PASS** | 111 migrations + 2x idempotent seed + 0 drift on clean PostgreSQL container |
| Playwright Chromium E2E (`vendor-five-product-media`, `marketplace-checkout-payment`, `anonymous-courier-quote`, `driver-canonical-delivery`) | **PASS** | `15/15` browser E2E scenarios + `2/2` PostgreSQL Paystack integration tests passed (`0` failed, `0` skipped) |
| `node scripts/check-closure-engineering-gates.mjs` | **FAIL-CLOSED (`exit 1`)** | `NOT_READY: 9 unresolved of 28 production launch gates` (preserved intact) |
