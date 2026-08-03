# Phase 15 Customer Wallet and Refunds — Implementation Map

Status: inventory complete before refund-model edits. This map records the Phase 9–14 contracts that Phase 15 must preserve.

## Scope and compatibility decision

- Evolve the existing `PaymentRefund` table and Prisma model. It is a Phase 4 placeholder with no application writer; creating a second refund aggregate would split evidence.
- Preserve the legacy placeholder columns through additive migration compatibility handling. Existing rows fail closed and are not treated as verified refund evidence.
- Do not change `Payment.status`, `Order.status`, commission policy, commission history, or prior migrations.
- Customer wallet and refund-held values are liability-ledger account projections. The legacy `Wallet.availableBalance`, `pendingBalance`, and `lockedBalance` fields are not Phase 15 financial authority.
- Payfast refund networking remains source-locked. No repository-visible Payfast Refund API SDK or official refund protocol material is present, so amount units and provider query semantics are unresolved and cannot be guessed.

## Existing model inventory

### `PaymentRefund`

| Item | Existing contract | Phase 15 decision |
| --- | --- | --- |
| Fields | `id`, `paymentId`, `amount Decimal(12,2)`, string `currency`, optional `reason`, optional `providerReference`, `PaymentStatus status`, JSON `metadata`, optional `createdByUserId`, timestamps | Evolve in place to the Phase 15 aggregate. Retain old physical fields where compatibility requires, but exclude them from operational writes. |
| Relations | Payment, optional creator User | Expand to customer, finance actors, journals, current attempt, funding allocations, attempts, histories, and reconciliation cases. |
| Status | Reuses legacy `PaymentStatus`; default `PENDING` | Replace operational mapping with dedicated `RefundStatus`. Unsupported legacy rows must be detected by preflight and fail closed. |
| Indexes/constraints | Indexes on payment, status, creator, created time; no public reference or idempotency constraint | Add unique public reference, creation operation key/hash, journal links, customer/payment indexes, state checks, and immutability triggers. |
| Precision | `Decimal(12,2)` plus untyped string currency | Use `Decimal(18,2)` and `LedgerCurrency` constrained to ZAR. |
| Writers/seed/fixtures | No runtime writer, no seed, no fixture; only invariant/source-audit reads | Phase 15 becomes the sole writer. Seed no refunds. |
| State | Placeholder only | Safe to evolve; no duplicate aggregate. |

### `Payment`

| Item | Inventory |
| --- | --- |
| Fields | `publicReference` mapped to `paymentNumber`; customer `userId`; unique order; provider/purpose/status; `amount Decimal(18,2)`; `LedgerCurrency`; creation idempotency/hash; optimistic version; attempt counter; success attempt/webhook/journal evidence; reconciliation state; safe metadata and timestamps. Phase 4 provider/checkout/refunded fields are retained as ignored compatibility fields. |
| Relations | User, Order, attempts, status history, webhooks, success evidence, reconciliation cases, existing refunds. |
| Status/indexes | Dedicated payment lifecycle; indexes by owner, order, provider, purpose, status, reconciliation and time. |
| Writers | Payment preparation, provider session reservation/finalization, Payfast ITN verified application and reconciliation services. |
| Phase 15 | Add `totalRefundedAmount` and `totalRefundReservedAmount` as exact projections. Lock Payment before every authoritative refundable calculation. Never mutate payment lifecycle status. |

### `PaymentAttempt`

- Stores immutable payment/provider attempt identity, provider environment/protocol/configuration fingerprints, safe request/result snapshots, failure normalization, and optimistic versioning.
- Unique constraints cover payment attempt number, idempotency key, merchant reference, and provider/provider reference.
- Written by payment provider-session reservation/finalization and Payfast confirmation services.
- Phase 15 reads the verified successful attempt/provider reference only; refund attempts use the separate `RefundExecutionAttempt` model.

### `PaymentWebhookEvent`

- Stores Payfast ITN fingerprint, verified merchant/payment/status/amount evidence, safe payload snapshot, processing state, optional payment/attempt/journal links, and reconciliation reason.
- Legacy Phase 4 webhook fields are ignored compatibility columns.
- Unique fingerprint and journal link; indexed for provider, environment, status, merchant reference and payment resolution.
- Written only by Payfast ITN verification/application services. Phase 15 requires this verified evidence and never trusts browser return state.

### `CommissionAccrual`

