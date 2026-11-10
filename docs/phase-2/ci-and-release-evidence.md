# KT Couriers — Phase 2 CI and Release Evidence

- **Repository**: `analyticsmath/KT-Courier`
- **Branch**: `main`
- **Baseline Starting SHA**: `87c3ff954b75f161236d749bed07a83ae1bf6342`
- **Execution Authority**: Chief architect / technical product specification

## 1. Database Migrations & Invariant Safety

- **Total Migrations**: 113 applied migrations in `prisma/migrations/`.
- **Phase 2 Migrations**:
  - `prisma/migrations/20261110150000_phase2_wallet_spending_evidence/migration.sql`:
    - Updates `Payment_succeeded_requires_provider_evidence_check` and `validate_payment_success_evidence()` trigger function to authorize `provider = 'MANUAL'` with `ACCOUNT_TRANSFER` ledger journals crediting `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR` from customer or store wallet accounts.
    - Updates `protect_payment_identity_and_success()` trigger function to support split wallet + card payments where `o."digitalRequired" = OLD."amount" + wallet_split_amount`.
    - Preserves strict external provider attempt/webhook/journal evidence for Paystack and Payfast.
  - `prisma/migrations/20261110170000_phase2_payment_evidence_repair/migration.sql`:
    - Corrects column references in `validate_payment_success_evidence()` replacing non-existent column mappings (`w.paymentAttemptId`, `w.signatureStatus`) with canonical schema columns (`w.attemptId`, `w.providerDataVerified`, `j.type = 'EXTERNAL_PAYMENT_RECEIPT'`).
    - Validates both internal wallet settlements and external provider webhook + ledger evidence atomically.
- **Migration Safety Verification**:
  - `node scripts/check-migrations-safety.mjs`: PASS (112 incremental migrations + active baseline verified, zero unapproved destructive operations).
  - `npx vitest run tests/scripts/migration-safety.test.ts`: PASS (4 tests passed).
  - `npx prisma validate`: PASS (schema is fully valid).

## 2. Test Execution & Engineering Closeout Evidence

### A. Resolved Audit Findings (P2-CLOSE-01 through P2-CLOSE-05)
- **P2-CLOSE-01 (ESLint & Typing)**: Replaced all loose `any` casts with properly constrained Prisma TransactionClient and AuthenticatedUser interfaces in `tests/cod/cod-custody-and-settlement.test.ts`, `tests/payments/wallet-spending.test.ts`, `tests/reviews/post-fulfilment-reviews.test.ts`, and `tests/rewards/customer-loyalty-workstream3.test.ts`. Removed unused import in `lib/services/wallet-spending.service.ts`. Verified with `npm run lint`: ZERO errors, ZERO warnings across all files.
- **P2-CLOSE-02 (PostgreSQL Trigger & Concurrency)**: Deployed forward repair migration `20261110170000_phase2_payment_evidence_repair`. Verified with `tests/integration/paystack-webhook-concurrency.integration.test.ts`: ALL 7 integration tests passed against real PostgreSQL, including concurrent webhook race, dispute serializations, and idempotency replays.
- **P2-CLOSE-03 (Paystack Contract)**: Removed direct `tx.order.update` call in `applyPaystackWebhookEvent` in `lib/services/paystack-webhook-application.service.ts`. Verified with `tests/payments/paystack-contract.test.ts`: ALL 24 tests passed.
- **P2-CLOSE-04 (23514 Check Constraint & Attempt Coherence)**: Added `providerConfirmedAt` in Gate 4 fixtures and aligned trigger attempt validation with canonical schema. Verified with `tests/unit/gate4-fixtures.test.ts` (28 tests passed) and `tests/unit/gate4/gate4-harness.test.ts` (21 tests passed).
- **B2 (Funding Equivalence & Idempotency Hash)**: Implemented `providerDue + walletReserved = checkoutDigitalRequired` in `lib/marketplace-checkout/marketplace-payment-preparation.service.ts`. Bound `walletAmount` and `fundingSource` into `canonicalPaymentHash` in `lib/services/payment-preparation.service.ts`. Verified replay of same key with different wallet amount returns 409 conflict (`PAYMENT_IDEMPOTENCY_CONFLICT`).
- **C1 (Welcome Discount Integration)**: Integrated `checkFirstStoreWelcomeEligibility` into `lib/marketplace-checkout/checkout-review.service.ts` and checkout preparation. Verified with `tests/marketplace-checkout/checkout-runtime.service.test.ts`.
- **C2 (Automatic Referral Processor)**: Registered `process-ordinary-referral-awards` in `PROCESSOR_REGISTRY` and `PROCESSOR_HANDLERS` with dedicated system worker identity and stable event-derived idempotency key. Verified with `npm run test:processors` (63 tests passed).

### B. Consolidated Test Verification Receipts
- **`npm run typecheck`**: PASS (zero TypeScript errors)
- **`npm run lint`**: PASS (zero ESLint errors across the repository)
- **`npm run test:payments`**: PASS (66 test files, 417 tests passed)
- **`npm run test:processors`**: PASS (9 test files, 63 tests passed)
- **`npm run test:refunds`**: PASS (26 test files, 115 tests passed)
- **`npm run test:security:bola`**: PASS (2 test files, 23 tests passed)
- **`npm run build`**: PASS (Next.js 16.4.2 Turbopack production build, 548/548 static pages generated)

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
