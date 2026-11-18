# KT Couriers — Courier Payment, Ledger, Automatic Acceptance, 24h Expiry, Scoped COD & Notification Closure Acceptance

**Prepared:** 18 November 2026  
**Repository:** [`analyticsmath/KT-Courier`](https://github.com/analyticsmath/KT-Courier)  
**Branch:** `main`  
**Audited Baseline SHA:** `8657a0249405ea4234207c4eea1a9a9ff708f0c5`  
**Feature Closure SHA:** `f902d3003bfcb988a3abbcfa83485b1b41e0a2eb` *(applied production migrations `20261118000000_order_payment_due_at` and `20261118010000_paystack_verify_payment_evidence`)*  
**Certified Green Code SHA:** `386a347e3ce07268e800796d24daad70fb9520e1`  

> [!NOTE]
> All verification claims below reflect executed tests, migrations, CI/certification runs, and live non-secret endpoint probes directly observed on this codebase. Live database row contents (active `PaymentMethodPolicy` versions, `client_cash_deposit_bank`, configured `ADMIN` / `SUPER_ADMIN` alert email recipients, and secret variable values masked by Railway OAuth permissions) require direct operator/DB inspection and were never fabricated or guessed.

---

## 1. Delivered Closure Scope (`P0-01` through `P0-07`)

| Workstream | Canonical Implementation | Enforced Financial / Operational Invariant |
|---|---|---|
| **P0-01** Central Acceptance & Fulfilment Funding Guard | `lib/orders/order-state-machine.ts` (`OrderTransitionError.reasonCode`), `lib/services/courier-payment-readiness.service.ts` (`CourierPaymentReasonCode`, `isCourierProgressStatus`, `requirePaymentBeforeCourierProgress`, `assertCourierOrderTransitionFundingInTx`), `lib/services/order-status.service.ts` (`Order ... FOR UPDATE` + transition guard), `lib/services/wallet-spending.service.ts`, `lib/services/admin-orders.service.ts`, `app/api/admin/orders/[id]/status/route.ts`, `components/admin/AdminOrderStatusUpdate.tsx`, `app/(admin)/admin/orders/[id]/page.tsx` | Blocks `PENDING -> CONFIRMED` and all downstream fulfilment states (`PICKUP_SCHEDULED..COMPLETED`) for unpaid digital bookings and pre-deposit COD bookings across both normal admins and `allowAdminOverride` / `SUPER_ADMIN`. Discriminates `PAYMENT_PENDING`, `COD_DEPOSIT_PENDING`, `COD_POLICY_NOT_ACTIVE`, `CASH_RISK_RESTRICTED`, `PAYMENT_LEDGER_RECONCILIATION_REQUIRED`, and `UNKNOWN`; renders `[data-testid="payment-acceptance-blocked-banner"]` and `paymentDueAt` deadline in Admin UI. Reorders full-wallet settlement to activate deposit COD *before* courier confirmation. |
| **P0-02** Authoritative Paystack Verify API Recovery & Lag Closure | `prisma/migrations/20261118010000_paystack_verify_payment_evidence/migration.sql`, `lib/services/paystack-verify-recovery.service.ts` (`recoverPaystackAttemptViaVerify`, `recoverPendingPaystackPaymentForPaymentId`), `lib/services/payment-observability.service.ts` (`getPaymentObservabilitySnapshot`), `app/api/payments/paystack/webhook/route.ts` (pure signed `RECEIVED` intake), `app/api/payments/[publicReference]/route.ts`, `app/api/payments/[publicReference]/checkout-session/route.ts`, `lib/services/paystack-webhook-application.service.ts`, `lib/processors/processor-service.ts` | Keeps `POST /api/payments/paystack/webhook` as strict HMAC-verified `"RECEIVED"` outbox intake (preserving concurrent safety and worker separation), while return/status polls and retry-session creation immediately trigger `recoverPendingPaystackPaymentForPaymentId` (replaying any queued signed webhook first, else verifying exact ZAR/reference/status directly via Paystack Verify API without forging `signatureVerified: true`). Enforced at PostgreSQL constraint and trigger level (`Payment_success_evidence_coherence_check`, `Payment_succeeded_requires_provider_evidence_check`, `validate_payment_success_evidence()`, `protect_payment_identity_and_success()`). Prevents double checkout sessions once paid at Paystack (`PAYMENT_ORDER_ALREADY_PAID`), handles late post-cancellation refunds via reconciliation/coordinator, and backfills signed webhook linkage once when delivered later. |
| **P0-03** Additive 24-Hour Unpaid Deadline & Durable Expiry Processor | `prisma/schema.prisma` (`Order.paymentDueAt`, `@@index([status, paymentDueAt])`), `prisma/migrations/20261118000000_order_payment_due_at/migration.sql`, `lib/dto/order.dto.ts`, `lib/services/orders.service.ts`, `lib/services/parcel-unpaid-expiry.service.ts` (`expireUnpaidCourierOrdersBatch`, `UNPAID_PARCEL_EXPIRY_ELIGIBLE_WHERE`), `lib/processors/processor-registry.ts`, `lib/processors/production-loop.ts`, `lib/processors/processor-service.ts`, `scripts/production-processors.ts` | Newly created unpaid `PENDING` direct parcel orders persist `paymentDueAt = createdAt + 24h` (`FULL_COD` confirmed bookings and historic `paymentDueAt: null` rows remain untouched). Registered leased worker `expire-unpaid-courier-orders` (supporting `DRY_RUN` and `APPLY`, bringing `productionProcessors` to 27 scheduled + 3 delegated = 30) composes payment-aware cancellation, releases reserved wallet funds and uncollected COD obligations, revokes pending dispatch offers, and queues customer + admin cancellation alerts. |
| **P0-04** Scoped Store-Less Personal-Parcel 50/50 `DEPOSIT_PLUS_COD` | `lib/client-platform/payment-configuration.service.ts`, `lib/payments/payment-policy.service.ts`, `components/forms/PaymentPolicyConfiguration.tsx` | Enables store-less `PARCEL_DOCUMENT` 50/50 `DEPOSIT_PLUS_COD` policies with explicit delivery service + province/region scope, independent maker/checker approval (`approvePaymentConfiguration`), genuine bank remittance verification, and high-risk locality cash exclusion, while continuing to reject unscoped or non-50% store-less cash drafts. |
| **P0-05 / P0-06 / P0-07** Split Customer Lifecycle Notifications, 24-Event Admin/Superadmin Alerts & Backlog UI | `lib/notifications/required-domain-definitions.ts`, `lib/notifications/required-domain-payload.ts`, `lib/notifications/event-registry.ts`, `lib/services/notification-events.service.ts`, `lib/services/courier-order-confirmation.service.ts`, `lib/settings/admin-alert-recipient-policy.ts`, `lib/notifications/admin-alert-dispatch.service.ts`, `lib/client-platform/driver-cash.service.ts`, `app/api/admin/notifications/admin-alerts/route.ts`, `app/api/admin/notifications/admin-alerts/retry/route.ts`, `components/admin/AdminAlertsConsole.tsx`, `app/(admin)/admin/notifications/alerts/page.tsx`, `components/protected-v2/notification-admin/NotificationAdministrationPage.tsx`, `components/protected-v2/customer/CustomerPresentation.tsx`, `app/(admin)/admin/processors/page.tsx`, `artifacts/route-action-authorization-inventory.json` | Replaces premature confirmation notices on unpaid digital/`DEPOSIT_PLUS_COD` bookings with explicit `COURIER_BOOKING_PENDING_PAYMENT`, reserving `COURIER_PAYMENT_CONFIRMED` and `COURIER_ACCEPTED` for ledger-verified payment/deposit (or approved `FULL_COD` booking), plus `COURIER_PAYMENT_FAILED` and `COURIER_UNPAID_CANCELLED`. Expands `ADMIN_ALERT_EVENT_TYPES` to 24 configurable events with per-event verified `ALL` / `ADMIN` / `SUPER_ADMIN` recipient scoping, `/admin/notifications/alerts` management & retry console (`791` authorized route inventory entries), COD remittance reconciliation/discrepancy alerts, customer `paymentDueAt` banner, and `/admin/processors` backlog telemetry. |

---

## 2. Certified Remote CI, Engineering Certification & Deployment Parity (`386a347e3ce07268e800796d24daad70fb9520e1`)

- **GitHub Actions `CI` (`success`):** https://github.com/analyticsmath/KT-Courier/actions/runs/44260673171 (`10` executed jobs passed: `quality`, `container-build`, `docker-runtime`, `migration-smoke`, `pricing-integration`, `dispatch-integration`, `cross-module-integration`, `ledger-integration`, `Phase 1 Release-Critical Verification`, `Phase 1 PostgreSQL Webhook Concurrency Integration`; `18` path/compatibility-gated jobs skipped by workflow conditions).
- **GitHub Actions `Engineering Certification` (`success` — `26/26` jobs passed):** https://github.com/analyticsmath/KT-Courier/actions/runs/44260673013
  - `quality`: https://github.com/analyticsmath/KT-Courier/actions/runs/44260673013/job/134652962672
  - `browser` *(all 7 Playwright E2E stages incl. `courier-payment-acceptance-alerts.spec.ts`, `marketplace-checkout-payment.spec.ts`, bounded capacity & full Chromium)*: https://github.com/analyticsmath/KT-Courier/actions/runs/44260673013/job/134652962388
  - `recovery`: https://github.com/analyticsmath/KT-Courier/actions/runs/44260673013/job/134652962762
  - `redis-and-recovery` (`redis-rate-limit` & `bola-authority`): https://github.com/analyticsmath/KT-Courier/actions/runs/44260673013/job/134652962764
  - All `20/20` `postgres` integration matrix jobs (`auth`, `permissions`, `orders`, `pricing`, `dispatch`, `cross-module`, `driver-operations`, `ledger`, `payment-foundation`, `refunds`, `withdrawals`, `store-earnings`, `driver-earnings`, `marketplace-checkout`, `store-orders`, `storefront`, `catalog`, `closure`, `docker:migration-smoke`, `docker:gate4`): **ALL PASSED**
  - `Phase 2 automated engineering verification` (`134677569919`) & `Release authorization status` (`134677663623`): **PASSED**
- **Commit Deployment Statuses & Production Probes on `386a347e3ce07268e800796d24daad70fb9520e1`:**
  - **Vercel (`success`):** https://vercel.com/muzammilhasaandev1-7633/kt-courier/8Rt1Fu1NoUJPmt2mA93ENsqVgLXs  
    - `GET https://www.ktcouriers.com/api/health` -> `200` (`{"status":"ok","service":"kt-couriers",...}`)
    - `GET https://www.ktcouriers.com/api/ready` -> `200` (`{"status":"ready","database":"reachable","redis":{"configured":true,"connected":true,"status":"HEALTHY"}}`)
  - **Railway `web` (`SUCCESS` / Online):** deployment `e4a5ca2d-549c-4e2e-af74-646ebe9e647a` (`128` migrations clean — `20261118000000_order_payment_due_at` & `20261118010000_paystack_verify_payment_evidence` previously applied on live Railway Postgres by `f902d300` deployment `8d384216-966a-4a07-8321-aefb4c683e59`; `GET https://web-production-9f8bb.up.railway.app/api/health` -> `200`, `/api/ready` -> `200`)
  - **Railway `operations` (`SUCCESS` / Online):** deployment `5e898453-a9f9-4dfb-9e38-fa74596b7c7b` (healthcheck `/health` succeeded)
  - **Railway `query-storefront-categories` (`SUCCESS` / Online):** deployment `f33c8b8f-3237-4524-bc30-b676466ff567`

---

## 3. Local Verification Ledger Executed Before Final Code Push (`386a347e3ce07268e800796d24daad70fb9520e1`)

| Suite / Gate | Command | Observed Result |
|---|---|---|
| Schema & Migration Chain Safety | `npx prisma validate` & `npm run migrations:check` | **Passed** (`127` incremental + `20260710010000` baseline + `8` archived = `128` active deployable migrations) |
| TypeScript & Route Types | `npm run typecheck` | **0 errors** |
| ESLint | `npm run lint` | **0 errors** (`2` pre-existing warnings) |
| Unit & Component Tests | `npx vitest run --maxWorkers=2` | **1,155 files / 5,772 tests passed, 0 failed, 0 skipped** |
| Production Next.js Build | `npm run build` | **Passed** (`next build` standalone output + route manifests clean) |
| Full Disposable PG Closure Matrix | `npm run test:integration:closure:host` | **57 files / 312 tests passed, 0 failed, 0 skipped** (`HOST_CLOSURE_PASSED`, incl. `tests/integration/courier-payment-cod-expiry-closure.integration.test.ts`) |
| Isolated PG Matrix Suites | `test:integration:dispatch`, `cross-module`, `driver-operations`, `ledger`, `bola-authority` | **Passed** (`dispatch` 2/8, `cross-module` 1/1, `driver-operations` 2/2, `ledger` 6/26 + `verify-ledger-invariants`, `bola-authority` 10/10) |
| Historical Upgrade & Disaster Recovery | `npm run test:integration:migration-upgrade` & `npm run recovery:drill` | **Passed** (`128` migrations upgraded cleanly; `dumpRestore: PASS`, `historicalUpgrade: PASS`, `ledgerInvariants: PASS`) |
| Chromium Playwright UI Spec | Host Next server + disposable `kt_phase75_e2e` DB & Redis (`tests/e2e/courier-payment-acceptance-alerts.spec.ts`) | **Passed** (`1/1` in headless Chromium locally + full 7-stage Chromium matrix green in GitHub Actions `134652962388`) |

---

## 4. Production Environment Telemetry & Operator Boundary Notes

- Railway production environment (`2226be2a-86f7-4590-a7b4-72aa54dccf52`) shows all runtime services online (`web`, `operations`, `query-storefront-categories`, `Postgres`, `Redis`) and `admin-replacement-inspection` offline.
- Connected Railway MCP exposes environment variable **names only** (`87` on `web`, `34` on `operations`), confirming `PAYSTACK_MODE`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_TEMPORARY_SANDBOX_ENABLED`, `PAYSTACK_TEMPORARY_SANDBOX_UNTIL`, `PAYMENT_APP_ORIGIN`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `CHECKOUT_PUBLIC_ENABLED`, and `NOTIFICATION_PRODUCTION_VALIDATION_APPROVED` are defined without disclosing plaintext values.
- **No unverified claims:** No live real-money payment, KYC document, bank proof, or reviewer approval was manufactured, and public checkout/payout activation remains governed strictly by existing release/policy controls.
