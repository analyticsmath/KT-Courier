# Phase 14 commission system

Phase 14 adds a versioned commission policy foundation only. It does not trigger from orders or payments and it does not create store, driver, promoter, customer, refund, settlement, withdrawal, cash-transfer, fee, tax, marketplace, subscription, or advertising behavior.

## Financial semantics

An internal authorized settlement caller may later use the accrual primitive with an immutable courier-order pricing snapshot and settlement version. It debits platform customer funds held only for the calculated commission total, credits platform commission revenue for platform components, and credits `COMMISSION_PAYABLE` for verified beneficiary components. It never posts cash clearing or `OWNER_WITHDRAWABLE`.

Policies use `COURIER_ORDER`, `GLOBAL:COURIER_ORDER`, ZAR, `ORDER_SUBTOTAL` or `ORDER_TOTAL`, integer BPS or Decimal fixed rules, half-up cent rounding, and an inclusive-start/exclusive-end effective window. Active policy versions and rules are immutable. Policy selection uses authoritative event time, not worker execution time.

The legacy `CommissionRule` and `CommissionTransaction` placeholders are retained as compatibility records and are never converted into Phase 14 policy, accrual, ledger, or beneficiary evidence.

## Production lock

`COMMISSION_PRODUCTION_VALIDATION_APPROVED` is intentionally `false` in reviewed source. Drafting, inspection, and policy review can be implemented; activation, accrual, and reversal fail closed with `CONSOLIDATED_VALIDATION_NOT_APPROVED` until consolidated validation is approved. It is not a public environment toggle.

## Deferred validation risk register

| Risk | Deferred validation |
|---|---|
| Migration and compatibility | Apply the additive migration to an isolated PostgreSQL database and inspect legacy placeholder rows. |
| Prisma/build | Generate client, typecheck, lint, and production-build after the migration is applied. |
| Effective-plan overlap | Exercise PostgreSQL triggers, serializable overlap races, and UTC boundaries. |
| Decimal calculation | Run percentage, fixed, floor/cap, half-up rounding and byte-stable hash vectors. |
| Ledger atomicity | Prove journal/entry/projection/accrual/allocation/history rollback and insufficient-held-funds behavior. |
| Beneficiaries | Verify promoter wallet/account ownership, required versus optional snapshot behavior, and no payable release. |
| Reversal | Prove exact inverse entries, one direct reversal, released-allocation block, and reconciliation evidence. |
| Permissions and UI | Run authenticated API and browser scenarios including explicit DENY, maker-checker, accessibility and no unsafe controls. |
| Cross-module boundaries | Prove no order/payment mutation or automatic settlement caller exists. |

No package installation, Docker operation, migration, seed, browser execution, full test suite, production build, CI, or external financial operation was performed as part of this implementation-only phase.
