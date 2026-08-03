# Phase 9 wallet ledger system

Phase 9 introduces the accounting foundation for KT Couriers. It does not activate a payment, refund, earnings, commission, settlement, or withdrawal workflow.

## Scope

The implementation provides owner wallets, ledger accounts, immutable journals and entries, strict ZAR money, current account projections, idempotent posting, deterministic row locking, bounded Serializable retry, non-negative enforcement, reversals by new journals, reconciliation scripts, and a permission-gated read-only admin interface.

Explicit non-goals are payment-provider integration, payment capture, top-ups, refunds, store/driver/promoter earnings, platform commission calculation, withdrawals, bank payouts, settlement, order-completion posting, delivery-completion posting, user-facing wallet balances, manual adjustments, and any public ledger write API.

## Wallets and accounts

The existing polymorphic `Wallet` model is reused. The tuple `ownerType + ownerId + currency` remains unique. Owner IDs resolve to customer users, stores, driver profiles, promoter profiles, or the single `PLATFORM/platform` owner.

`LedgerAccount` is the accounting bucket inside a wallet. Each account has a stable unique code, purpose, category, ZAR currency, status, non-negative policy, balance projection, cumulative debit and credit totals, and a version. Wallet + purpose + currency is unique.

The old wallet `availableBalance`, `pendingBalance`, and `lockedBalance` fields are deprecated zero-only compatibility fields. They are not updated by Phase 9. `LedgerAccount.currentBalance` is the sole current-balance projection; `LedgerEntry` rows are the canonical evidence.

## Posting transaction

`postLedgerJournal` validates and normalizes strict decimal strings and metadata, sorts entries, calculates a canonical SHA-256 request hash, and opens a Serializable transaction. The transaction resolves idempotency, locks distinct accounts by ascending ID with parameterized SQL, re-reads account/wallet state, enforces status/currency/balance policies, creates exactly one journal and all entries, then updates all projections and versions before commit.

There is no network, email, notification, provider, or HTTP operation in this transaction. A thrown error rolls back the journal, entries, projection updates, and unique posting receipt together.

## Idempotency and concurrency

One posting command creates one journal. `LedgerJournal.idempotencyKey` is unique and `requestHash` captures normalized financial meaning. The same key and hash returns the existing journal. The same key with a different hash returns `LEDGER_IDEMPOTENCY_CONFLICT`.

Every multi-account posting locks accounts in ascending `LedgerAccount.id` order, regardless of input order or direction. Only Prisma/SQL serialization failures, deadlocks, and explicit retryable write conflicts are retried, with a finite retry count. Validation, status, currency, idempotency, and insufficient-balance failures are not retried.

## Account and journal policy

Account statuses are `ACTIVE`, `FROZEN`, and `CLOSED`. Only active accounts post. `allowNegative` defaults to false and is not caller-controlled. Seeded platform control accounts also remain non-negative.

Every final journal has one currency, at least two entries and two accounts, positive exact two-decimal amounts, unique line codes, no duplicate account/direction line, no account on both sides, and equal non-zero debit and credit totals.

## Reversals and immutability

A reversal is a new journal produced through the canonical posting service. It inverts every original direction, preserves account and amount, links to the original with a unique self-relation, and obeys normal status and non-negative rules. The original is not edited. Reversal-of-reversal and a second direct reversal are rejected in Phase 9.

No application service updates or deletes `LedgerJournal` or `LedgerEntry`. Database migrations and disposable test setup are separately controlled contexts.

## Legacy data migration

The Phase 9 migration is additive and retains all previous migrations and Phase 4 finance placeholders. Before creating ledger tables, it fails closed if it finds a non-zero legacy wallet balance, a legacy wallet transaction, or a non-ZAR wallet. Supported zero-balance wallets are not given fake opening entries.

If real non-zero legacy value is discovered, migration must stop until its semantics are known and an architect-approved balanced opening journal against a platform control account is designed. Values must never be copied directly into a projection.

## Provisioning and seed

`ensureWalletForOwner`, `ensureLedgerAccount`, and `getWalletAccount` are internal, idempotent helpers. Unique constraints are the concurrency backstop. Accounts start at zero; non-zero initialization is not accepted.

The development seed creates the existing platform ZAR wallet plus zero-balance cash-clearing and adjustment/control accounts. It verifies canonical definitions and refuses a non-zero projection without entry evidence. It also registers and grants `ledger.read`. No financial workflow is activated.

## Metadata and security

Metadata must be a bounded plain JSON object. Key count, nesting depth, and serialized size are capped. Keys associated with passwords, tokens, authorization, sessions, OTPs, card data, bank details, request bodies, and private notes are rejected. Query DTOs defensively redact stored metadata that fails the policy. Request hashes are not returned by admin APIs.

No `NEXT_PUBLIC_*` variable changes posting, balance, status, idempotency, or authorization behavior. No finance test bypass exists.

## Read-only administration

`ledger.read` is enforced at both page and API boundaries; SUPER_ADMIN behavior and explicit DENY precedence come from the established permission system.

Available GET routes are `/api/admin/ledger/accounts`, `/api/admin/ledger/accounts/[id]`, `/api/admin/ledger/journals`, and `/api/admin/ledger/journals/[id]`. Available pages are `/admin/ledger`, `/admin/ledger/accounts/[id]`, and `/admin/ledger/journals/[id]`.

The interface provides labelled filters, stable pagination, empty/loading/error states, semantic tables, string-based ZAR display, server-derived balancing, and reversal relation links. There are no credit, debit, transfer, reversal, or balance-edit controls.

## Verification and extension points

`db:preflight:ledger` checks the legacy migration state without exposing owner details. `db:verify:ledger` recomputes journal/account invariants from immutable evidence and source-audits Phase 8 delivery non-posting. The disposable integration suite covers balanced posting, rollback, idempotency, double-spend prevention, lock ordering, reversals, invariant detection, seed stability, and cross-module non-posting.

Later phases may provision accounts and call the internal posting/transfer/reversal services with named business semantics. They must not write account projections or entries directly. No real payment, earnings, commission, refund, withdrawal, or order/delivery posting is active in Phase 9.

