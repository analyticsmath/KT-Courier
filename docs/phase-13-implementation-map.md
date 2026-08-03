# Phase 13 Implementation Map

## Purpose and compatibility boundary

Phase 13 evolves the existing `WithdrawalRequest` placeholder; it does not introduce a second withdrawal aggregate. The baseline placeholder has no runtime writer, seed record, service, route, or test fixture that creates a withdrawal. Its `reviewedByUserId`, `bankName`, `accountHolder`, `accountLast4`, `rejectionReason`, `metadata`, `reviewedAt`, and `paidAt` columns are legacy Phase 4 compatibility columns. The Phase 13 Prisma model maps each physical column to a nullable `@ignore` field, so Prisma Client and runtime code cannot use it. The additive migration retains the physical legacy columns, requires existing placeholder rows to be absent, requires structured Phase 13 rows to leave them null, and introduces only opaque external references and masked destination metadata.

No Phase 13 service may write `Order`, `Payment`, `PaymentRefund`, dispatch, delivery, pricing, earnings, commission, wallet legacy balance fields, or platform revenue.

## Existing model inventory

| Model | Current shape and money | Relations, indexes, and runtime status | Phase 13 compatibility decision |
| --- | --- | --- | --- |
| `WithdrawalRequest` | Phase 4 placeholder: `withdrawalNumber`, `walletId`, optional requester/reviewer, `PENDING`/review/payment timestamps, `Decimal(12,2)` amount, string currency, and the eight legacy compatibility fields listed above. | Wallet and two optional User relations; unique withdrawal number; wallet/requester/reviewer/status/requested-time indexes. No runtime writer or seed row exists. | Evolve in place using `publicReference` mapped to `withdrawalNumber`; retain only opaque identity and safe lifecycle evidence. Every physical compatibility column has an exact nullable Prisma `@map(...) @ignore` mapping; preflight fails if any legacy row exists. |
| `Wallet` | Owner type/id, string ZAR currency, legacy `availableBalance`, `pendingBalance`, `lockedBalance` at `Decimal(12,2)`, status/version. | Unique `(ownerType, ownerId, currency)`; accounts, legacy transactions, withdrawals; owner/status/time indexes. Wallet/account services create active zero-balance wallets. | Reuse only as owner container. Ledger-account projections, never legacy wallet balances, are authoritative. |
| `LedgerAccount` | Exact `Decimal(18,2)` current/debit/credit projections; purpose, category, lifecycle, non-negative policy and optimistic version. | Wallet and immutable entries; unique code and `(walletId,purpose,currency)`; wallet/status and category/currency indexes. Posting service owns projection updates. | Add `OWNER_WITHDRAWABLE` and `WITHDRAWAL_HELD` purposes. Both must be active, ZAR, owner-wallet liability accounts with `allowNegative=false`. |
| `LedgerJournal` / `LedgerEntry` | Immutable exact-Decimal double-entry journal/entry records; unique idempotency key, reference and optional source reference. | Entries, creator, reversal, payment-success and webhook links; entry sequence and line-code uniqueness. `postLedgerJournalWithinTransaction` locks account IDs in sorted order, posts entries and projections atomically. | Add named reserve/release/payout journal types and one-to-one withdrawal links. No generic adjustment or fee/revenue entry is used. |
| `PaymentReconciliationCase` | Payment-scoped safe reconciliation aggregate with reason/status/priority, count and safe evidence. | Payment, attempt and webhook relations; query/read services and Phase 12 scanner are operational. | Separate `WithdrawalReconciliationCase`; do not reuse payment cases or mutate payments. |
| `Payment` | Provider-neutral payment aggregate with `Decimal(18,2)` amount, lifecycle, successful receipt/journal and reconciliation links. | User/order/attempt/history/webhook/reconciliation/refund relations. Phase 10–12 services are operational. | Read-only boundary. Phase 13 makes no payment or payment-reconciliation mutation. |
| `Store` | Store ownership/lifecycle/contact and location fields; no money fields. | Optional owner user, orders, addresses, subscriptions and commerce relations; unique slug and ownership/status indexes. Seed creates development stores. | A store owner must be resolved through active `ownerUserId` and active store; role alone is insufficient. |
| `DriverProfile` | Driver identity, active/onboarding/status/suspension and operational fields; no money fields. | One User owner, assignments/delivery operational relations; unique user/code and lifecycle indexes. Seed creates development drivers. | Driver eligibility requires active user plus active approved driver profile, owner wallet, account, policy and destination. |
| `PromoterProfile` | User-backed promoter identity/status and referral tree; no money fields. | One User owner and parent/children relations; unique user/code, status/time indexes. No Phase 13 earnings writer exists. | Promoter eligibility requires active user plus active promoter profile, owner wallet, account, policy and destination. |
| `User` | Authentication identity, role and `UserStatus`; no financial balance. | Ownership links for stores, drivers, promoters, ledgers and existing withdrawal requester/reviewer placeholders. Seed creates development user records. | User must be active. New requester, approver, processor, destination verification and reconciliation resolution relations are explicit and audit-safe. |
| `AdminActivityLog` | Repository equivalent of the requested `AuditLog`: actor/action/entity/message/safe metadata; no money. | Actor relation and actor/action/entity/time indexes; admin services are current writers. | Withdrawal lifecycle history remains its own immutable domain evidence. Optional general admin activity does not replace history or idempotency receipts. |
| `MediaAsset` | No `MediaAsset` Prisma model exists in the current schema. | No relation, writer, seed record, fixture, or compatibility dependency found. | No media/evidence upload model is introduced. Phase 13 accepts only bounded safe evidence references. |

