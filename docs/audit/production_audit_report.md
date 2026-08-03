# KT Couriers Platform - Independent Production Audit Report

**Date:** 2026-08-02  
**Audit Agent:** Principal Software Architect, Application-Security Engineer & Systems Auditor  
**Audit Scope:** Full KT Couriers Platform Codebase  
**Audit Mode:** Strictly Read-Only  

---

## 1. Executive Summary

An independent, evidence-based code audit was conducted on the **KT Couriers** platform codebase (`kt-courier`). The repository is a Next.js 16 App Router monolith with a PostgreSQL database managed via Prisma ORM (v5.22.0), featuring a dual TypeScript client/server setup, Docker containerization, custom double-entry financial ledgering, server-authoritative marketplace checkout, and transactional dispatch logic.

### Key Audit Findings & Metrics
* **Unverified Owner Estimate:** 80–85%
* **Evidenced Feature Completion:** **82.0%**
* **Evidenced Production Readiness:** **77.0%**
* **Final Verdict:** **Feature-rich but not production ready**

### Major Platform Strengths
1. **Financial Integrity & Double-Entry Ledger:** Phase 9 introduced an append-only, double-entry ZAR ledger (`lib/ledger/*`) with strict transaction boundaries, debit/credit invariant validation, and OCC account projection updates.
2. **PayFast ITN Payment Security:** The PayFast payment webhook handler (`app/api/payments/payfast/itn/route.ts`) enforces raw body byte reading (`readBoundedPayfastItnBody`), constant-time signature verification (`timingSafeEqual`), direct secondary provider query validation (`confirmPayfastItnData`), price-tampering validation, and duplicate event idempotency.
3. **Transactional Dispatch & Concurrency:** Driver job assignment (`lib/services/dispatch-assignment.service.ts`) uses PostgreSQL `SELECT ... FOR UPDATE` row locks on both `Order` and `DriverProfile` alongside version checks to eliminate race conditions.
4. **Hashed Credentials & OTP Security:** Passwords use `bcryptjs` with 12 rounds (`lib/auth/password.ts`), sessions use SHA-256 hashed tokens (`lib/auth/session.ts`), and delivery OTPs store only SHA-256 hashes (`lib/services/delivery-otp.service.ts`).

