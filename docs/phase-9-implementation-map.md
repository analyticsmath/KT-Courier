# Phase 9 implementation map

This map was completed before Phase 9 production changes. It records the inspected Phase 4 finance placeholders, the intended schema/service/UI contracts, and the transaction boundaries that Phase 9 must preserve.

## Existing financial-model inventory

The active migration chain contains the Phase 4 finance foundation in `20260710010000_initial_baseline`. Repository-wide runtime searches found no Prisma writes for the finance models below except the idempotent zero-balance platform-wallet upsert in `prisma/seed.ts`.

| Model or concept | Ownership / relation | Currency and balance fields | Status / transaction relation | Constraints and indexes | Runtime / seed / classification |
|---|---|---|---|---|---|
| `Wallet` | Polymorphic `ownerType` + `ownerId`; withdrawals and legacy transactions | `currency`; `availableBalance`, `pendingBalance`, `lockedBalance` as `Decimal(12,2)` | `RecordStatus`; has `WalletTransaction[]` | unique owner type + owner id + currency; owner, status, created indexes | No runtime writer. Seed upserts one `PLATFORM/platform/ZAR` wallet at zero. Reused as the Phase 9 owner container; legacy balances become zero-only deprecated compatibility fields, never a posting source of truth. |
| `WalletTransaction` | belongs to `Wallet`; optional creating `User` | `currency`, `amount`, optional `balanceBefore`/`balanceAfter` | direction/type/status fields | unique optional idempotency key; wallet, direction, type, status, reference, creator, created indexes | No runtime writer and no seed rows. Phase 4 future-workflow placeholder. Preserved for compatibility, explicitly deprecated, and not used by Phase 9 posting. |
| `Payment` | optional `User` and `Order`; owns attempts, webhooks and refunds | `currency`, `amount` | `PaymentStatus` | unique payment number and optional idempotency key; user/order/provider/purpose/status/created indexes | No runtime writer or seed rows. Future payment placeholder; not connected to the ledger. |
| `PaymentAttempt` | belongs to `Payment` | `currency`, `amount` | `PaymentAttemptStatus` | payment/provider/status/created indexes | No runtime writer or seed rows. Future payment-provider placeholder. |
| `PaymentRefund` | belongs to `Payment`; optional creating `User` | `currency`, `amount` | reuses `PaymentStatus` | payment/status/creator/created indexes | No runtime writer or seed rows. Future refund placeholder; no Phase 9 posting. |
| `WithdrawalRequest` | belongs to `Wallet`; optional requester/reviewer users | `currency`, `amount` | `WithdrawalStatus` | unique withdrawal number; wallet/requester/reviewer/status/requested indexes | No runtime writer or seed rows. Future withdrawal placeholder; no Phase 9 posting. |
| `CommissionRule` | optional polymorphic owner; optional creating `User` | `value` is `Decimal(12,4)`; no currency field | active flags and effective dates; has commission transactions | type, owner, default, active and created indexes | No runtime writer or seed rows. Future commission configuration placeholder. |
| `CommissionTransaction` | polymorphic owner; optional rule; unbound `walletTransactionId` string | `currency`, `baseAmount`, `commissionAmount` | `CommissionTransactionStatus` | rule, owner, source, status and created indexes | No runtime writer or seed rows. Future commission placeholder; not ledger evidence. |
| `WalletEntry` | absent | absent | absent | absent | No duplicate will be introduced. |
| `Ledger` | absent | absent | absent | absent | `LedgerJournal` is introduced as the atomic posting record. |
| `LedgerEntry` | absent | absent | absent | absent | Introduced as immutable double-entry evidence. |
| `Refund` | no generic model | see `PaymentRefund` | see `PaymentRefund` | see `PaymentRefund` | No second refund concept added. |
| `StoreEarning`, `DriverEarning`, `PromoterEarning`, `Settlement` | absent | absent | absent | absent | Later-phase concepts; not introduced. |
| `Balance` | no standalone model | legacy wallet fields noted above | none | none | Canonical Phase 9 projection will be `LedgerAccount.currentBalance`; evidence remains immutable entries. |
| `Currency` | no Prisma enum | finance placeholders use `String` defaulting to `ZAR` | none | no currency constraint | Phase 9 adds a constrained `LedgerCurrency` enum with only `ZAR`; old models stay compatible. |
| `Money` | no model | Prisma `Decimal` is used in schema and pricing has a separate rounding-oriented helper | none | database precision by field | Phase 9 adds a strict two-decimal ledger value object that rejects numbers and implicit rounding. |