- Immutable accrual identity for one courier-order settlement version with original plan/basis snapshots, exact `Decimal(18,2)` amounts, hashes, journal and optional reversal journal.
- Statuses: `ACCRUED`, `REVERSED`, `RECONCILIATION_REQUIRED`.
- Relations: plan, accrual/reversal journals, original allocations, status history, reconciliation cases.
- Written by commission accrual and reversal services; no seed evidence.
- Phase 15 uses original allocation amounts only. It never selects or recalculates a current plan.

### `CommissionAllocation`

- Original exact platform-revenue or beneficiary-payable allocation with beneficiary attribution, wallet/account, status and downstream-release journal evidence.
- Exact `Decimal(18,2)` ZAR; unique public reference and downstream journal; unique accrual/rule/beneficiary wallet tuple.
- Statuses: `ACCRUED`, `RELEASED`, `REVERSED`, `RECONCILIATION_REQUIRED`.
- Written by commission accrual/reversal flows. Phase 15 adds refund funding relations; released/downstream-linked allocations block automatic clawback.

### `CommissionReconciliationCase`

- Idempotent `caseKey`, safe evidence/summary, observation counter, priority and OPEN/MONITORING/RESOLVED/CLOSED lifecycle.
- Written/read by commission reversal/query/scanner flows.
- Phase 15 does not redesign it; refund-specific inconsistencies use `RefundReconciliationCase` and may reference original allocation evidence.

### `Wallet`

- Unique by owner type/owner ID/string currency; owner types include CUSTOMER and PLATFORM.
- Has legacy `Decimal(12,2)` available/pending/locked projections, record status, version, transactions and ledger accounts.
- Provisioned idempotently by `wallet-account.service.ts`; platform wallet is seeded. Phase 15 provisions customer wallets/accounts with zero balance and rereads unique-race winners.
- The Phase 15 financial balance is `LedgerAccount.currentBalance`, not the legacy Wallet balance fields.

### `LedgerAccount`

- Unique code and unique wallet/purpose/currency; exact `Decimal(18,2)` current/debit/credit projections; account status, category, currency, `allowNegative`, optimistic version.
- Existing purposes include held customer funds, cash clearing, platform revenue and commission payable.
- Provisioned by wallet/commission/withdrawal account services and platform seed definitions. Updated only by the transaction-aware journal posting primitive.
- Phase 15 adds `CUSTOMER_WALLET_AVAILABLE` and `CUSTOMER_REFUND_HELD`, both customer-owned ZAR liabilities with credit normal side and no negative balance.

### `LedgerJournal` and `LedgerEntry`

- Journal identity is unique by reference, idempotency key and optional source reference. It stores exact total debits/credits, policy version, safe metadata, optional reversal relation, actor and timestamps.
- Entries have immutable account, sequence, direction, amount and bounded line code; unique journal sequence and journal line code.
- `postLedgerJournalWithinTransaction` normalizes exact money, locks account IDs in ascending order, checks wallet/account coherence, creates journal/entries and updates projections atomically with optimistic versions.
- Phase 15 uses that primitive for reserve, release, wallet credit and external payout. It never updates account balances directly.

### `Order`

- Customer/store ownership, independent operational status, pricing fields and exact pricing snapshots; one or more payments.
- Written by order, dispatch, custody and delivery services.
- Phase 15 reads order reference/ownership through Payment only. It never writes order status or payment status.

### `User`

- Auth identity, role/status and relations to payment and finance evidence. `paymentRefundsCreated` currently points at the placeholder creator relation.
- Phase 15 adds distinct requester/customer, approver, rejector, canceller, completer, attempt initiator/completer and history actor relations.
- Active CUSTOMER ownership is required for customer APIs; exact permissions plus explicit DENY apply to finance operations.

### Audit records

- There is no model literally named `AuditLog`. `AdminActivityLog` is the general admin activity model (`action`, entity identity, message, safe metadata, actor and timestamps); `PricingAuditLog` is pricing-specific.
- Refund lifecycle authority belongs to immutable `RefundStatusHistory`. Admin activity may provide secondary operational audit context but cannot replace refund or ledger evidence.

## Current writers, seed records and fixtures

| Area | Current source of writes | Existing seed/fixture state |
| --- | --- | --- |
| Payment | preparation, provider session, Payfast ITN verification/application/reconciliation | Payment integration fixtures only; no refund fixture |
| Wallet/account | wallet-account, withdrawal-account and commission-account services | One platform wallet; canonical zero-balance platform cash, adjustment, customer-funds-held and commission-revenue accounts |
| Ledger | transaction-aware posting/reversal/transfer services | E2E balanced/reversal evidence only; seed refuses non-zero projection without entries |
| Commission | plan, accrual and reversal services | No accrual/allocation money seeded |
| Refund | no runtime writer | No rows, attempts, balances, journals, provider IDs or resolutions seeded |

