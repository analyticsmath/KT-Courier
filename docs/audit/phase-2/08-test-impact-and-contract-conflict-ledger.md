# 08 — Test Impact and Contract Conflict Ledger

## Overview

This document documents contract conflicts discovered, test runner classifications, test coverage impact, and resolved ambiguities across Phase 2.

## Contract Conflict Ledger

| Conflict ID | Initial State / Misleading Artifact | True Requirement Authority | Resolution Applied | Evidence |
| --- | --- | --- | --- | --- |
| CC-01 | `npm run test:integration:catalog` and `storefront` exited with hardcoded deferral errors | Phase 2 Directive Section 5 | Built safe PostgreSQL runner (`scripts/safe-postgres-runner.mjs`) with strict environment & URL validation | `BEHAVIORAL_TEST`, `DB_FREE_VALIDATION` |
| CC-02 | `vitest.marketplace-checkout-integration.config.ts` and `vitest.store-order-integration.config.ts` were DB-free contract stubs | Phase 2 Directive Section 4 | Classified suites accurately as `DB_FREE_INTEGRATION_CONTRACT`; added safe runners in `package.json` | `STATIC_EVIDENCE`, `DB_FREE_VALIDATION` |
| CC-03 | Generic statement claiming all integration proof was deferred to "Phase 26.5" | Phase 2 Directive Section 9 | Removed blanket Phase 26.5 deferral statement; replaced with precise Phase 2 ownership matrix | `STATIC_EVIDENCE`, `DECLARED_POLICY` |
| CC-04 | Cart operations recorded every receipt type as `ADD_LINE` | Prisma Schema & Cart Service Contract | Fixed `cart-mutation.service.ts` to record true mutation types (`ADD_LINE`, `UPDATE_QUANTITY`, `REPLACE_MODIFIERS`, `REMOVE_LINE`, `CLEAR`, `CLAIM`, `MERGE`) | `BEHAVIORAL_TEST` |
| CC-05 | Exported `mergeGuestAndCustomerCarts` helper lacked an outer transaction wrapper | Serializable Repository Contract | Wrapped exported helper in `repository.transaction()`; inner work used by `claimGuestCart` without double-wrapping | `BEHAVIORAL_TEST` |

## Test Suite Classification Matrix

| Test Suite Configuration / Script | Matched Test Files | True Classification | DB Instantiated? | SQL Executed? | Status |
| --- | --- | --- | --- | --- | --- |
| `scripts/catalog-integration-test.mjs` | `tests/integration/catalog-*.integration.test.ts` | `REAL_POSTGRESQL_INTEGRATION` (Runner) | Only if local test DB supplied | Only if local test DB supplied | Blocked by default (`BLOCKED_SAFE_ENVIRONMENT_REQUIRED`); exit 2 |
| `scripts/storefront-integration-test.mjs` | `tests/integration/storefront-*.integration.test.ts` | `REAL_POSTGRESQL_INTEGRATION` (Runner) | Only if local test DB supplied | Only if local test DB supplied | Blocked by default (`BLOCKED_SAFE_ENVIRONMENT_REQUIRED`); exit 2 |
| `scripts/marketplace-checkout-integration-test.mjs` | `tests/integration/marketplace-*.integration.test.ts` | `DB_FREE_INTEGRATION_CONTRACT` / `REAL_POSTGRESQL_INTEGRATION` | Only if local test DB supplied | Only if local test DB supplied | Blocked by default (`BLOCKED_SAFE_ENVIRONMENT_REQUIRED`); exit 2 |
| `scripts/store-order-integration-test.mjs` | `tests/integration/store-order-*.integration.test.ts` | `DB_FREE_INTEGRATION_CONTRACT` / `REAL_POSTGRESQL_INTEGRATION` | Only if local test DB supplied | Only if local test DB supplied | Blocked by default (`BLOCKED_SAFE_ENVIRONMENT_REQUIRED`); exit 2 |
| `tests/scripts/safe-postgres-runner.test.ts` | `tests/scripts/safe-postgres-runner.test.ts` | `DB_FREE_VALIDATION` | No | No | Passed (8 tests, Exit 0) |
| `tests/marketplace-checkout/cart-mutation.service.test.ts` | `tests/marketplace-checkout/cart-mutation.service.test.ts` | `BEHAVIORAL_TEST` | No (In-memory mock) | No | Passed (10 tests, Exit 0) |
| `tests/storefront/storefront-production-readiness.test.ts` | `tests/storefront/storefront-production-readiness.test.ts` | `SOURCE_LOCK_VERIFICATION` | No | No | Passed (2 tests, Exit 0) |