No `Wallet`, `WalletTransaction`, `Payment`, `PaymentAttempt`, `PaymentRefund`, `WithdrawalRequest`, `CommissionRule`, or `CommissionTransaction` write was found in application services or routes. The only existing financial seed write creates/activates the foundation platform wallet and relies on zero defaults.

## Schema-contract matrix

| Phase 9 concept | Prisma model / enum | Domain type | Service input / output | Validation schema | API DTO | Admin UI | Test mock | Migration contract |
|---|---|---|---|---|---|---|---|---|
| Currency | `LedgerCurrency.ZAR` | `LedgerCurrencyCode = "ZAR"` | posting and provisioning accept ZAR only; outputs serialize `"ZAR"` | literal ZAR | string literal | displayed as ZAR | literal strings | `LedgerCurrency` PostgreSQL enum |
| Money | Decimal columns | immutable `LedgerMoney` operations | decimal strings in; canonical fixed two-decimal strings out | strict decimal-string schema | strings only | formatted from strings without authoritative arithmetic | string fixtures / Prisma Decimal DB mocks | `DECIMAL(18,2)` and positive entry check |
| Wallet | evolved `Wallet` with `version` and `accounts` | owner type/id/currency/status | `ensureWalletForOwner`, `getWalletAccount`; zero-start results | internal owner/currency schema | safe owner summary only | owner type plus redacted label/id | wallet transaction delegate mock | additive version column; existing uniqueness retained; legacy non-zero preflight |
| Account | `LedgerAccount`; category/purpose/status enums | account snapshot and derived normal side | ensure input excludes balances/overdraft override; posting result has string projections | internal create and admin query schemas kept separate | account list/detail DTOs | dashboard and account detail | account find/create/update/lock mocks | account table, unique code, unique wallet+purpose+currency, status/category indexes |
| Journal | `LedgerJournal`; journal type enum | normalized immutable posting and snapshot | one posting command -> one journal result | internal posting schema | list/detail DTO; request hash omitted | journal list/detail | journal lookup/create mocks | unique reference, idempotency key, source reference and reversal target; balanced-total check |
| Entry | `LedgerEntry`; direction enum | normalized immutable line | caller supplies account/direction/amount/line code/memo; output strings | internal entry schema | detail rows and account-entry rows | semantic debit/credit columns | createMany and query mocks | positive amount and positive sequence checks; per-journal sequence and line-code uniqueness |
| Idempotency | journal fields | canonical normalized hash payload | required key; same hash replays, changed hash conflicts | bounded normalized key | never writable via API; hash hidden | no hash display | existing-journal race mocks | unique `idempotencyKey`, non-empty `requestHash` |
| Reversal | journal self-relation | inversion policy | original id + new key + actor; canonical post output | internal reversal schema | original/reversal references only | relation links | original/reversal lookup mocks | unique nullable `reversalOfJournalId`, no self-reference check |
| Metadata | journal JSON | safe JSON object | sanitized, bounded object only | depth/key/size/sensitive-key policy | sanitized metadata only | safe structured rendering | malicious-key fixtures | JSONB; application policy is authoritative |
| Pagination/filtering | n/a | deterministic page/query types | query service inputs and outputs | dedicated account/journal query schemas | `{data,pagination}` | labelled GET forms and links | query/count mocks | supporting compound indexes |
| Permission | existing `Permission` rows | `PERMISSIONS.LEDGER_READ` | required at page/API boundary | n/a | 401/403/404 fail-closed responses | page redirects when denied | auth/permission mocks | seed upsert through permission registry |

