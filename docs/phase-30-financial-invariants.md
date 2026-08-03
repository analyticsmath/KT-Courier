# Phase 30 Financial Invariants Audit Report

## Audited Financial Rules
1. **Zero-Sum Ledger Balance**:
   - Double-entry accounting principles strictly enforced: `DEBIT == CREDIT`.
   - Cash clearing balances equal total outstanding liabilities across Customer Wallets, Store Earnings, Driver Earnings, and Platform Revenue.
2. **Non-Negativity Invariant**:
   - Wallet balances, payable amounts, and release-eligible balances cannot drop below 0.00 ZAR.
   - Checked in `tests/integration/withdrawal-invariants.integration.test.ts` and `scripts/verify-report-invariants.mjs`.
3. **Exact Cent Allocation**:
   - Multi-party splitting uses explicit penny/cent remainder distribution with deterministic rounding sequence (`roundingSequence`, `finalCentRecipient`).
4. **Reversal & Refund Invariants**:
   - Store or driver earning reversals cannot exceed original gross settlement amount.
   - Partial refunds adjust commission allocations proportionally.
