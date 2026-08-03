# Phase 10 payment provider foundation

## Scope and non-goals

Phase 10 evolves the dormant Phase 4 payment placeholders into one provider-neutral order-payment aggregate, durable provider-operation attempts, central state machines, a server-only registry/configuration boundary, authoritative order amount resolution, reservation/call/finalization orchestration, immutable lifecycle evidence, and read-only administration.

It does not activate PayFast, credentials, network forms, webhooks, reconciliation, capture, settlement, ledger posting, wallet movement, refunds, withdrawals, commissions, chargebacks, subscriptions, marketplace checkout, cash-on-delivery settlement, or public payment mutations. No customer checkout UI or payer status route is exposed.

## Payment aggregate and attempt

`Payment` represents the exact ZAR amount owed for one explicit courier `Order` by one payer. `publicReference` is non-sequential and unique. `creationIdempotencyKey` is the durable preparation receipt and `creationRequestHash` binds that receipt to subject, payer, amount, currency and policy meaning. The aggregate stores its current provider only after an attempt is reserved, optimistic `version`, locked `latestAttemptNumber`, and lifecycle timestamps. Provider references and redirect URLs are never active aggregate fields; empty Phase 4 compatibility columns remain ignored.

`PaymentAttempt` is one provider operation. Its positive `attemptNumber`, command key/hash, merchant reference, copied amount/currency, provider, provider reference, normalized state, safe redirect, failure taxonomy, bounded sanitized snapshots, timestamps and version cannot be reused for another operation. `(paymentId, attemptNumber)`, the command key, merchant reference, and `(provider, providerReference)` are unique.

`PaymentStatusHistory` is immutable transition evidence. It is separate from attempts, webhook placeholders, general admin activity, and idempotency receipts. A provider result may legitimately create two history rows when evidence moves a payment from `PROVIDER_PENDING` through `PROCESSING` to `SUCCEEDED`.

## Provider adapter, registry and capabilities

The base adapter supports only checkout-session creation and an optional status lookup. Inputs are normalized server-derived strings and callback URLs; database models and secrets are not passed. Outputs contain normalized status, safe provider reference/code/metadata, redirect, expiry, provider time and definitive-outcome evidence. Refund and payout methods are absent.

Capabilities are explicit: redirect checkout, status lookup, idempotent session creation, cancellation and authorization/capture. Runtime never infers them from a provider name. The allowlist contains `PAYFAST`; Phase 10's production registry constructs no adapter and reports PayFast known, inactive, and not configured. The test adapter is directly injected under the `PAYFAST` code, never selected through environment or public input, and makes no network call.

No credential table or credential DTO exists. `PAYMENT_APP_ORIGIN` is a server-only callback-origin input, must be credential-free HTTPS, and is not a provider activation switch. Missing configuration fails closed. No `NEXT_PUBLIC_*` value influences provider selection, outcome, validation, idempotency, retry, or payment state.

## Order subject resolution and amount authority

`payment-subject.service.ts` supports only `Order`. It verifies direct customer ownership or store-owner identity; rejects missing, inaccessible, cancelled, failed, non-payable, or already-successfully-paid orders; requires ZAR; and cross-checks the linked quote ID/version, copied total/subtotal/tax/rate and pricing snapshot. The payable amount is the immutable quote total, converted through Phase 9 `LedgerMoney` with no floating-point conversion or rounding.

Internal preparation accepts only `orderId` and a bounded idempotency key. Provider-session creation accepts only the internal payment ID, allowlisted provider and command key. Amount, subtotal, tax, currency, payer, order status, pricing snapshot, provider result and redirect are never client authority. Neither operation mutates the order or quote.

## State machines

The central payment state machine owns `CREATED`, `PROVIDER_PENDING`, `REQUIRES_ACTION`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, and `EXPIRED`. `SUCCEEDED` and `CANCELLED` do not reopen. Only `FAILED` and `EXPIRED` reserve a later explicit retry. Direct `CREATED` to `SUCCEEDED` is illegal.

