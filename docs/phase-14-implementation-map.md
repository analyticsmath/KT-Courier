# Phase 14 implementation map

This map was completed before the Phase 14 schema change. Phase 14 is an implementation-only commission foundation; it does not create commissions from orders, payments, delivery completion, or any public route.

## Existing commission and financial inventory

| Model | Existing shape and runtime status | Phase 14 decision |
|---|---|---|
| `CommissionRule` | Legacy, standalone placeholder: type, percentage/fixed value, optional owner, active/effective flags, metadata, creator, and `CommissionTransaction` relation. Decimal(12,4), indexes on type/owner/default/active/created. No runtime writer or seed record. | Preserve as `LegacyCommissionRule` mapped to its physical table. It cannot safely become a versioned policy rule without inventing plan, approval, scope, or ledger evidence. |
| `CommissionTransaction` | Legacy placeholder with polymorphic owner/source, amounts, status, and optional legacy wallet transaction ID. Decimal(12,2); no unique financial identity or ledger link; no runtime writer/seed. | Preserve read-only compatibility model. Do not migrate or reinterpret rows as accruals. |
| `Referral` / `ReferralEvent` | Promoter/referral architecture exists separately, but no Phase 14 attribution writer is used. | Do not resolve referrals automatically. Promoter beneficiaries require an internal verified snapshot. |
| `PromoterProfile` | Existing profile is suitable only for owner existence checks performed by wallet provisioning. | Do not provision promoter payable accounts unless a valid promoter wallet is explicitly supplied. |
| `Store` / `DriverProfile` | Operational owner models; store owns orders, driver owns operational assignment state. | No store or driver earnings, payable releases, or status mutations. |
| `Order` / `PricingQuote` | `Order` holds `orderNumber`, `pricingQuoteId`, pricing subtotal/tax and a pricing snapshot. `PricingQuote` has immutable calculation version, subtotal, taxAmount, total, currency and snapshots. All amounts use Prisma Decimal. | Basis is resolved server-side from the linked quote and immutable pricing fields. No pricing calculation or order mutation is introduced. |
| `Payment` / `PaymentAttempt` | Payment is one-per-order and has successful receipt ledger evidence. Payment flows own their reconciliation and receipt accounting. | Phase 14 does not call, modify, or trigger payment flows. A future authorized settlement caller supplies a settlement version and event time. |
| `LedgerAccount` / `LedgerJournal` / `LedgerEntry` | Phase 9-13 immutable double-entry ledger. Accounts have wallet, purpose, category, currency, active state, projections and version. Journals are idempotent and support exact reversals. | Reuse transaction-aware posting and sorted account locks. Add only account purposes and journal types needed for commission semantics. |
| `Wallet` / `WithdrawalRequest` | Owner wallets and Phase 13 withdrawal reserve/payout controls exist. `OWNER_WITHDRAWABLE` is a later-release boundary. | Commission beneficiary money first credits `COMMISSION_PAYABLE`; no withdrawal or cash change is permitted. |
| `AuditLog` / status histories | Existing activity and financial histories are immutable evidence patterns. | Add commission-specific immutable status history; it is not an idempotency receipt. |

## Pricing evidence and basis contract

The authoritative courier-order values available today are `PricingQuote.id`, `PricingQuote.calculationVersion`, `PricingQuote.subtotal`, `PricingQuote.taxAmount`, `PricingQuote.total`, and `PricingQuote.currency`, linked by `Order.pricingQuoteId`; `Order.orderNumber` is the public subject reference. Phase 14 supports `ORDER_SUBTOTAL` and `ORDER_TOTAL`, ZAR only, with exact Decimal strings and `subtotal + tax = total` validation.

## Ledger map

The existing platform wallet is `PLATFORM/platform/ZAR`. Payment receipt posting credits platform `SETTLEMENT_CLEARING` (customer funds held) and debits `CASH_CLEARING`. Ledger posting locks accounts in ascending ID order, updates account projections atomically, makes idempotency key receipts stable, and supports one exact direct journal reversal. Phase 14 introduces `PLATFORM_REVENUE` for the canonical platform commission revenue account and `COMMISSION_PAYABLE` for owner liability accounts, plus `COMMISSION_ACCRUAL` and `COMMISSION_REVERSAL` journal types.

Accrual entries are: debit customer funds held for the total; credit platform commission revenue for platform components; credit beneficiary commission payable for beneficiary components. Reversal is the exact inverse. Cash clearing and owner-withdrawable accounts are excluded.

## Transaction map

1. Create draft: validate stable scope/rules, create a versioned DRAFT and rule rows.
2. Draft update: lock plan, permit only DRAFT changes, replace rules atomically.
3. Submit: validate all rule/plan constraints, transition DRAFT to UNDER_REVIEW.
4. Approve: enforce reviewer permission and creator/approver separation, transition UNDER_REVIEW to APPROVED.
5. Activate: enforce validation lock, approved status, rules, effective range, no active overlap and operation ID, then transition to ACTIVE.
6. Retire: lock active plan, transition to RETIRED without changing history.
7. Preview: use server-authoritative basis and calculation only; persist nothing.
8. Accrue: validate command and active effective policy; calculate canonically; in one serializable transaction enforce idempotency and settlement uniqueness, post ledger, create accrual/allocation/history evidence.
9. Replay: same operation hash returns the original receipt; changed semantic payload conflicts.
10. Reverse: lock accrual/allocation records, block released allocations, post exact inverse, mark evidence reversed and write history.
11. Reconcile: scanners open/upsert read-model cases; resolutions never change money outside canonical operations.

## Contract matrix

| Layer | Phase 14 alignment |
|---|---|
| Prisma/migration | New versioned policy, accrual, allocation, history, reconciliation models and additive legacy preservation. |
| Domain | State machine, exact calculator, basis validation, policy/ledger/idempotency rules. |
| Services | Internal preview/accrual/reversal; plan/query/reconciliation/account provisioning services. |
| Validation/DTO | Strict admin inputs, safe Decimal-string outputs, no write command for accrual. |
| APIs/UI | Permissioned policy lifecycle and read-only commission evidence; reversal accepts only reason/operation ID. |
| Fixtures/mocks/tests | Focused pure, service, API, integration and E2E scaffolds cover lifecycle and financial boundaries. |
| Scripts/docs | Preflight, invariant and reconciliation scan scripts plus deferred-risk documentation. |
