# Phase 16 Store Earnings — Implementation Map

Status: completed before the Phase 16 Prisma/schema change. Phase 16 is an implementation-only financial foundation. It remains source-locked and has no marketplace, store-order, public accrual, or store release writer.

## Scope and compatibility decisions

- Use the existing `Store` as the canonical store identity. `StoreProfile` is a signup/profile companion and is not a financial owner.
- Use the existing unique `Wallet(ownerType, ownerId, currency)` with `ownerType = STORE`, `ownerId = Store.id`, and `currency = ZAR`. Do not create a store wallet aggregate.
- Add a new `StoreEarning` aggregate because no store-earning or settlement placeholder exists in Prisma, migrations, runtime writers, seeds, or fixtures.
- Reuse Phase 9 `LedgerAccount`, `LedgerJournal`, `LedgerEntry`, and the transaction-aware posting primitive. Store payable and owner-withdrawable balances are ledger projections, never legacy `Wallet` balances.
- Extend, rather than reinterpret, Phase 14 `CommissionAllocation` with the exact `storeAttributedAmount` projection and immutable charge links.
- Extend Phase 15 `RefundFundingAllocation` with an optional store-earning relation. Generic payment refunds remain unable to infer store funding.
- Do not mutate `Order`, `PricingQuote`, `Payment`, commission policy, or prior migrations. Future marketplace and store-order phases must supply authoritative immutable store-level evidence.

## Existing model inventory

### `Store`

| Item | Existing contract | Phase 16 use |
| --- | --- | --- |
| Fields | `id`, nullable `ownerUserId`, name/slug, `StoreStatus`, contact/address/featured fields, timestamps, default pickup relation | Canonical store ID and public reference (`slug`); require exactly one active store owned by an active STORE user. |
| Status | `PENDING`, `ACTIVE`, `SUSPENDED`, `DISABLED` | Accrual/account provisioning/release require `ACTIVE`; reads require exact ownership and an active owner session. |
| Relations | Owner User, orders, addresses, subscriptions, products/cart/order items, promotions and ads | Add wallet-independent `StoreEarning[]`; no marketplace/order relation is invented. |
| Constraints/indexes | Unique `slug`; indexes on owner, status, pickup, featured | Financial ownership is resolved by `ownerUserId`; store settlement identity adds a separate database unique key. |
| Writers | Store signup creates `StoreProfile` and `Store`; admin store services update safe store state; fixture setup upserts isolated stores | Phase 16 does not create or update Store. |

### `StoreProfile`

- Fields: unique `userId`, display/contact fields, its own `StoreStatus`, timestamps and User relation.
- Written by signup/profile services. It has no wallet, ledger, order, or financial authority.
- Phase 16 uses `Store`, not `StoreProfile`, for financial ownership. Profile text may be used only as a safe display fallback.

### `Wallet`

- Fields: owner type/ID, string ZAR currency, legacy `availableBalance`, `pendingBalance`, `lockedBalance` Decimal(12,2), record status, optimistic version and timestamps.
- Unique `(ownerType, ownerId, currency)`; indexed by owner/status/time; relations to transactions, withdrawal destinations/requests and ledger accounts.
- Provisioned through `ensureWalletForOwner`; platform wallet is seeded. A store wallet is not automatically created at signup.
- Phase 16 account provisioning requires an already-existing active canonical STORE wallet. It does not inject balance or create a wallet implicitly.

### `LedgerAccount`

- Fields: wallet/code/purpose/category/currency/status, `allowNegative`, exact Decimal(18,2) current/debit/credit projections, version/timestamps.
- Unique code and unique `(walletId, purpose, currency)`; account relations cover ledger entries, withdrawal sources/holds, commission allocations and refund funding.
- Written by canonical provisioning services and projection updates inside `postLedgerJournalWithinTransaction` only.
- Add `STORE_EARNINGS_PAYABLE` as an active ZAR LIABILITY with credit normal side and `allowNegative = false`; add StoreEarning payable relation.

### `LedgerJournal` / `LedgerEntry`

- Journal identity is unique by reference/idempotency key/source reference and optional reversal link. Exact Decimal(18,2) totals, policy version, safe metadata, actor and timestamps are retained.
- Entries are immutable exact direction/amount lines with unique sequence and line code per journal.
- `postLedgerJournalWithinTransaction` acquires account locks in ascending ID order, verifies owner/account policy, creates journal/entries and updates projections atomically.
- Add dedicated `STORE_EARNING_ACCRUAL`, `STORE_EARNING_RELEASE`, and `STORE_EARNING_REVERSAL` journal types and one-to-one evidence links.