## Provider inventory

| Concern | Existing payment architecture | Phase 15 contract |
| --- | --- | --- |
| Registry | Allowlisted registry with injected adapters and safe configuration/readiness DTOs | Dedicated refund registry/adapter contract; behavior driven by capabilities, not provider name |
| Checkout configuration | Server-only mode, merchant ID/key/passphrase, app origin, credential version, pinned sandbox/production form endpoints | Refund config reuses merchant ID, passphrase and credential version only; host pinned to `https://api.payfast.co.za`; no arbitrary host |
| Credential version | Captured on PaymentAttempt and ITN evidence | Capture on refund attempt; never expose secret values |
| Checkout signature | Fixed checkout field order plus passphrase, Payfast URL encoding, MD5 | Must not be reused |
| ITN signature | Incoming field order/parameter-string verification with timing-safe digest comparison | Must not be reused |
| API authentication | No existing helper | New alphabetical header/query/body/passphrase map, PHP-compatible URL encoding, single timestamp and lowercase MD5 |
| Endpoint pinning | Checkout endpoint selected from compile-time constants; callback origins validated | One compile-time refund API origin; redirects disabled/rejected |
| Error normalization | Adapter errors normalize timeout/network/malformed outcomes and definitive failures | Refund result normalizes `SUCCEEDED`, `PROCESSING`, `FAILED`, `UNKNOWN`; transport uncertainty is never definitive |
| Timeout/retry | AbortController plus bounded timeout; capability-aware retry policy | Bounded timeout, no blind retry, no database transaction around network call |
| Provider material | Checkout/ITN implementation and tests only; no installed Payfast SDK or repository-visible Refund API protocol document | Refund amount unit and query path remain unresolved. Production network stays inactive; deterministic injected adapters exercise orchestration. |

## Accounting map

| Value/evidence | Canonical source | Phase 15 use |
| --- | --- | --- |
| Payment gross amount | Successful Payment `amount Decimal(18,2)` plus verified success attempt/webhook/journal | Maximum cumulative refund basis |
| Prior successful refunds | `Payment.totalRefundedAmount`, checked against `SUCCEEDED` refund rows and completion journals | Subtract from remaining refundable amount |
| Open reservations | `Payment.totalRefundReservedAmount`, checked against refund rows in REQUESTED/UNDER_REVIEW/APPROVED/PROCESSING/RECONCILIATION_REQUIRED | Subtract from remaining refundable amount |
| Unallocated customer funds | Platform `HELD` liability (`PLATFORM-CUSTOMER-FUNDS-HELD-ZAR`) after original receipt/accrual journals | Residual funding source after cumulative commission deltas |
| Commission | Original CommissionAccrual/Allocation rows and their exact account IDs/amounts | Cumulative ROUND_HALF_UP target and per-refund delta |
| Downstream release | allocation status RELEASED or `downstreamReleaseJournalId` | Block reservation and open reconciliation; never debit old payable |
| Cash clearing | Platform CASH_CLEARING asset | Credited only on externally succeeded original-method refund after cash sufficiency check |
| Customer wallet available | Customer `CUSTOMER_WALLET_AVAILABLE` liability | Credited only by wallet refund completion journal |
| Customer refund held | Customer `CUSTOMER_REFUND_HELD` liability | Credited by reserve; debited by exact release or one completion |

Reservation gathers the exact refund value from customer funds plus cumulative commission deltas. Funding allocations are immutable and their sum equals refund amount. Release uses the exact inverse allocations; it never recalculates commission.

## Transaction map

