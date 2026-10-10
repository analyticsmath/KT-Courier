# Phase 2 Cross-Agent Integration Contracts

**Author:** Anti-Gravity Coding Agent (Senior Full-Stack Engineer & Independent Phase 2 Delivery Owner)  
**Branch:** `phase2/antigravity-functional-completion-2026-10-11`  
**Base Commit SHA:** `b31ede4a900b0778e15dce0a3ef78e6d2613b350`  
**Parallel Agent:** GPT-6.1 Solo (Phase 1 Financial Correctness & Certification Owner on `production-closure-2026-10-07`)  

---

## 1. Protected Ownership Boundary

Phase 1 exclusively owns all financial correctness, ledger integrity, webhook ingress, and payment verification modules. The Phase 2 branch maintained a strict zero-edit boundary on the following protected paths:

- `lib/payments/verified-payment-event-processor.service.ts`
- `lib/marketplace-checkout/marketplace-payment-success-hook.service.ts`
- `lib/marketplace-checkout/prisma-marketplace-finalization.repository.ts`
- `lib/marketplace-checkout/prisma-review-composition.repository.ts`
- `lib/services/ledger-posting.service.ts`
- `lib/services/paystack-webhook-application.service.ts`
- `lib/store-orders/full-order-adjustment.ts`
- `lib/db/transaction-context.ts`
- `lib/auth/permission-bootstrap.ts`
- `lib/client-platform/support-access.service.ts`
- `components/forms/Conversations.tsx`
- `proxy.ts`
- `lib/ledger/**`
- `app/api/checkout/**`
- `scripts/disposable-closure-tests.mjs`

### Boundary Audit Receipt
```
Files modified in Phase 2 branch overlapping Phase 1 owned paths: 0
Shared production or staging database mutations: 0
Live Paystack / provider key operations: 0
Live deployment or merge to main: 0
```

---

## 2. Canonical Integration Interface Contracts

Where Phase 2 features interface with Phase 1 capabilities, Phase 2 interacts strictly through established, versioned contracts:

### A. Delivery Quote to Order Booking
- **Interface:** `createOrder(user: AuthenticatedUser, input: CreateOrderInput, business: boolean, tx?: Prisma.TransactionClient)` in `lib/services/orders.service.ts`.
- **Contract:** Phase 2 validates the quote, verifies parcel profile constraints, claims the quote by transitioning its owner from guest to authenticated user, and invokes `createOrder` within the same database transaction.
- **Order Status:** The order is initialized in `PENDING` status with `paymentStatus = "UNPAID"`.
- **Invariant:** No payment success or financial transaction is created by Phase 2. Payment requires Phase 1 Paystack/checkout finalization.

### B. Customer & Driver Wallet Read Projections
- **Interface:** `getCustomerWallet(userId: string)` in `lib/services/customer-wallet.service.ts` and `getDriverCashCustody(driverId: string)` in `lib/client-platform/driver-cash.service.ts`.
- **Contract:** Read-only projection of ledger balances. Phase 2 renders exact `.toFixed(2)` formatted ZAR amounts and transaction history.
- **Invariant:** Phase 2 performs zero ledger writes, zero cash journal postings, and zero balance updates. Direct mutations are rejected.

### C. Store Order Substitutions & Handoffs
- **Interface:** `lib/store-orders/store-order.service.ts`.
- **Contract:** Phase 2 manages operational state transitions (`PENDING_STORE_REVIEW` -> `REVIEWING` -> `ACCEPTED` -> `PREPARING` -> `READY_FOR_HANDOFF` -> `HANDED_OFF`).
- **Invariant:** Financial settlement and commission reversals remain bound to canonical settlement processors owned by Phase 1.

---

## 3. Database Schema & Migration Strategy

- **Baseline Status:** At base commit `b31ede4a900b0778e15dce0a3ef78e6d2613b350`, 78 incremental migrations were present and verified safe.
- **Additive Phase 2 Schema:** Phase 2 did not introduce destructive schema drops, renames, or table mutations.
- **Integration Ordering for Chief Architect:**
  1. Phase 1 financial migrations (e.g., consumer receipt conflict resolution, shortage accounting) must be applied first.
  2. Phase 2 forward-only models/indexes are applied subsequently.
  3. Re-run `npm run migrations:check` and `npx prisma validate` to confirm schema integrity.

---

## 4. Tests Blocked Specifically by Phase 1 Integration

The following test suites were identified in the base commit as pending Phase 1 resolution and are classified as `PENDING_INTEGRATION`:

1. **Verified-Payment Event Consumer Receipt Contention:**
   - **Root Cause:** Known `P2034` transaction write conflict at `paymentVerifiedEventConsumerReceipt.create` when concurrent verified payments process.
   - **Phase 1 Owner:** GPT-6.1 Solo is actively resolving this in `lib/payments/verified-payment-event-processor.service.ts`.
   - **Impacted Suites:** Cumulative 139-case Chromium browser suite (specifically the 4 cases where substitution and transactional notifications intersect with concurrent payment processing).
2. **Canonical 41-Case Financial PostgreSQL Acceptance:**
   - **Scope:** Multi-store settlement, ledger entries, exact ZAR cent allocations, and refund dual-control.
   - **Status:** Requires Phase 1 financial correctness fixes before full green execution.

For complete cross-stream blocker tracking and ownership classification, refer to [`docs/phase2-parallel/REMAINING_DEFECTS.md`](docs/phase2-parallel/REMAINING_DEFECTS.md).

---

## 5. Non-Destructive Reintegration Procedure for Chief Architect

When Phase 1 has completed and pushed its certification:
1. Create a clean disposable integration worktree:
   ```bash
   git worktree add -b integration/phase1-phase2-candidate ../KT-Courier-integration origin/production-closure-2026-10-07
   ```
2. Cherry-pick or merge `phase2/antigravity-functional-completion-2026-10-11` into the integration branch:
   ```bash
   git merge --no-ff phase2/antigravity-functional-completion-2026-10-11
   ```
3. Run the complete validation sequence:
   ```bash
   npm ci
   npx prisma generate
   npx prisma validate
   npm run migrations:check
   npm run typecheck
   npm run lint
   npm test
   npm run test:e2e -- --project=chromium --retries=0 --workers=1
   ```
4. Only after all 24 certification components and end-to-end tests pass may the candidate be considered for release review.