### `CommissionAccrual`

- Immutable subject/settlement/plan/basis/calculation evidence, Decimal(18,2) amounts, unique operation and journal links, optional reversal, status/history/reconciliation.
- Statuses: `ACCRUED`, `REVERSED`, `RECONCILIATION_REQUIRED`.
- Written only by internal commission accrual/reversal services; no seeded accrual evidence.
- Phase 16 reads an attributable accrual through its allocations and requires coherent prior commission treatment. Store reversal is blocked while attributable commission remains economically active when the settlement is invalidated.

### `CommissionAllocation`

- Fields: immutable accrual/rule/allocation/beneficiary/account identity, amount Decimal(18,2), currency/status, attribution metadata and optional downstream release journal.
- Unique public reference and downstream journal; unique accrual/rule/beneficiary-wallet tuple; indexed by accrual and beneficiary/status.
- Written by commission accrual/reversal flows. Refund funding already links exact commission allocations.
- Add `storeAttributedAmount Decimal(18,2) default 0` and charge relations. Runtime Phase 16 accrual is the only incrementer. The projection remains non-negative and cannot exceed original `amount`; allocation status does not change on attribution.

### `Payment`

- Fields include mapped public reference, customer/order/provider/purpose/status, amount and refund projections Decimal(18,2), ZAR currency, idempotency/version, verified success attempt/webhook/journal evidence and reconciliation state.
- Unique order, operation key and verified evidence links; indexed by owner/order/provider/status/reconciliation/time.
- Written by payment preparation/provider/verified ITN/reconciliation services. Phase 16 never changes Payment or Order status/projections.
- Store accrual requires `SUCCEEDED`, verified attempt/webhook/receipt journal evidence, ZAR, and the exact supplied Payment identity. Store basis is never inferred from Payment amount.

### `PaymentRefund`

- Dedicated Phase 15 refund aggregate with exact amount, lifecycle status, reserve/release/completion journals, customer/finance actors, attempts, allocations, history and reconciliation.
- Legacy placeholder columns are retained as ignored physical compatibility fields.
- Written by canonical Phase 15 request/review/completion/provider services.
- Phase 16 adds only store-level projection coordination through stored funding allocations; it does not change generic API inference or provider behavior.

### `RefundFundingAllocation`

- Immutable public reference, refund/source/account, optional commission links, exact Decimal(18,2) amount and ZAR currency.
- Unique refund/commission-allocation link; indexed by refund/source/account/commission evidence.
- Written inside Phase 15 refund reservation and used verbatim for cancellation/completion.
- Add nullable `storeEarningId`. It is required only for `STORE_EARNINGS_PAYABLE`, prohibited for other sources, unique per refund/earning, and must point to the earning's payable account.

### `WithdrawalRequest`

- Owner/wallet/source/held/destination identity, exact Decimal(18,2), lifecycle, unique operation/journals, maker-checker actors, histories and reconciliation.
- `OWNER_WITHDRAWABLE` is its only source; canonical withdrawal services require pre-provisioned owner accounts and never read legacy Wallet balances.
- Phase 16 release credits the store wallet's existing active `OWNER_WITHDRAWABLE`; it never creates a withdrawal or changes withdrawal execution.

### `Order`

- Courier-delivery aggregate with order number, customer/store ownership, independent operational status, delivery/pricing fields and relations to Payment and `PricingQuote`.
- Written by order, dispatch, pickup/custody and delivery services.
- Phase 16 does not use Order status as settlement/release evidence and never writes Order. `MARKETPLACE_ORDER` is opaque and does not create or reuse this courier-order state machine.

### `PricingQuote` (actual repository name; no `OrderQuote` model)

- Immutable calculation version/hash/snapshots, owner/store context, route evidence, exact Decimal subtotal/tax/total and expiry/use lifecycle.
- Written by pricing services and linked one-to-one from Order.
- Phase 16 does not infer marketplace seller basis from it. Future marketplace settlement supplies an independent pricing/settlement reference.

### Audit evidence (actual names)

