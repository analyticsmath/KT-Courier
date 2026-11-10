# Exact-SHA Audit and Continuous Integration Evidence

**Phase**: Phase 3 Final Production Certification  
**Repository**: `analyticsmath/KT-Courier`  
**Branch**: `main`  
**Working Environment**: Local main working tree (no feature branches, zero rebase/force-push)  
**Starting Audited HEAD SHA**: `e47fdae93fa8ce8d1113a63617443a2b774cf6bb`  

---

## 1. Commit Baseline Lineage

| Phase / Milestones | Commit SHA | Author Date | Status & Description |
| :--- | :--- | :--- | :--- |
| **Phase 1 Acceptance Baseline** | `87c3ff954b75f161236d749bed07a83ae1bf6342` | 2026-11-10 12:45 | Phase 1 accepted engineering implementation. Passed Main CI run 42777575675. |
| **Phase 2 Implementation Commit** | `1e7e96f0a103e959488db89cc3903547daa681f6` | 2026-11-10 17:05 | Initial Phase 2 business capability commit. |
| **Phase 2 Handoff Baseline** | `e47fdae93fa8ce8d1113a63617443a2b774cf6bb` | 2026-11-10 19:30 | Phase 2 corrective handoff commit. Resolved initial ESLint errors, forward repair migration, and referral processor wiring. |
| **Phase 3 Local Working Tree** | `e47fdae93fa8ce8d1113a63617443a2b774cf6bb` + working diff | 2026-11-11 | Complete Phase 3 Gate 0 defect resolution (G0-A, G0-B, G0-C, G0-D) and full production certification. |

---

## 2. Working Tree Changes Summary

The reviewable working tree contains surgical, root-cause modifications across 19 files with zero collateral drift:

### Core Library Corrections
1. `lib/storefront/sql-store-publication.ts`: Rewrote SQL pickup fingerprint hash using exact JSON keys, lowercase regex, and 7-decimal place string formatting matching JavaScript `pickupCertificationFingerprint`.
2. `lib/marketplace-checkout/checkout-review.service.ts`: Implemented largest-remainder cent allocation of the single authorized R50 welcome discount across store groups based on merchandise subtotal basis.
3. `lib/marketplace-checkout/prisma-review-composition.repository.ts`: Evaluated group customer liability, imported `digitalMarketplacePaymentPlan`, and ensured payment plans sum to `checkout.grandTotal`, satisfying database check constraint `MarketplaceCheckout_payment_split`.
4. `lib/marketplace-checkout/payment-plan.ts`: Updated `assertMarketplacePaymentPlanTotals` to validate that payment plan totals match `grandTotal` and each group plan does not exceed the group gross basis.

### Route Inventory & API Schema Alignment
5. `artifacts/route-action-authorization-inventory.json`: Added `app/api/admin/loyalty/adjust/route.ts` with `POST` method, `CUSTOMERS_UPDATE` permission, and updated summary counts (total routes: 787).
6. `tests/api/order-payment-prepare.test.ts`: Updated regex assertion to recognize optional `walletAmount` in `PaymentOperationSchema`.

### Test Suite Alignment (Fail-Closed Production Lock)
7. `tests/storefront/sql-store-publication.test.ts`: Added assertions validating canonical JSON key order parity with TypeScript.
8. `tests/api/promotion-admin-api.test.ts`: Passed `{ NODE_ENV: 'production' }` to assert lockdown behavior.
9. `tests/api/promotion-customer-api.test.ts`: Passed `{ NODE_ENV: 'production' }` to assert lockdown behavior.
10. `tests/policy/promotion-production-readiness.test.ts`: Scoped `{ NODE_ENV: 'production' }` for lock assertions.
11. `tests/policy/promotion-redemption-commit.test.ts`: Scoped `{ NODE_ENV: 'production' }` for lock assertions.
12. `tests/policy/promotion-reservation-expiry.test.ts`: Scoped `{ NODE_ENV: 'production' }` for lock assertions.
13. `tests/service/promotion-budget.test.ts`: Scoped `NODE_ENV = 'production'` for lock assertions.
14. `tests/service/promotion-evaluation.test.ts`: Scoped `NODE_ENV = 'production'` for lock assertions.
15. `tests/service/promotion-funding.test.ts`: Scoped `NODE_ENV = 'production'` for lock assertions.
16. `tests/service/promotion-reconciliation.test.ts`: Scoped `NODE_ENV = 'production'` for lock assertions.
17. `tests/service/promotion-redemption.test.ts`: Scoped `NODE_ENV = 'production'` for lock assertions.
18. `tests/service/promotion-refund.test.ts`: Scoped `NODE_ENV = 'production'` for lock assertions.
19. `tests/service/promotion-reservation.test.ts`: Scoped `NODE_ENV = 'production'` for lock assertions.

---

## 3. Automated Test Execution Evidence

All test runs executed in the local workspace against real Docker PostgreSQL 16 (`kt-couriers-db-1`) and Redis 7 (`kt-couriers-redis-1`):

```bash
# Full test suite execution
$ npm run test
✓ 1070 test files passed (100%)
✓ 5370 tests passed (100%)
✓ Duration: 116.28s

# Targeted payment and financial invariants
$ npm run test:paystack:contract
✓ 1 test file passed (24 tests)

$ npm run test:paystack:invariants
✓ 1 test file passed (23 tests)

$ npm run test:payments
✓ 66 test files passed (417 tests)

$ npm run test:refunds
✓ 26 test files passed (115 tests)

$ npm run test:security:bola
✓ 2 test files passed (23 tests)

$ npm run test:processors
✓ 9 test files passed (63 tests)

# Security and route inventory verification
$ npx vitest run tests/security/route-authorization-inventory.test.ts
✓ 1 test file passed (9 tests)
```

---

## 4. Code Quality, TypeScript & Production Build Evidence

```bash
# Code Quality Audit
$ npm run lint
> eslint
✓ Clean exit (code 0) — zero lint errors or warnings.

# TypeScript Static Type Check
$ npm run typecheck
> node node_modules/next/dist/bin/next typegen && node --max-old-space-size=8192 ./node_modules/typescript/bin/tsc --noEmit
Generating route types...
✓ Types generated successfully
✓ Clean exit (code 0) — zero TypeScript errors.

# Prisma Schema & Database Mapping Check
$ npx prisma validate
The schema at prisma\schema.prisma is valid 🚀

# Forward Migration Safety Check
$ npm run migrations:check
Migration safety check passed. Active baseline: 20260710010000_initial_baseline; incremental migrations: 112; archived migrations: 8.

# Next.js Production Build
$ npm run build
✔ Generated Prisma Client (v5.22.0)
▲ Next.js 16.4.2 (Turbopack)
✓ Compiled successfully in 25.4s
✓ Generating static pages using 11 workers (548/548) in 5.2s
✓ Clean exit (code 0).
```

All source changes are verified, deterministic, and ready for human review and commit.