## Existing finance account map

`LedgerAccountPurpose` currently contains `AVAILABLE`, `PENDING`, `HELD`, `CASH_CLEARING`, `SETTLEMENT_CLEARING`, `PLATFORM_REVENUE`, `ADJUSTMENT`, `SUSPENSE`, and `OPENING_BALANCE_CONTROL`. `LedgerJournalType` currently contains `GENERAL`, `ACCOUNT_TRANSFER`, `OPENING_BALANCE`, `REVERSAL`, and `EXTERNAL_PAYMENT_RECEIPT`.

| Account/purpose | Current or Phase 13 role | Normal-side calculation and uniqueness |
| --- | --- | --- |
| `OWNER_WITHDRAWABLE` | New owner-wallet liability: the available amount later allocation phases may make withdrawable. | Credit-normal liability; unique `(wallet,purpose,ZAR)`; never negative. |
| `WITHDRAWAL_HELD` | New owner-wallet liability: funds reserved for an open withdrawal. | Credit-normal liability; unique `(wallet,purpose,ZAR)`; never negative. |
| `CASH_CLEARING` | Existing platform-wallet asset used by Phase 12 receipts and Phase 13 payout completion. | Debit-normal asset; unique `(wallet,purpose,ZAR)`; expected to remain non-negative. |
| `HELD` | Existing platform customer-funds-held liability used for payment receipts. | Credit-normal liability. It is explicitly not a withdrawal funding account. |
| `ADJUSTMENT` / `SUSPENSE` | Existing controlled ledger purposes. | No Phase 13 withdrawal journal may use either. |

Ledger normal-side calculations and projection mutation are owned by `calculateAccountProjection` and `postLedgerJournalWithinTransaction`. The latter locks ledger accounts in ascending ID order, validates account policy, inserts immutable journal/entries, and applies optimistic projection versions in one transaction.

## Transaction map