- There is no `AuditLog` model. `AdminActivityLog` stores general safe admin action/entity/message/metadata evidence; `PricingAuditLog` is pricing-specific.
- Store earning lifecycle authority is the immutable `StoreEarningStatusHistory`; `AdminActivityLog` may be secondary operational evidence only.

## Placeholder and legacy inventory

- No dormant StoreEarning, seller settlement, store payable, or marketplace settlement model/table exists.
- Phase 4 compatibility fields remain on Payment, PaymentRefund, WithdrawalRequest and webhook models and are not reinterpreted.
- Existing Product/Cart/OrderItem models are outside Phase 16 and are not used to fabricate marketplace settlement evidence.

## Store wallet ownership map

1. Canonical store: `Store.id`, stable public display reference `Store.slug`.
2. Human owner: `Store.ownerUserId -> User.id`; require User role STORE/status ACTIVE for store-facing reads.
3. Financial owner: Wallet `(STORE, Store.id, ZAR)`; require Wallet status ACTIVE.
4. Store payable: unique wallet/purpose/currency `STORE_EARNINGS_PAYABLE`, LIABILITY, ZAR, non-negative.
5. Owner withdrawal source: unique wallet/purpose/currency `OWNER_WITHDRAWABLE`, LIABILITY, ZAR, non-negative.
6. Existing wallet/account provisioning is idempotent/Serializable with unique-race reread. Phase 16 provisions only the payable account; owner-withdrawable remains Phase 13's account definition.

## Financial source map

| Evidence/value | Canonical source | Phase 16 use |
| --- | --- | --- |
| Customer funds held | PLATFORM wallet, purpose `HELD`, liability, ZAR | Debited on earning accrual; credited on exact direct reversal. |
| Successful payment | Payment plus success attempt/webhook/receipt journal | Identity and verified source-funds evidence only; never the store basis formula. |
| Settlement identity | Opaque subject + store + explicit settlement version/reference | Unique earning identity and idempotency boundary. |
| Seller basis | Authoritative StoreSettlementSnapshot | Exact per-store basis; may be one part of a multi-store subject. |
| Commission | Existing CommissionAllocation rows and charge snapshots | Already-posted amounts are attributed, not posted again. |
| Commission availability | `amount - storeAttributedAmount` | Stable-lock over-attribution check. |
| Store payable | Store wallet `STORE_EARNINGS_PAYABLE` | Credited on accrual, debited by store-attributed refund reserve/release/reversal. |
| Refund exposure | RefundFundingAllocation plus StoreEarning projections | Reserved/completed amounts; no payment-wide inference. |
| Owner withdrawable | Store wallet `OWNER_WITHDRAWABLE` | Credited only by eligible release. |

## Transaction map

1. **Account provisioning:** validate active Store and existing active STORE/ZAR wallet -> find unique payable account -> create zero-balance canonical liability in Serializable retry -> unique-race winner reread.
2. **Accrual:** validate command/snapshot/evidence -> Serializable transaction -> operation replay -> lock Payment -> lock CommissionAllocation IDs sorted -> lock held/payable accounts sorted through ledger primitive -> recheck attribution and held balance -> create earning/charges -> increment allocation projections -> post accrual -> link journal/history atomically.
3. **Accrual replay:** same operation key/hash returns stored earning; changed hash conflicts. Subject/store/settlement uniqueness rejects a second economic entitlement even under another operation key.
4. **Refund reservation:** future authoritative internal refund transaction locks earning -> checks ACCRUED/no release/reversal -> calculates cumulative Decimal adjustment -> adds exact STORE_EARNINGS_PAYABLE funding row -> reserve journal debits payable -> increments reserved projection/history in the same Phase 15 transaction.
5. **Refund reservation release:** use stored funding allocation exactly -> Phase 15 release journal credits payable -> decrement reserved projection/history atomically; no recalculation.
6. **Refund completion:** Phase 15 completion consumes refund-held; move exact earning reserved projection to refunded, append history, and transition FULLY_REFUNDED only at exact total. No second earning journal.
7. **Release:** Serializable -> lock earning -> recheck every eligibility/reconciliation/refund/commission condition -> lock payable/owner-withdrawable accounts sorted -> post exact remaining release -> set projection/journal/status/history atomically.
8. **Reversal:** Serializable -> lock earning/charges -> require commission coordination -> lock payable/customer-held sorted -> post exact remaining reversal -> set projection/journal/status/history and resolve eligible cases atomically.
9. **Reconciliation creation:** scanner/canonical failure upserts by stable case key, increments observation count and records safe evidence; it posts no journal and changes no amount.
10. **Reconciliation resolution:** only a canonical accrual/refund/release/reversal correction may resolve a financial case; no manual balance/status override exists.

