# KT Couriers — 2026-11-21 Final One-Pass Code-Level Completion & Release Closeout
Issue Date: 21 November 2026
Repository: `analyticsmath/KT-Courier`
Integration Branch: `main`
Baseline Commit: `f06493ffe37c97059eafb0bcc0e9665eec830095`
Governing Directive: KT COURIERS — FINAL ONE-PASS CODE-LEVEL COMPLETION DIRECTIVE

---

## 1. Executive Summary

This closeout document records the completion of all code-level requirements, defect remediations, and governance deliverables mandated by the **21 November 2026 Final One-Pass Code-Level Completion Directive**.

Every finding (`C01` through `C10`) has been converted from an open historical issue into production-grade, tested source code. All artificial source-compiled locks have been replaced with risk-scoped runtime evaluators, dual-control business gates, and permanent safety invariants.

### Key Governance Invariants Preserved:
1. **Single Integration Branch**: All work is integrated on canonical `main` without creating speculative detached branches.
2. **Immutable Audit History**: Historic certification and audit manifests (`docs/production-closure/engineering-gates.json`, `docs/phase3/final-certification.json`, `docs/final-closure/final-acceptance.json`) remain strictly untouched.
3. **No Live Production Mutation**: Remote Railway services (`web`, `operations`, `query-storefront-categories`) and production database `e9554aaa-1b53-4595-8731-e8c2885ac594` were never mutated; all testing ran in safe, isolated local test environments.
4. **No Financial Fabrication**: No money was minted, no synthetic provider signatures were accepted, and no customer funds were compromised.

---

## 2. Detailed Technical Dispositions (C01 – C10)

### C01: Single Platform Commerce Activation (`KT_COMMERCE_ENABLED`)
- **Root Cause**: `lib/marketplace-checkout/production-lock.ts` checked `CHECKOUT_PUBLIC_ENABLED` with compiled approvals, creating multiple competing switches.
- **Remediation**:
  - Implemented `lib/runtime/commerce-switch.ts` (`resolveCommerceSwitch`).
  - `KT_COMMERCE_ENABLED` is the single authoritative platform switch.
  - Fail-closed default: resolves to `false` when absent or invalid.
  - Safe rolling deployment migration: falls back to `CHECKOUT_PUBLIC_ENABLED` only when `KT_COMMERCE_ENABLED` is completely unset, emitting a deprecation warning. If both exist with conflicting values, `KT_COMMERCE_ENABLED` wins unconditionally.
  - Contract test `tests/runtime/commerce-activation.test.ts` scans all source files (`lib/`, `app/`, `components/`) ensuring zero direct readers of `CHECKOUT_PUBLIC_ENABLED` outside `commerce-switch.ts`.

### C02: Canonical evaluateCommerceActivation() & Decoupled PAYSTACK_MODE
- **Root Cause**: `lib/payments/providers/paystack/paystack-config.ts` re-read `CHECKOUT_PUBLIC_ENABLED`, and `lib/production-readiness/capability-matrix.service.ts` read it separately.
- **Remediation**:
  - Implemented `lib/runtime/commerce-activation.ts` (`evaluateCommerceActivation`).
  - Single canonical return type: `{ globalRequested, publicCheckoutExposed, parcelCardAllowed, storeCardAllowed, codOffered, reasonCodes }`.
  - Used uniformly across public delivery quote payment methods, provider registration, marketplace checkout, and admin capability boards.
  - `PAYSTACK_MODE` is strictly a provider credential mode (`"live"` vs `"test"`), never a redundant commerce enablement switch.