Changed Prisma fields and models must be reflected in `types/db.ts`, ledger domain types, validation, services, DTOs, routes, pages/components, seed constants, transaction mocks, schema tests, migration SQL, and Phase 9 documentation in the same implementation.

## Transaction-boundary map

All listed writes use the existing Prisma client. No network, email, notification, provider, or HTTP operation occurs inside a financial transaction.

| Operation | Rows read / locked (in order) | Inserts / updates | Conflicts and failure policy | Post-commit behavior |
|---|---|---|---|---|
| Wallet creation | Validate owner existence before the transaction; lookup wallet by owner tuple. The unique index is the concurrency backstop. | Insert a zero-balance wallet with version 0 only when absent. | Invalid owner/status is non-retryable. Unique race re-reads the winner. No direct non-zero initialization. | Return an immutable wallet snapshot. |
| Ledger-account creation | Read wallet, validate active/ZAR, lookup wallet+purpose+currency. | Insert account at zero for balance/debit/credit totals and version 0. | Invalid wallet/category/purpose is non-retryable. Unique code or purpose race re-reads a semantically matching winner; mismatches conflict. | Return immutable account snapshot. |
| Journal posting | Before transaction: validate, sanitize, normalize, sort, hash. In a Serializable transaction: read journal by idempotency key; select distinct account IDs in ascending lexical order with parameterized `FOR UPDATE`; re-read authoritative accounts in that same order. | Insert exactly one final journal, all entries, then conditionally update each account projection/totals/version. | Existing same key/hash replays; different hash conflicts. Missing/frozen/closed/currency/unbalanced/overdraft errors never retry. Recognized serialization/deadlock/write conflicts retry a bounded number of times. | Return the committed journal DTO; no side effects. |
| Projection updates | Locked account rows only; aggregate normalized lines per account. | Update `currentBalance`, `debitTotal`, `creditTotal`, `version`, `updatedAt` in the journal transaction; conditional expected version guards stale writes. | A failed conditional update becomes a retryable posting-concurrency conflict. Any semantic failure rolls back journal, entries, and all projections. | DTO is built from committed/re-read evidence. |
| Idempotent replay | Read the unique journal receipt and its ordered entries/account snapshots; no account locks when the receipt already exists. | None. | Same hash succeeds. Different hash is `LEDGER_IDEMPOTENCY_CONFLICT`. A unique race after another transaction commits re-reads outside the failed transaction. | Return the same journal identity/reference and canonical values. |
| Reversal | Load original with ordered entries; verify it is not a reversal and has no direct reversal. Canonical posting then locks affected accounts in ascending ID order. | Insert one new inverse journal and inverse entries; update projections through canonical posting only. Original is untouched. | Missing, reversal-of-reversal, second reversal, frozen/closed account, or negative projection is non-retryable. Concurrent same reversal key replays; unique reversal target race is re-read/controlled. | Return new reversal and relation references. |
| Concurrent posting | Each attempt uses Serializable isolation and identical sorted account locking. | Same as journal posting. | Retry only `P2034`, SQLSTATE `40001`, or `40P01`, bounded to three retries after the first attempt. Opposite caller line order cannot change lock order. | Winner(s) return committed snapshots; exhausted conflicts return typed concurrency error. |
| Rollback | All journal, entry, and projection work is inside one Prisma interactive transaction. | None survive a thrown error. | Failed transaction does not consume idempotency, source reference, or reversal uniqueness. | No external cleanup or notification. |
| Invariant verification | Read-only aggregate queries over wallets, accounts, journals and entries; no locks required for the offline verifier. | None. | Any mismatch exits non-zero without printing sensitive owner or metadata values. | Human-safe counts and invariant names only. |