### Critical Production Gaps & Blockers
1. **Absence of Root Next.js Middleware:** There is no root `middleware.ts` file. Protection relies entirely on per-route inline authorization checks (`requireAdminApiPermission`, `getCurrentUser`). Any newly created route lacking an explicit guard defaults to publicly accessible.
2. **Simulated Payout Execution:** Driver and vendor withdrawals (`lib/withdrawals/*`) process via manual/simulated ledger transfers (`cashClearingAccountId`). Automated integration with a bank/payout gateway (e.g., PayFast Payouts or Stitch) is absent and locked (`WITHDRAWAL_PRODUCTION_VALIDATION_APPROVED = false`).
3. #### FINDING-HIGH-02: Point-in-Time Driver Location Without Geofencing or Stale-Location Protection
* **Severity:** High
* **Domain:** Driver & Dispatch
* **Status:** Confirmed
* **Evidence:** [lib/services/delivery-execution.service.ts#L214](file:///d:/KT-Courier/kt-courier/lib/services/delivery-execution.service.ts#L214) accepts optional `latitude`/`longitude` directly from command payloads.
* **Failure Scenario:** A driver marks a job as "Picked Up" or "Delivered" from a location miles away by sending fabricated GPS coordinates in the request payload.
* **Business Impact:** Delivery fraud, customer dispute liabilities, and compromised delivery proof integrity.
* **Remediation:** Enforce coordinate timestamp validation and server-side geofencing against store and dropoff location boundaries.
* **Effort:** 3 Days | **Dependencies:** Google Maps Distance Matrix.

#### FINDING-HIGH-03: Broken Store ID Mapping in Vendor Ad Campaigns & Promotions
* **Severity:** High
* **Domain:** Vendor Operations & Security
* **Status:** Confirmed
* **Evidence:** [app/api/store/ads/campaigns/route.ts](file:///d:/KT-Courier/kt-courier/app/api/store/ads/campaigns/route.ts), [app/api/store/ads/campaigns/[campaignRef]/funding/route.ts](file:///d:/KT-Courier/kt-courier/app/api/store/ads/campaigns/[campaignRef]/funding/route.ts), and [app/api/store/promotions/route.ts](file:///d:/KT-Courier/kt-courier/app/api/store/promotions/route.ts).
* **Failure Scenario:** Routes pass `session.id` (`User.id`) directly as `storeId` instead of looking up `Store.id` via `getOwnedStoreId(user.id)`. Since `Store.id` is a separate CUID in the `Store` table, queries fail to find store records (`STORE_NOT_FOUND`), causing features to fail.
* **Business Impact:** Vendor advertising campaigns and promotions are non-functional for store owners.
* **Remediation:** Update store ad and promotion route handlers to resolve `Store.id` via `getOwnedStoreId(session.id)` before querying campaign records.
* **Effort:** 1 Day | **Dependencies:** `getOwnedStoreId` helper.
4. **Uncommitted Master Repository:** The entire application implementation (`app/`, `lib/`, `components/`, `prisma/`, `docs/`) remains untracked in Git (git status shows all core folders untracked over a single "Initial commit from Create Next App").
5. **Stubbed Services:** Freight, House Moving, Shuttle, and Business Team Management render `<CustomerUnavailablePage>` components. Photo proof of delivery (`evidenceReference`) is an unvalidated string placeholder.

---

## 2. Repository and Technology Map

| Category | Component / Library | Version / File Location | Status |
| :--- | :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | `16.2.9` (`package.json`) | Complete |
| **UI Library** | React / React DOM | `19.2.4` (`package.json`) | Complete |
| **Database ORM** | Prisma ORM | `5.22.0` (`prisma/schema.prisma`) | Complete |
| **Database Engine** | PostgreSQL 16 | Docker Compose / Host Port 5433 | Complete |
| **Styling** | TailwindCSS | `^4` (`package.json`, `app/globals.css`) | Complete |
| **Validation** | Zod | `^4.4.3` (`package.json`) | Complete |
| **Password Hashing** | bcryptjs | `^3.0.3` (12 rounds) (`lib/auth/password.ts`) | Complete |
| **Email Service** | Resend SDK / Console fallback | `^6.12.4` (`lib/email/email-service.ts`) | Complete (Credential Pending) |
| **Maps Integration** | Google Maps JS & Distance Matrix API | Client & Server adapters (`lib/maps/*`) | Complete (Credential Pending) |
| **Payment Gateway** | PayFast Custom Checkout & ITN | `app/api/payments/payfast/itn/route.ts` | Complete (Credential Pending) |
| **Testing** | Vitest & Playwright | `vitest.config.ts`, `playwright.config.ts` | Complete |
| **Containerization** | Docker & Docker Compose | `Dockerfile`, `compose.yml` (Non-root `nextjs` user 1001) | Complete |

---

## 3. Domain Score Breakdown

```
[Architecture & Data Integrity]   ========-- 93% (7.5 / 8.0)
[Auth & Security]                  =======--- 75% (9.0 / 12.0)
[Customer Marketplace]             ========-- 83% (7.5 / 9.0)
[Vendor / Catalog]                 =======--- 85% (6.0 / 7.0)
[Orders & Fulfilment]              ========-- 83% (10.0 / 12.0)
[Driver & Dispatch]                ======---- 65% (6.5 / 10.0)
[Payments, Ledger & Withdrawals]   ======---- 70% (10.5 / 15.0)
[External Integrations]            ======---- 64% (4.5 / 7.0)
[Admin & Developer API]            ========-- 83% (5.0 / 6.0)
[Frontend & UX]                    ======---- 70% (3.5 / 5.0)
[Testing & SRE Ops]                =======--- 77% (7.0 / 9.0)
------------------------------------------------------------
TOTAL WEIGHTED PRODUCTION READINESS SCORE: 77.0%
```

---

## 4. Requirements Traceability Matrix (Summary)

| Capability | Surface / Scope | Route / API | Model / Service | Status | Evidence Path |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Auth (Email/Password)** | Public / Auth | `/api/auth/login`, `signup` | `User`, `lib/auth/password.ts` | Complete | `lib/auth/password.ts:6` |
| **Hashed Sessions** | System | Cookie `kt_session` | `Session`, `lib/auth/session.ts` | Complete | `lib/auth/session.ts:19` |
| **Delivery OTP** | Customer / Driver | `/api/driver/assignments/[id]/delivery/otp` | `DeliveryOtp`, `delivery-otp.service.ts` | Complete | `lib/services/delivery-otp.service.ts:31` |
| **Multi-Store Cart** | Customer | `/api/cart` | `lib/marketplace-checkout/cart-mutation.service.ts` | Complete | `lib/marketplace-checkout/policy.ts:5` |
| **Server Pricing Engine** | Checkout | `/api/checkout` | `lib/pricing/calculator.ts` | Complete | `lib/pricing/calculator.ts:1` |
| **Order State Machine** | Orders | `/api/orders` | `lib/orders/order-state-machine.ts` | Complete | `lib/orders/order-state-machine.ts:1` |
| **Dispatch Row Locking** | Driver / Admin | `/api/driver/assignments` | `lib/services/dispatch-assignment.service.ts` | Complete | `lib/services/dispatch-assignment.service.ts:15` |
| **PayFast ITN Webhook** | System | `/api/payments/payfast/itn` | `lib/payments/providers/payfast/*` | Complete | `app/api/payments/payfast/itn/route.ts:1` |
| **Double-Entry Ledger** | Finance | `/admin/ledger` | `LedgerJournal`, `lib/ledger/*` | Complete | `lib/ledger/journal-policy.ts:1` |
| **Payout Gateway** | Finance | `/api/withdrawals` | `lib/withdrawals/*` | Stubbed / Manual | `lib/withdrawals/withdrawal-ledger-policy.ts` |
| **Continuous GPS Stream** | Driver | `/api/driver/location` | `lib/services/delivery-execution.service.ts` | Partial (Point-in-time) | `lib/services/delivery-execution.service.ts:214` |
| **Freight & Moving Services**| Customer | `/account/request-delivery/freight` | `<CustomerUnavailablePage>` | UI Shell / Disabled | `app/(account)/account/request-delivery/freight/page.tsx` |

---

## 5. Risk-Ordered Remediation Roadmap

### Phase 1: Security & Governance (Priority: Immediate / Blocker)
1. **Commit Repository to Version Control:** Track all untracked files into Git with clean commit history.
2. **Implement Root Next.js Middleware:** Add `middleware.ts` to enforce session validation, security headers, and route protection globally across `app/`.
3. **Secure Demo Seed Data:** Modify `prisma/seed.ts` to strictly prohibit execution when `NODE_ENV === "production"` or when connecting to non-development databases.

### Phase 2: Logistics & Tracking Hardening (Priority: High)
1. **Add Continuous GPS & Geofencing:** Implement location timestamp checks and distance threshold validation between driver coordinates and store/dropoff locations.
2. **Implement Photo Proof Upload:** Integrate S3/Cloud Storage presigned image upload for delivery proof instead of plain string references.
3. **Add Rate-Limiting Redis/Memory Layer:** Replace DB-backed rate limiting with an in-memory/Redis layer for high-throughput public endpoints.

### Phase 3: Financial & Operational Readiness (Priority: High)
1. **Integrate Real Payout Gateway:** Replace manual cash clearing payout releases with an automated banking API adapter (e.g., Stitch or PayFast Payouts).
2. **Set Up Production Credentials & Monitoring:** Configure Resend API keys, Google Maps keys, PayFast credentials, and error tracking (Sentry/OpenTelemetry).
3. **Configure Production Database Backups:** Set up automated daily PostgreSQL backups and point-in-time recovery (PITR).

---

## 6. Final Verdict & Required Prerequisites

### Final Verdict Category
`Feature-rich but not production ready`

### What Must Happen Before Any Source-Code Modification
1. **Repository Safety:** Execute `git add .` and create an authoritative baseline commit on `master`.
2. **Environment Isolation:** Ensure host environment variables do NOT point to any live production database or external account.
3. **Test Baseline Execution:** Verify local test runner status using `npm test` and `npm run typecheck` prior to introducing changes.