### C03: Risk-Scoped Refunds & Earned Payouts
- **Root Cause**: `lib/refunds/refund-production-readiness.ts` had `REFUND_PRODUCTION_VALIDATION_APPROVED = false as const` throwing unconditionally, and `lib/withdrawals/withdrawal-production-readiness.ts` had a compiled false.
- **Remediation**:
  - Replaced blanket throws with risk-scoped evaluators: `evaluateRefundProductionReadiness` and `withdrawalProductionReadiness`.
  - **Refunds**: Internal wallet balance refunds remain active even when commerce is disabled (`KT_COMMERCE_ENABLED=false`) so customer liabilities are never stranded during maintenance or launch holds. External gateway refunds require live credentials.
  - **Withdrawals & Payouts**: Customer wallet bank withdrawals are permanently forbidden (`CUSTOMER_WALLET_BANK_WITHDRAWAL_ALLOWED = false`), preventing unregulated cash-out liabilities. Driver and store earned earnings payouts operate when `WITHDRAWAL_PAYOUT_ENABLED=true` and live Paystack Transfer credentials are present.

### C04: Risk-Scoped Commercial Promotions Gate
- **Root Cause**: `lib/promotions/production-lock.ts` had `PROMOTIONS_PRODUCTION_VALIDATION_APPROVED = false as const`.
- **Remediation**:
  - Implemented `evaluatePromotionsReleaseGate`.
  - Commercial promotional discount campaigns are gated by `KT_COMMERCE_ENABLED=true`.
  - Liability cleanup operations (`RELEASE`, `REVERSAL`, `RECONCILIATION`) remain permitted even when commerce is off, ensuring refunds/cancellations can always clear reserved promotion liabilities.
  - Chargeable advertising (`ADVERTISING_PRODUCTION_VALIDATION_APPROVED = false`) and promoter commissions (`PROMOTERS_PRODUCTION_VALIDATION_APPROVED = false`) remain permanently locked pending future commercial contracts.

### C05: Suburb vs Line2 Decoupling
- **Root Cause**: `suburb || line2` expressions conflated unit and apartment numbers with locality/suburb names.
- **Remediation**:
  - Implemented `resolveStorePickupSuburb`, `isUnitOrBuildingLine2`, and `usesLegacyLine2Suburb` in `lib/marketplace-checkout/store-pickup-selection.ts`.
  - Unit/building prefixes (`Unit`, `Apt`, `Suite`, `Shop`, `Flat`, `Block`, numbers) are never conflated as suburbs.
  - Backward compatibility: legacy non-unit `line2` suburbs (e.g. `Sandton`, `Hatfield`) continue to resolve cleanly.
  - Updated `StorePickupAddressManager.tsx` to decouple `#store_pickup_suburb` from `line2` into dedicated input fields.

### C06: Customer Saved Address Provenance & Coordinate Retention
- **Root Cause**: `customer-checkout-prefill.ts` required a Google Place ID for its mapped prefill, clearing saved addresses lacking place IDs even when verified coordinates existed.
- **Remediation**:
  - Updated `lib/marketplace-checkout/customer-checkout-prefill.ts`, `app/api/checkout/[reference]/delivery-address/route.ts`, and `CheckoutExperience.tsx`.
  - Customer saved address prefill preserves verified coordinates in trusted customer account context without silent blanking.
  - Delivery address submission validates coordinate parity without wiping user-saved locations.

### C07: Balanced COD Physical Delivery Shortage Accounting
- **Root Cause**: `lib/services/cod-physical-delivery-exception.service.ts` allowed reviewing physical delivery with cash uncollected, but lacked balanced accounting entries.
- **Remediation**:
  - Implemented `ensureShortageReceivableAccounts` creating balanced chart of accounts:
    - `PLATFORM-COD-UNCOLLECTED-RECEIVABLE-ZAR` (ASSET)
    - `PLATFORM-COD-UNCOLLECTED-SHORTAGE-SUSPENSE-ZAR` (LIABILITY)
  - Reviewing an exception with `VERIFY` posts an exact-once, balanced shortage journal (`VERIFIED_CASH_OUTSTANDING`). Zero driver revenue, seller earnings, or fake bank settlement is created.
  - Implemented `resolveCodPhysicalDeliveryShortage` supporting `DISPUTED`, `RECOVERED` (with external receipt), and `WRITTEN_OFF`, clearing the suspense/receivable pair back to zero under dual control.

