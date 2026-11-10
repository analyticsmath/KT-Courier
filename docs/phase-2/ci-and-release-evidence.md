# KT Couriers — Phase 2 CI and Release Evidence

- **Repository**: `analyticsmath/KT-Courier`
- **Branch**: `main`
- **Baseline Starting SHA**: `87c3ff954b75f161236d749bed07a83ae1bf6342`
- **Execution Authority**: Chief architect / technical product specification

## 1. Database Migrations & Invariant Safety

- **Total Migrations**: 112 applied migrations in `prisma/migrations/`.
- **Phase 2 Migration**:
  - `prisma/migrations/20261110150000_phase2_wallet_spending_evidence/migration.sql`
  - Updates `Payment_succeeded_requires_provider_evidence_check` and `validate_payment_success_evidence()` trigger function to authorize `provider = 'MANUAL'` with `ACCOUNT_TRANSFER` ledger journals crediting `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR` from customer or store wallet accounts.
  - Updates `protect_payment_identity_and_success()` trigger function to support split wallet + card payments where `o."digitalRequired" = OLD."amount" + wallet_split_amount`.
  - Preserves strict external provider attempt/webhook/journal evidence for Paystack and Payfast.
- **Migration Safety Verification**:
  - `node scripts/check-migrations-safety.mjs` executed: PASS (clean safety check, all registered exceptions valid).
  - `npx vitest run tests/scripts/migration-safety.test.ts`: PASS (15 tests passed).

## 2. Test Execution Evidence

All Phase 2 test suites were executed with `vitest` against local workspace and PostgreSQL database:

### A. Workstream 1: Store Publication & Checkout Certification
- `tests/services/store-publication-readiness.test.ts`: PASS (15 tests)
- `tests/admin/store-checkout-blockers.test.ts`: PASS (6 tests)
- `tests/storefront/sql-store-publication.test.ts`: PASS (4 tests)
- `tests/services/storefront-store.service.test.ts`: PASS (5 tests)
- `tests/storefront/checkout-certified-public-queries.test.ts`: PASS (20 tests)
- `tests/public-v2/r23-marketplace-closure.test.ts`: PASS (13 tests)

### B. Workstream 2: Customer & Store Wallet Spending
- `tests/payments/wallet-spending.test.ts`: PASS (10 tests)
  - Full wallet breakdown calculation (`WALLET_ONLY`)
  - Split card + wallet breakdown calculation (`SPLIT_PAYSTACK`)
  - Zero wallet breakdown calculation (`PROVIDER_ONLY`)
  - Strict input validation & balance bounds
  - Rejection of customer cash withdrawals in `resolveWithdrawalOwnerForUser`

### C. Workstream 3: Customer Loyalty, Referral & Promotions
- `tests/rewards/customer-loyalty-workstream3.test.ts`: PASS (8 tests)
  - Admin loyalty points adjustment with debt recovery
  - First-store welcome offer 7-day window & first-order guard
  - Promotion release gate fail-closed behavior in production
- `tests/rewards/customer-loyalty-batch.test.ts`: PASS (3 tests)
- Complete `tests/rewards/` suite: PASS (11 test files, 65 tests passed)

### D. Workstream 4: COD Custody, Driver Capacity & Remittance Proof
- `tests/cod/cod-custody-and-settlement.test.ts`: PASS (7 tests)
  - High-risk area suppression on both pickup and dropoff
  - Driver cash limit formula (`held + reserved + candidate <= cashLimitAmount`)
  - Prevention of self-review for driver deposit remittances
- `tests/client-platform/driver-cash.test.ts`: PASS (24 tests)
- Complete `tests/withdrawals/` suite: PASS (16 test files, 26 tests passed)

### E. Workstream 5: Post-Fulfilment Reviews & Store Employee RBAC
- `tests/reviews/post-fulfilment-reviews.test.ts`: PASS (5 tests)
  - Delivery review gate on `DELIVERED` / `COMPLETED` order
  - Driver review gate on assigned driver and completed delivery
  - Immediate server-side employee permission revocation in `storeAccess`

## 3. Release Gate Honesty & Launch Status

- **`docs/production-closure/engineering-gates.json`**: Retained honest state (`NOT_READY` / 19 implemented, 6 open, 3 validation-blocked).
- **Phase 3 Launch Veto**: Retained intentional veto (`Independent Phase 3 launch authorization — fail closed until real evidence exists`).
- **Live Financial Transactions**: **NO-GO**. All financial transactions in Phase 2 remain in test/disposable sandboxes. No live Paystack real-money transfers, live database mutations, or fabricated credentials were created.