| Operation | Reads and locks (in order) | Journal / state / history / receipt | Rollback boundary |
| --- | --- | --- | --- |
| Create and reserve | Owner/user/profile/wallet/policy/destination/accounts, then withdrawal idempotency; lock wallet context and domain receipt, then ledger accounts by ascending ID. | One `WithdrawalRequest` receipt, `WITHDRAWAL_RESERVE` (debit withdrawable, credit held), `REQUESTED`, requested/reserved history. Creation key is the durable receipt. | Request, journal, entries, projections, link and history all roll back. |
| Owner cancel | Lock withdrawal, verify owner/status/no payout or release, then held/withdrawable accounts sorted. | `WITHDRAWAL_RELEASE` (debit held, credit withdrawable), release link, `CANCELLED`, histories. | No release or terminal status remains on failure. |
| Finance reject | Lock withdrawal, authorize reviewer and reason, then held/withdrawable accounts sorted. | Same release journal, release link, `REJECTED`, reviewer and histories. | Journal and rejection are indivisible. |
| Review/approve | Lock withdrawal; recheck destination, policy, ownership and reserve coherence. | No journal; `UNDER_REVIEW` or `APPROVED`, actor/time and history. | No partial review/approval evidence. |
| Start payout | Lock withdrawal, allocate `latestAttemptNumber + 1`, check actor separation and active destination. | One attempt idempotency receipt, attempt `RESERVED` then `PROCESSING`, withdrawal `PROCESSING`, history; no journal. | Attempt and processing state roll back together. |
| Definite failure | Lock withdrawal and processing attempt. | Attempt `FAILED`, withdrawal `APPROVED`, safe failure evidence/history; held funds remain held. | No release or failed state remains on failure. |
| Unknown outcome | Lock withdrawal and processing attempt. | Attempt `UNKNOWN`, withdrawal `RECONCILIATION_REQUIRED`, idempotent withdrawal reconciliation case and history; held funds remain held. | No unknown state/case remains on failure. |
| Complete manual payout | Lock withdrawal then attempt; validate maker-checker, reserve/no release/no payout, then held and platform cash accounts by ascending ID. | `WITHDRAWAL_PAYOUT` (debit held, credit cash clearing), external reference, attempt `SUCCEEDED`, withdrawal `PAID`, payout link, resolved case/history. Completion key is durable receipt. | Journal, entries, projections, evidence, state and case resolution roll back together. |
| Reconciliation resolution | Lock case/withdrawal/attempt and call either the normal failure/cancellation path or normal payout-completion path. | Never a generic mark-paid action. | The invoked normal operation owns the atomic boundary. |

## Route and UI map

| Route | Method / authorization | Validator and safe response | UI contract / locator |
| --- | --- | --- | --- |
| `/api/withdrawals` | GET/POST; active owner only | list/create schemas; exact money strings, masked destination, no account IDs | `/account/withdrawals`, `h1` **Withdrawals**, `withdrawals-table`, labelled amount/destination form. |
| `/api/withdrawals/[publicReference]` | GET; owning active user only | public-reference schema; owner-safe detail/history | `/account/withdrawals/[publicReference]`, `withdrawal-history`. |
| `/api/withdrawals/[publicReference]/cancel` | POST; owning active user only | operation-key schema; safe cancellation result | labelled `Cancel withdrawal` action only when cancellable. |
| `/api/payout-destinations` | GET; active owner only | query schema; masked active destinations only | `/account/payout-destinations`, `payout-destinations-table`. |
| `/api/admin/finance` | GET; `finance_dashboard.read` | finance query schema and exact-money DTO | `/admin/finance`, `h1` **Finance Overview**, `finance-overview-metrics`. |
| `/api/admin/withdrawals*` | GET and named POST actions; exact finance permission | per-action strict schemas, operation IDs, safe errors | `/admin/withdrawals`, `h1` **Withdrawals**, `finance-withdrawals-table`; detail uses valid-state actions only. |
| `/api/admin/payout-destinations*` | GET/POST named lifecycle actions; read/manage permissions | opaque reference and masked metadata schema only | `/admin/payout-destinations`, `h1` **Payout Destinations**, `payout-destinations-admin-table`. |
| `/api/admin/withdrawal-reconciliation*` | GET; `withdrawals.reconcile` | read-only safe query DTO | `/admin/withdrawal-reconciliation`, `h1` **Withdrawal Reconciliation**, `withdrawal-reconciliation-table`. |

All mutations enforce authentication, explicit DENY-aware permission checks where applicable, same-origin validation, JSON content type and bounded body, rate limits, an operation ID, and safe errors. There are no DELETE routes, arbitrary status routes, bank-detail forms, or ledger controls.

## Contract matrix

| Layer | Phase 13 alignment |
| --- | --- |
| Prisma / migration | Evolve the existing aggregate, add destination, policy, attempts, histories and reconciliation; preserve the eight legacy placeholder columns physically through documented ignored Prisma mappings; add additive null-only compatibility, lifecycle, and immutability constraints. |
| Domain / service | Explicit state machines, owner/dual-control/production-lock policies and serializable atomic service operations using the Phase 9 transaction-aware posting primitive. |
| Validation / DTO | Strict command/query schemas and string-money, opaque-reference, masked-only DTOs. |
| API / UI | Ownership or exact permission authorization; same-origin/rate/body protections; accessible semantic tables and exact headings. |
| Seed / fixtures / mocks | Disabled policies and permissions only; zero balances/no financial evidence; transaction mocks include every lock, post, projection and history action. |
| Scripts / documentation | Preflight, invariant and reconciliation scan scripts; deferred PostgreSQL/browser/CI scaffolding; finance, security and risk documentation. |