### C08: Multi-Worker Processor Heartbeat Merging & Cadence Throttling
- **Root Cause**: Both Railway services `operations` and `query-storefront-categories` run `scripts/production-processors.ts`, overwriting a single Redis heartbeat key and causing competing lease/online status.
- **Remediation**:
  - Implemented `resolveProcessorWorkerIdentity` (`KT_PROCESSOR_WORKER_ID` / `RAILWAY_SERVICE_NAME` / PID) and `mergeClusterProcessorHeartbeats`.
  - Workers write individual heartbeats (`production_processor_heartbeat:<workerId>`), and the cluster heartbeat merges counts, active workers, and discrepancies.
  - Fixed `createProductionCycleWorkCheck`: 24h unpaid parcel order expiry only throttles its cadence when expired work is found, preventing an early check before deadline from causing a 5-minute delay after the 24h mark.

### C09: Courier Order Confirmation, Webhook/Verify Races & 24h Expiry
- **Root Cause**: Race conditions between Paystack webhooks, customer redirect Verify recovery, and 24h unpaid parcel expiry.
- **Remediation**:
  - Preserved existing sound authority `confirmVerifiedCourierOrderWithinTransaction`: orders promote `PENDING -> CONFIRMED` only with immutable ledger proof (`successLedgerJournalId`).
  - Added exact-source tests in `tests/payments/paystack-verify-recovery.test.ts`:
    - Simultaneous webhook and verify recovery: replayed or acknowledged idempotently (`ALREADY_SETTLED`).
    - Status polling (`recoverPendingPaystackPaymentForPaymentId`).
    - Wallet split parcel payment: consumes reserved wallet portion and confirms parcel order.
    - Late provider settlement on a 24h cancelled parcel order: ledger receipt safely journaled into customer funds held, dispatch offers revoked, cancellation refund initiated (`COMPLETED_LATE_PAYMENT_REFUND_INITIATED`), reconciliation case opened (`OUT_OF_ORDER_EVENT`), and cancelled parcel order is NEVER resurrected.
    - Negative provider settlement (wrong currency, amount mismatch) flags reconciliation without confirming order.

### C10: Storefront SQL Publication vs Per-Store Record Readiness & Admin Repair Cockpit
- **Root Cause**: Stores were invisible in the public storefront due to missing per-store configuration records (seller legal identity, pickup geocode, commission plan, operational policy, sellable offers, dual-control certification), not a code defect in `sql-store-publication.ts`.
- **Remediation**:
  - Built `components/admin/StoreRepairCockpit.tsx` and integrated it into `/admin/stores/[id]/page.tsx`.
  - Provides real-time SQL publication diagnosis with clear scores (`X of 6 Gates Satisfied`).
  - Surfaces active blockers and provides direct repair action links for every gate:
    1. Seller Legal Identity (`/admin/stores/[id]/seller-identity`)
    2. Collection Address & Geocode (`#manage-pickup-address`)
    3. Commission Settlement Plan (`/admin/commission-plans?storeId=[id]`)
    4. Sellable Catalog Offers (`/admin/stores/[id]`)
    5. Operational Policy (`/admin/policies`)
    6. Two-Reviewer Checkout Certification (`#checkout-certification`)

---

## 3. Governance Deliverables (§B.1 – §B.5)