## Lock order and atomicity

- Domain order: Payment, then StoreEarning, then CommissionAllocation/charge rows by ascending ID as applicable.
- Ledger accounts are always locked in ascending ID order by the transaction-aware posting primitive.
- Earning, charges, attribution projections, journal link, account projections and history share one transaction.
- Release/reversal journal, projections, status and history share one transaction.
- No network call, Order mutation, Payment mutation, marketplace trigger, withdrawal creation or driver record occurs.

## Cross-phase dependency map

| Phase | Preserved contract | Phase 16 boundary |
| --- | --- | --- |
| Phase 12 Payment | Verified `SUCCEEDED` payment, success attempt/webhook and `EXTERNAL_PAYMENT_RECEIPT`; platform HELD liability | Read/validate only. Basis is not Payment amount. Payment/Order statuses never change. |
| Phase 14 Commission | Immutable accrual/allocation and exact reversal evidence | Attribute already-posted allocations with charge rows/projection. Do not repost commission or change allocation status. Store reversal requires coherent commission reversal treatment. |
| Phase 15 Refund | Immutable funding allocations; reserve/release/completion atomicity; cumulative Decimal calculation | Add an authoritative store funding source. Generic request route fails closed when store allocation evidence is absent. Released earnings open reconciliation rather than owner-withdrawable clawback. |
| Phase 13 Withdrawal | STORE wallet `OWNER_WITHDRAWABLE` and `WITHDRAWAL_HELD` accounts; withdrawal creation owns reserve/payout | Release credits owner-withdrawable only. It does not create or execute a withdrawal. |
| Future Phase 20 marketplace checkout | Future payment and immutable per-store settlement allocation | Must construct `StoreSettlementSnapshot`; Phase 16 exposes no route or automatic trigger. |
| Future Phase 21 store-order management | Fulfillment, cancellation, return window and authoritative release eligibility | Must establish `releaseEligibleAt`/conflict evidence and invoke internal release. Phase 16 does not infer from courier Order UI status. |

## Contract matrix

| Layer | Required Phase 16 alignment |
| --- | --- |
| Prisma | New enums/models/relations; commission attribution projection; refund store source; account/journal purposes. |
| Migration | One additive `20260717080000_phase16_store_earnings`; enum values before use; constraints, immutable/delete triggers and unique evidence links; prior migrations untouched. |
| Domain | Immutable subject/snapshot/refund contracts, state machine, release/reversal/reconciliation/production policies. |
| Calculation | Prisma Decimal only; basis minus attributed commission; charge sum; cumulative half-up refund target with exact final cent. |
| Services | Payable provisioning, internal accrual/release/reversal/refund projection, reconciliation, store/finance queries and summary. |
| Refund integration | Stored store-earning funding evidence; reservation/release/completion projection helpers; generic inference prohibited. |
| Validation | Strict read filters and strict admin reversal input; no amount/account/status/store-wallet fields. |
| DTO | Store-safe and finance-safe exact money strings; no customer PII, internal account IDs or operation hashes in store output. |
| APIs | Store ownership GET-only endpoints; finance permissioned GETs; one source-locked exact reversal POST; explicit DENY remains authoritative. |
| UI | Server-rendered Next 16 pages; dynamic params awaited; exact server-returned amounts; no accrual/release/adjustment controls. |
| Tests | Pure policy/service/API/source contracts plus deferred PostgreSQL concurrency and browser scaffolding. |
| Scripts | Fail-closed preflight/invariants, reconciliation scanner, mature-release runner through canonical service, disposable integration launcher. |
| Documentation | Accounting, snapshots, release, refunds, reversal, reconciliation, testing, deferred risks and final semantics. |

## Production activation boundary

`STORE_EARNINGS_PRODUCTION_VALIDATION_APPROVED` remains `false` in reviewed source. Accrual, release, reversal and automated mature-release execution are blocked with `CONSOLIDATED_VALIDATION_NOT_APPROVED`. Existing data may be read by authorized owners/finance users. Test-only dependency injection may exercise pure/internal code without an environment bypass.