The canonical lock order is always ascending `LedgerAccount.id`, independent of caller entry order or debit/credit direction.

## Route and UI contract map

No Phase 9 mutation route exists. Next.js 16 dynamic route `params` are promises and are awaited.

| Canonical route | Method / permission | Request schema | Response DTO | UI consumer and states | Stable E2E locator |
|---|---|---|---|---|---|
| `/api/admin/ledger/accounts` | GET / `ledger.read` | strict account query: page, pageSize, code, ownerType, purpose, category, currency, status, nonZero | paginated safe account summaries with money strings | `/admin/ledger` account section; labelled filters, pagination, explicit empty/error messaging | heading `Ledger`; region/table `Ledger accounts`; labels `Account purpose`, `Account status` |
| `/api/admin/ledger/accounts/[id]` | GET / `ledger.read` | awaited string id plus strict entry page/pageSize | account summary + safe owner + paginated ordered entries | `/admin/ledger/accounts/[id]`; not-found handled as inaccessible, empty entry state and pagination | heading `Ledger account`; table name `Account entries` |
| `/api/admin/ledger/journals` | GET / `ledger.read` | strict journal query: dates, reference, type, source, account, reversal state, correlation, page/pageSize | paginated summaries with server totals and reversal refs | `/admin/ledger` journal section; labelled filters, pagination, explicit empty/error messaging | heading/table `Ledger journals`; labels `Journal type`, `Journal reference` |
| `/api/admin/ledger/journals/[id]` | GET / `ledger.read` | awaited string id | journal summary, `balanced` from server, all ordered entries, safe metadata and reversal/original refs | `/admin/ledger/journals/[id]`; not-found and safe metadata empty state | heading `Ledger journal`; table name `Journal entries`; status text `Balanced journal` |
| `/admin/ledger` | GET page / `ledger.read` | URL search parameters validated by query service; malformed values render an error state | server component receives query DTOs directly | account and journal summaries, filters, independent pagination, loading via navigation, empty/error states | exact page heading `Ledger` |
| `/admin/ledger/accounts/[id]` | GET page / `ledger.read` | awaited id and search params | server query DTO | projection is displayed, never recomputed; entry pagination | exact heading `Ledger account` |
| `/admin/ledger/journals/[id]` | GET page / `ledger.read` | awaited id | server query DTO | totals/balanced flag are rendered from server; relation links; safe metadata | exact heading `Ledger journal` |

API errors use 400 for malformed queries, 401 for unauthenticated, 403 for missing/explicitly denied permission, 404 for inaccessible records, and 503 for temporary query failures. Unsupported write methods remain absent and therefore receive Next.js 405 behavior.

## Migration-state declaration

Currently present, accepted migration directories are:

1. `20260710010000_initial_baseline`
2. `20260711010000_phase6_pricing_engine_v1`
3. `20260711020000_phase7_dispatch_hardening_v1`
4. `20260716010000_phase7_5_phase6_phase7_closure`
5. `20260716020000_phase8_driver_operations_hardening`

All five are immutable. The one new migration is `20260717010000_phase9_wallet_ledger_system`.

The schema contains legacy wallet-level `availableBalance`, `pendingBalance`, and `lockedBalance` fields, all defaulting to zero. They are not written at runtime and are classified as deprecated compatibility fields, not canonical or independently writable projections. `LedgerAccount.currentBalance` is the only current-balance projection Phase 9 services update; immutable `LedgerEntry` rows are the evidence.

`WalletTransaction` is an unused future-workflow placeholder, not a double-entry journal and not a Phase 9 posting path. The migration preflight fails closed when any legacy wallet balance is non-zero or any legacy wallet transaction exists. Supported zero-balance wallets receive zero-balance accounts only and no fabricated opening entries. Unknown non-zero legacy data is neither overwritten nor copied; it blocks migration with a clear error so an architect-approved balanced opening-journal backfill can be designed from known semantics.

No migration is executed during this implementation task.