The attempt machine owns `RESERVED`, `REQUESTING`, `REQUIRES_ACTION`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED`, and `UNKNOWN`. `UNKNOWN` records potentially transmitted work without a definitive response; it is not failure and blocks blind new attempts. Later verified lookup/reconciliation may resolve it. Succeeded, failed, cancelled and expired attempts are terminal.

Legacy Phase 4 enum values remain schema compatibility values only. Phase 10 services and validators neither accept nor write them.

## Preparation transaction

1. Validate internal identity-only input.
2. Resolve ownership, eligibility and immutable quote amount outside the transaction.
3. Canonicalize the subject/amount/payer/policy snapshot and hash it with SHA-256.
4. In a bounded-retry Serializable transaction, read the unique preparation receipt.
5. Same key/hash returns the original DTO; a semantic mismatch raises `PAYMENT_IDEMPOTENCY_CONFLICT`.
6. Recheck that no successful order payment exists.
7. Create one `CREATED` payment and one initial immutable history row.
8. Commit and return a DTO with string money and no hash.

No provider, ledger, wallet, order, email, notification, or dispatch operation occurs.

## Provider session: reservation, call, finalization

Stage A is a short Serializable local transaction. It validates payer/payment identity and a same-key receipt, locks the payment with parameterized `FOR UPDATE`, blocks unresolved attempts, verifies a legal retry state, increments the counter, generates `kt:payment:<public-reference>:attempt:<number>`, creates `RESERVED`, moves the payment to `PROVIDER_PENDING`, writes history and commits. A separate short transaction marks `REQUESTING` immediately before the call.

Stage B resolves the directly configured adapter only after reservation, creates normalized input and calls it with an `AbortController` plus a hard bounded timeout. No Prisma transaction is open. The service never performs an automatic provider retry. Raw provider exceptions never enter DTOs or persistence.

Stage C starts a new Serializable transaction and locks payment then attempt. It verifies the durable identity and unresolved version, validates the redirect against adapter-owned HTTPS hosts, recursively sanitizes bounded snapshots, stores normalized references/outcome, transitions both central state machines, writes history, and commits. Conditional version updates and unique constraints handle competing finalizers. Equivalent completed evidence replays; incompatible evidence produces a controlled concurrency error.

## Crash and unknown outcomes

- Before provider call: durable `RESERVED` remains; same-key inspection returns pending and no new merchant reference.
- During the call or after potentially transmitted timeout/network interruption: finalization records attempt `UNKNOWN` and payment `PROCESSING`; no automatic second attempt is allowed.
- Definite configuration/rejection: attempt/payment become `FAILED`; later explicit retry is eligible.
- After provider acceptance but before local finalization: merchant reference and reservation remain stable for Phase 12 lookup/reconciliation.
- Finalization rollback: no partial attempt/payment/history update commits; the request marker and reservation evidence remain available.

## Idempotency, references and concurrency

Preparation maps one key to one payment. Provider-session creation maps one key to one attempt. Canonical hashes use deterministic object ordering and exclude timestamps, database IDs, credentials, unstable callback tokens and display-only labels. Reusing a key with changed meaning raises the appropriate payment/attempt conflict. After definitive completion a replay never calls the adapter again.

Attempt allocation never uses unlocked `MAX + 1`. It locks `Payment`, derives the next number from `latestAttemptNumber`, updates the counter and creates the attempt atomically, with a unique compound index as backstop. Merchant references disclose no sequential database ID. Provider references are attempt-scoped and unique only within a provider.

Database concurrency retry is limited to Prisma `P2034`, PostgreSQL `40001` and `40P01`, bounded to three retries. Provider retry policy additionally requires declared idempotent session creation, the same merchant reference, and an explicitly retry-safe classification; Phase 10 orchestration invokes no such automatic retry.

## Provider errors, redirects and snapshots

Normalized categories are `INVALID_REQUEST`, `AUTHENTICATION`, `CONFIGURATION`, `DECLINED`, `RATE_LIMITED`, `TIMEOUT`, `NETWORK`, `PROVIDER_UNAVAILABLE`, `MALFORMED_RESPONSE`, `UNKNOWN_OUTCOME`, and `UNKNOWN`. Each safe error records definitive/retry/configuration flags and separate operator/customer text. Stack traces, raw exceptions and credentials are discarded.

Redirects require HTTPS, an adapter-declared exact hostname, no username/password, a length bound, and valid URL serialization. The only HTTP exception is a direct injected-test option. JavaScript, data, file and unknown-host URLs fail closed.

Snapshots must be plain JSON objects with bounded depth, key count, arrays, strings and serialized bytes. Keys resembling secrets, tokens, passwords, authorization, signatures, merchant/private keys, card/CVV, bank account, cookie or passphrase are recursively redacted. Complete headers and raw response bodies are prohibited.

## Ledger and order boundaries

Payment lifecycle is provider-facing state; the Phase 9 ledger is accounting evidence. Phase 10 imports or invokes no posting, transfer or reversal service, creates no journal/entry/transaction, and changes no wallet projection. `Payment.SUCCEEDED` does not mean accounting settlement occurred. A later verified-success workflow must establish idempotent business meaning and post balanced linked evidence.

Payment services read the order only for ownership, eligibility and pricing. They do not change status, pricing, quote usage, driver, assignment, dispatch or delivery state. Source audits and offline invariant tooling enforce both boundaries.

## Admin permissions, APIs and UI

`payments.read` and `payment_providers.read` are system permissions and default ADMIN read grants. Existing explicit user `DENY` wins; SUPER_ADMIN retains established behavior.

Read-only endpoints are `GET /api/admin/payments`, `GET /api/admin/payments/[id]`, and `GET /api/admin/payment-providers`. List filters are strict and paginated with stable sorting. Detail exposes summary, ordered attempts/history and safe references/categories. Hashes, command keys, raw snapshots and credentials are omitted. No public session or write route exists.

Admin routes are `/admin/payments`, `/admin/payments/[id]`, and `/admin/payment-providers`. They use exact semantic headings/tables, labelled keyboard-accessible filters, pagination, loading/empty/error states and status text. There is no capture, retry, refund, cancel, mark-success, amount, reference, balance, ledger or credential control.

## Seed and migration

The existing idempotent permission registry/seed now synchronizes the two read permissions. It creates no payment, attempt, provider activation, credential, success, journal, refund, earnings, withdrawal, commission or captured amount. E2E zero-state fixtures live only in the test harness.

Migration `20260717020000_phase10_payment_provider_foundation` follows Phase 9 and is not executed in this phase. It fails closed if any Phase 4 payment/webhook/refund row needs non-deterministic identity/status/idempotency reconstruction. It does not fabricate PayFast assignment, success, references, amounts or ledger evidence. It adds constraints, indexes and triggers for positive ZAR values, identity immutability after attempts, terminal-success immutability, provider alignment and immutable history.

## Phase 11 and Phase 12 extension points

Phase 11 may implement a PayFast adapter behind the existing contract, safe configuration factory, PayFast-specific redirect hosts and explicit capabilities without changing payment aggregate/state/orchestration contracts. This phase intentionally includes none of that implementation.

Phase 12 may activate webhook ingestion/signature/replay policy, provider status lookup and reconciliation to resolve `UNKNOWN`, reusing stable merchant/provider references. It must separately define verified success, order effects and ledger posting. Current webhook/refund placeholders remain inactive.

## Validation status

Implementation-only workflow applies. The migration, integration/E2E suites, Docker, build, full type/lint/test suite, seed and provider behavior are not deeply validated here. Deferred proofs and exact future commands are recorded in the Phase 10 risk register.