1. **Request and reserve:** authenticate/own Payment → parse exact amount → build hash → Serializable transaction → replay check → lock Payment → recalculate remaining → validate successful evidence/method/reason/readiness → lock original allocations/accounts → compute cumulative deltas → verify balances → create refund/funding rows → post `REFUND_RESERVE` → link journal → increment reserved projection → append history → commit.
2. **Customer cancellation:** lock Refund then Payment and allocation accounts → verify cancellable/no completion/release → post exact inverse `REFUND_RELEASE` from stored funding rows → decrement reserved projection → mark CANCELLED/history → commit.
3. **Finance rejection:** same exact release transaction; reviewer/requester separation and `refunds.review` enforced before service invocation and rechecked in service.
4. **Approval:** lock Refund/Payment → verify reservation and method → enforce requester/approver separation → mark APPROVED/history. No journal.
5. **Wallet credit:** source-lock blocks production completion; injected tests may run Serializable completion → lock Refund/Payment/held/available → enforce approver/processor separation → post `REFUND_WALLET_CREDIT` → move reserved projection to refunded → mark SUCCEEDED/history/resolve cases atomically.
6. **Provider-attempt reservation:** source-lock/provider readiness → short Serializable transaction → lock Refund → enforce APPROVED/original method/maker-checker/no active unknown attempt → idempotency → allocate attempt number → create RESERVED then PROCESSING attempt and Refund PROCESSING → commit.
7. **Provider create call:** signed, bounded call outside transaction; production Payfast adapter remains network-inactive; injected adapter returns normalized deterministic result.
8. **Provider success finalization:** lock Refund/Attempt/Payment/held/cash → validate immutable evidence and cash → post `REFUND_EXTERNAL_PAYOUT` → move projections → mark attempt/refund SUCCEEDED and resolve cases/history atomically.
9. **Definite provider failure:** lock Refund/Attempt → FAILED attempt and Refund APPROVED; held funds remain reserved; no journal/release.
10. **Unknown provider outcome:** lock Refund/Attempt → UNKNOWN and RECONCILIATION_REQUIRED → open/update idempotent case; held funds remain; no retry or completion.
11. **Provider status reconciliation:** query, if supported, outside transaction; route verified success/failure/unknown through the same finalizer. Real Payfast query is disabled until protocol semantics are reviewed.
12. **Commission reconciliation:** scanner compares cumulative stored funding allocations with original allocations and refund totals; it opens/updates cases without financial mutation or manual success bypass.

## Lock order and atomicity

- Domain rows: Payment before authoritative remaining calculation; Refund and Attempt locks before finalization; account IDs always sorted before ledger posting.
- Network calls never occur while a database transaction or row lock is held.
- Refund receipt, allocations, journal, Payment projections and history commit together.
- Completion journal, Payment projections, success status, provider evidence and history commit together.
- Unique operation keys are only consumed inside successful atomic transactions; unique-race losers reread and compare hashes.

## Contract matrix

| Layer | Phase 15 contract |
| --- | --- |
| Prisma | Dedicated refund enums; evolved PaymentRefund; execution attempt, funding allocation, status history and reconciliation models; Payment projections; account/journal purposes; complete User/Ledger relations |
| Migration | One additive `20260717070000_phase15_customer_wallet_refunds`; compatibility handling, checks, unique indexes, immutable/delete guards and projection/state coherence; not executed |
| Domain | Refund/attempt state machines, exact-money parsing, eligibility, remaining amount, funding/clawback, dual control, production readiness and reconciliation policies |
| Calculation | Exact Prisma Decimal math; cumulative half-up commission targets; final-full-refund exactness; no floats/current-plan lookup |
| Provider | Provider-neutral capability contract; injected deterministic adapter; pinned Payfast config/API auth/request/result modules; amount/query fail closed; no bank data or raw response |
| Services | Transaction-aware wallet provisioning/query, request/release/review/approval/completion, provider orchestration, finance/customer reads, dashboard and reconciliation |
| Validation | Strict Zod objects; exact decimal strings; bounded enum reasons/notes/operation IDs; no accounting/provider-controlled input |
| DTO | Customer-safe wallet/refund contracts and finance evidence DTOs; exact money strings; no credentials, internal customer account IDs or raw snapshots |
| APIs | Auth/ownership or exact finance permission with explicit DENY; same-origin/rate/body/content-type controls; no DELETE/arbitrary transition/mark-success routes |
| UI | Server-rendered customer and finance pages using async Next 16 params; small client controls only; exact `Wallet`, `Refunds`, and `Refund Reconciliation` headings |
| Tests | Pure policy/provider vectors; service/API mocks; deferred PostgreSQL concurrency/invariant scenarios and browser scaffolding; no real network |
| Scripts | Preflight, invariant verification, reconciliation scanner and disposable integration launcher written but not run |
| Documentation | Accounting/state/provider/security/testing guides, implementation report and deferred-risk register with production lock and unresolved Payfast protocol risks |

## Cross-module invariants

- Successful plus reserved refund projections never exceed the verified successful payment amount.
- No refund path writes Payment status, Order status, raw bank/card data, provider fees, wallet spending, direct wallet balance fields, or current commission policy.
- Released allocation evidence blocks automatic reservation and cannot be replaced with pooled customer funds.
- A refund can have one release or one completion, never both; unknown outcomes remain held.
- Customer requester, finance approver and completion processor satisfy maker-checker rules; SUPER_ADMIN does not bypass them.
- Production request, approval completion, wallet completion and Payfast networking remain locked until consolidated validation is source-approved.