| Deliverable | Source Artifact | Description |
|---|---|---|
| **§A Commerce Activation** | `lib/runtime/commerce-activation.ts` | Authoritative composite commerce activation evaluator. |
| **§B.1 Lock Register** | `lib/governance/production-lock-register.ts` | Machine-readable register of all 10 release locks, scopes, defaults, resolution functions, and unblock criteria. Verified via `tests/governance/production-lock-register.test.ts`. |
| **§B.2 Sequence Diagrams** | `docs/production-closure/COMMERCE_ACTIVATION_SEQUENCE_DIAGRAMS.md` | Canonical Mermaid sequence diagrams covering parcel booking, webhook/verify races, 24h expiry, COD shortage suspense, and payout controls. |
| **§B.3 Crosswalk & Proof Index** | `docs/production-closure/CHIEF_ARCHITECT_9SOURCE_CROSSWALK_2026-11-16.md`, `lib/governance/directive-code-coverage-register.ts` | Crosswalk updated with Section 5 (C01–C10); 10 new directive entries added and verified via `tests/governance/directive-code-coverage-register.test.ts`. |
| **§B.4 Redacted Env Schema** | `lib/runtime/env-schema-verifier.ts`, `scripts/verify-env-schema.mjs` | Verifies presence of all 42 platform environment variables across Railway/Vercel services without leaking secrets. Executed via `npm run env:verify`. |
| **§B.5 Split Admin Views** | `components/admin/ProductionReadinessBoard.tsx`, `app/(admin)/admin/production-readiness/page.tsx` | Strictly separates Admin Code Capability Status (source implemented, isolated SHA, test status) from Live Entity Configuration Status (active stores count, approved drivers, payment provider, actionable repair links). |

---

## 4. Verification Evidence & Test Execution

All test suites and verification scripts were executed locally against the exact source code on `main`:

```bash
# Environment schema verification
npm run env:verify -> PASS (42/42 variables evaluated, zero secret leakage)

# Directive governance register verification
npx vitest run tests/governance/directive-code-coverage-register.test.ts -> PASS (3/3 tests)

# Production lock register verification
npx vitest run tests/governance/production-lock-register.test.ts -> PASS (3/3 tests)

# Authoritative commerce activation contract
npx vitest run tests/runtime/commerce-activation.test.ts -> PASS (6/6 tests)

# Risk-scoped refunds & customer withdrawal ban
npx vitest run tests/refunds/refund-production-readiness.test.ts -> PASS (4/4 tests)
npx vitest run tests/withdrawals/withdrawal-production-readiness.test.ts -> PASS (6/6 tests)

# Promotions production gate & liability cleanup
npx vitest run tests/promotions/production-lock-negative.test.ts -> PASS (3/3 tests)
npx vitest run tests/policy/promotion-production-readiness.test.ts -> PASS (6/6 tests)

# Suburb vs line2 & customer address provenance
npx vitest run tests/marketplace-checkout/store-pickup-selection.test.ts -> PASS (8/8 tests)
npx vitest run tests/unit/store-courier-pickup-suburb.test.ts -> PASS (7/7 tests)
npx vitest run tests/marketplace-checkout/customer-checkout-prefill.test.ts -> PASS (5/5 tests)

# COD uncollected shortage balanced accounting
npx vitest run tests/orders/cod-physical-shortage-accounting.test.ts -> PASS (4/4 tests)

# Multi-worker processor loop concurrency
npx vitest run tests/processors/production-loop.test.ts -> PASS (15/15 tests)

# Paystack verify recovery & 24h cancelled parcel order late settlement
npx vitest run tests/payments/paystack-verify-recovery.test.ts -> PASS (10/10 tests)

# Store repair cockpit & SQL publication
npx vitest run tests/admin/store-repair-cockpit.test.ts -> PASS (2/2 tests)
npx vitest run tests/storefront/sql-store-publication.test.ts -> PASS (5/5 tests)
```

---

## 5. Deployment & Go-Live Readiness Instructions

To activate public commerce in production after business authorization:
1. Set `KT_COMMERCE_ENABLED=true` in Railway (`web`, `operations`, `query-storefront-categories`) and Vercel.
2. Ensure live non-sandbox Paystack credentials (`sk_live_...`, `pk_live_...`) and webhook secret are configured.
3. For earned driver/store payouts, set `WITHDRAWAL_PAYOUT_ENABLED=true`.
4. In Admin Store Repair Cockpit (`/admin/stores/[id]`), verify that stores satisfy all 6 publication gates (seller identity, verified collection geocode, active commission plan, catalog offers, operational policy, dual-control certification) before publishing.
