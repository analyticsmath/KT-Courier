# Phase 12 Payfast ITN implementation map

This map is the mandatory pre-implementation audit for Phase 12. It was completed before the reserved Phase 11 ITN route was changed. The accepted migration chain ends at `20260717030000_phase11_payfast_integration_v1`; all prior migrations remain immutable. Phase 12 evolves the existing, inactive `PaymentWebhookEvent` placeholder and does not create a second generic webhook subsystem.

## Existing webhook-model inventory

| Model | Existing fields and status | Identity, constraints, amount and snapshots | Relations and indexes | Writers, seed, fixtures and operational state | Phase 12 decision |
|---|---|---|---|---|---|
| `PaymentWebhookEvent` | `id`, optional `paymentId`, provider, optional provider event ID, event type, generic `ProcessingStatus`, optional signature flag, required JSON payload, error, received/processed timestamps | Unique `(provider, providerEventId)`; no amount; generic `payload` is not authoritative ITN evidence | Optional payment relation; indexes by payment/provider/type/status/time | Repository search found no runtime writer, seed row, or active fixture. Phase 10/11 preflights require the table empty and describe it as a placeholder. | Evolve in place additively. Migration fails closed if placeholder rows exist, retains each old column as an ignored null-only compatibility mapping, adds `itnProcessingStatus` for Phase 12 state, and defers physical cleanup. Add exact-body fingerprint identity, safe snapshot, verification/application state, attempt/payment/journal links, and immutable identity protections. |
| `Payment` | Provider-neutral aggregate with public reference, payer/order, purpose, status, exact `Decimal(18,2)` amount, `LedgerCurrency`, preparation idempotency/hash, version/counter, lifecycle timestamps and safe metadata | Unique public/order/idempotency references; amount/currency are server authoritative. Status enum includes Phase 10 lifecycle plus unused legacy values. | User, order, attempts, immutable history, webhook placeholder and refund placeholder; provider/status/order/user/time indexes | Operational writers are payment preparation and provider-session services. Seed creates no financial evidence. Payment integration fixtures create test aggregates. | Add canonical unique links to the successful attempt, verified success event and receipt journal, provider confirmation time, and reconciliation state. The payment remains the canonical owner of success evidence. |
| `PaymentAttempt` | Attempt/public refs, payment/counter, provider, command idempotency/hash, merchant/provider refs, attempt status, exact copied amount/currency, checkout/environment/protocol/configuration audit, failure taxonomy, safe request/result snapshots and lifecycle/version timestamps | Merchant reference, public reference, command key, `(payment, attemptNumber)`, and `(provider, providerReference)` are unique. Attempt status includes `UNKNOWN`. | Payment/history; payment/provider/status/time indexes | Operational Phase 10/11 reserve/call/finalize writer. Integration and E2E fixtures create attempts. No seed attempts. | Add non-secret `providerCredentialVersion` and provider-confirmation time. Add event/reconciliation relations. Provider reference remains first-verified-assignment-only and immutable once established. |
| `PaymentStatusHistory` | Payment/attempt, from/to payment status, reason, actor type/id, safe metadata and created time | No independent event identity and no amount; immutable evidence by application convention | Restrict relations to payment/attempt; payment/time, attempt and target-status indexes | Written by payment preparation and provider-session orchestration; fixtures assert lifecycle history; no seed evidence | Keep as immutable lifecycle evidence, never as the webhook idempotency receipt. Add safe provider-event/reconciliation observations without raw ITN fields. |
| `PaymentRefund` | Payment, `Decimal(12,2)` amount, string currency, reason, provider reference, legacy payment status, metadata, creator and timestamps | No refund idempotency key; no webhook identity | Payment/creator relations and payment/status/creator/time indexes | No runtime or seed writer; Phase 10/11 source audits keep it inactive | Unchanged and out of scope. Phase 12 creates no refund. |
| `LedgerJournal` | Reference, precise journal type, ZAR currency, idempotency key/request hash, unique source reference, correlation, safe memo/metadata, policy version, exact totals, reversal evidence, actor and timestamps | Unique reference/idempotency/source/reversal target; exact `Decimal(18,2)` totals | Entries, actor and reversal relations; type/currency/time/correlation/actor indexes | Operational Phase 9 posting/reversal writers and live-test fixtures; seed creates no journals | Add `EXTERNAL_PAYMENT_RECEIPT`; relate the one authoritative receipt journal to payment and event. Reuse the accepted transaction-aware posting policy and idempotency semantics. |
| `LedgerEntry` | Journal/account, deterministic sequence, debit/credit direction, exact amount, line code, memo and timestamp | Unique `(journal, sequence)` and `(journal, lineCode)`; positive exact amount enforced by migration | Restrict journal/account relations; account/time and journal indexes | Created only by the ledger posting service; integration fixtures exercise balanced entries | Unchanged structurally. Phase 12 creates one cash-clearing debit and one customer-funds-held credit through the same posting primitive. |
| `LedgerAccount` | Wallet, unique code, purpose/category, ZAR, lifecycle status, negative policy, exact balance/debit/credit projections, version and timestamps | Unique code and `(wallet,purpose,currency)`; exact `Decimal(18,2)` projections | Wallet and entries; wallet/status and category/currency indexes | Idempotent account service and seed create zero-balance platform accounts; integration fixtures create test accounts | Provision `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR` as HELD/LIABILITY. Payment receipt also requires the existing CASH_CLEARING/ASSET account. |
| `Wallet` | Owner type/id, string ZAR currency, legacy balance projections, status/version and timestamps | Unique `(ownerType, ownerId, currency)` | Transactions, withdrawals and ledger accounts; owner/status/time indexes | Idempotent owner-wallet service and seed provision the platform wallet; fixtures create isolated wallets | Reuse the platform wallet. Do not mutate legacy wallet balance fields and do not seed non-zero balances. |
| `Order` | Operational order identity/state, payer/store/address, exact pricing evidence, dispatch/custody/delivery fields and timestamps | Unique order number and pricing quote; no payment confirmation field | Payment relation plus operational relations and extensive state/time indexes | Many operational writers and fixtures; development seed creates demo orders | Read only for payment ownership/preparation context. Phase 12 application never updates Order, assignment, dispatch, pricing, custody or driver fields. |
| `AuditLog` / `AdminActivityLog` | No `AuditLog` model exists. Repository equivalent `AdminActivityLog` contains actor, admin action enum, entity identity, message, safe metadata and timestamps | No payment amount, webhook identity or idempotency | Actor relation; actor/action/entity/time indexes | Existing admin operations write activity records; seed creates no payment activity | Keep general admin activity separate. ITN evidence lives in webhook events/history/reconciliation and never includes raw bodies, credentials or signatures. |

## End-to-end verification map

The authoritative flow is:

```text
transport validation
→ bounded raw-body read
→ strict ordered form parsing
→ source-address extraction
→ source-IP verification
→ merchant-reference resolution
→ credential-version resolution
→ signature verification
→ merchant-ID verification
→ exact amount verification
→ Payfast server confirmation
→ provider-status normalization
→ durable event receipt
→ atomic payment/attempt/ledger application
→ acknowledgement response
```

| Step | Input → output | Security owner | Failure code / retry meaning | Database effect | Response |
|---|---|---|---|---|---|
| Transport validation | Method, media type, charset, declared length → accepted request | ITN route | `ITN_TRANSPORT_INVALID`; caller must correct | None | 400 `INVALID` (unsupported methods remain 405) |
| Bounded raw-body read | Request stream → at most 32 KiB immutable bytes | Streaming reader | `ITN_BODY_TOO_LARGE`, `ITN_BODY_TIMEOUT`, malformed UTF-8; not retryable without corrected delivery | None | 400 `INVALID` |
| Strict ordered parsing | Exact UTF-8 body → frozen ordered pairs plus null-prototype values | Payfast parser | `ITN_FORM_INVALID`; sender must correct | None | 400 `INVALID` |
| Source extraction | Explicit proxy mode plus internal canonical header/runtime peer → normalized single IP | Source-address policy | `PAYFAST_SOURCE_ADDRESS_UNAVAILABLE`; deployment fix required | None | 403 `INVALID` or 503 `RETRY` when trusted infrastructure is temporarily unavailable |
| Source verification | Normalized IP plus environment-specific pinned hostname DNS set → verified source | DNS source resolver | `PAYFAST_SOURCE_DNS_UNAVAILABLE` is retryable; nonmember source is not | None | 503 `RETRY` or 403 `INVALID` |
| Merchant-reference resolution | `m_payment_id` → exact PAYFAST attempt and owning payment | Resolution service | `PAYFAST_ATTEMPT_NOT_FOUND`; no public enumeration | None | 400 `INVALID` |
| Credential-version resolution | Attempt version plus active configuration → one permitted credential set | Resolution/config policy | `PAYFAST_CREDENTIAL_VERSION_MISMATCH`; fail closed and reconcile, never guess | Reconciliation observation may be durably opened after safe identity resolution | 422 `INVALID` |
| Signature verification | Received ordered non-empty fields excluding signature plus matching passphrase → constant-time boolean | ITN signer | `PAYFAST_ITN_SIGNATURE_INVALID`; corrected/legitimate redelivery required | Safe rejected receipt only; signature/base never stored | 400 `INVALID` |
| Merchant-ID verification | Required field plus configured Merchant ID → exact match | Verification service | `PAYFAST_MERCHANT_MISMATCH`; reconcile when safely attributable | Safe rejected receipt/case only | 422 `INVALID` |
| Exact amount verification | Raw `amount_gross` plus authoritative Payment Decimal/ZAR → exact match | Amount policy | `PAYFAST_AMOUNT_MISMATCH`; no rounding/tolerance; reconcile | Safe rejected receipt/case only; amount unchanged | 422 `INVALID` |
| Payfast server confirmation | Canonical parameter string reconstructed from the ordered field model, excluding signature and passphrase, plus pinned mode endpoint → bounded `VALID` | Parameter-string builder and validation client | `PAYFAST_CONFIRMATION_UNAVAILABLE` is retryable; `INVALID` is rejected | No transaction is held; optional temporary receipt/case only | 503 `RETRY` or 400 `INVALID` |
| Status normalization | Verified provider status → COMPLETE/PENDING/FAILED/UNKNOWN policy | Status policy | Unknown is verified evidence requiring reconciliation, never guessed failure | None before receipt | Continues |
| Durable event receipt | Provider/environment/exact raw bytes plus safe fields → unique fingerprint receipt | Application service | Temporary database failure is retryable | Create/update one `PaymentWebhookEvent`; never raw bytes/signature/contact data | 503 `RETRY` on transient failure |
| Atomic application | Verified receipt/payment/attempt plus ledger policy → stable applied/duplicate/stale/reconciliation result | Serializable application service | Conflict is recorded without destructive correction; transactional failure retries safely | One short serializable transaction covers locks, state/history, journal/entries/projections, links and reconciliation | 200 `OK` for applied/duplicate/stale; 409/422 `INVALID` for verified conflict |
| Acknowledgement | Stable application result → direct no-store plain text | ITN route | No secret diagnostics | None | `OK`, `INVALID`, or `RETRY`; never redirect |

Exact duplicates still repeat transport, parsing, source extraction and source-IP validation. A terminal receipt then returns stable success without a provider network call or second ledger posting. A receipt in temporary failure may be reverified and resumed.

## Transaction and lock map

### Request verification and provider confirmation

Transport reading, parsing, DNS lookup, resolution reads, credential/signature/merchant/amount checks, and the pinned Payfast query-validation request run without an open database transaction. The resolution read is revalidated under lock during application. No payment, attempt, event or ledger-account lock is held while DNS or Payfast is awaited.

### Durable rejection and temporary observations

Safe rejected or temporary receipts and reconciliation observations use short idempotent database writes. They never mutate payment success or post a journal. Exact event identity is the fingerprint of provider, environment and raw bytes separated by a stable binary delimiter.

### Final event application

One short `Serializable` transaction uses the global lock order below and never makes a network call:

1. Lock the `PaymentWebhookEvent` row with `FOR UPDATE`; return a stable result for an already terminal receipt.
2. Lock `Payment`, then `PaymentAttempt`, both with `FOR UPDATE`.
3. Reconfirm event verification flags, event/attempt/payment relations, provider/environment, credential version, merchant reference, provider reference, authoritative amount and ZAR currency.
4. Resolve the platform CASH_CLEARING/ASSET and HELD/LIABILITY accounts.
5. Lock all participating `LedgerAccount` rows in sorted account-ID order through `postLedgerJournalWithinTransaction`.
6. Insert the uniquely idempotent `EXTERNAL_PAYMENT_RECEIPT` journal and balanced entries; update exact account projections with optimistic versions.
7. Apply authoritative attempt/payment transitions without downgrading established success; assign the provider reference only when absent.
8. Link payment, attempt, event and journal; append immutable safe payment history.
9. Create/update or resolve reconciliation cases as required and set payment reconciliation state.
10. Mark the event `APPLIED`, `DUPLICATE`, `IGNORED_STALE`, or `RECONCILIATION_REQUIRED`, then commit.

Any exception rolls back the journal, entries, projections, payment/attempt/provider reference, history, event application state and reconciliation changes together. Serializable retry is bounded and re-enters with the same global lock order.

## Contract matrix

| Layer | Contract | Phase 12 mapping |
|---|---|---|
| Prisma | Models and enums | Evolve webhook placeholder; add processing/normalized/reconciliation enums and case model; canonical payment success links; attempt credential/provider-confirmation audit; receipt journal type/relations. |
| Migration SQL | Columns, constraints and triggers | `20260717040000_phase12_payfast_itn_reconciliation`; empty-placeholder preflight; additive evidence fields; uniqueness/coherence checks; identity/provider-reference immutability; event delete prohibition; account consistency. |
| Raw parser | Ordered decoded pairs | Frozen ordered fields and null-prototype value record; strict UTF-8/percent decoding; duplicate/nested/prototype/null/limit rejection. |
| Parameter-string builder | Canonical signature and confirmation inputs | Received order only; requires `signature` to be the final non-empty field; excludes signature, omits empty values, uses the Payfast PHP-compatible encoder, and rejects non-empty fields after signature. |
| Signature verifier | Canonical signature input | Shared parameter builder with active passphrase appended only for the signature input; MD5 bytes compared with `timingSafeEqual`. |
| Network verifier | Source address and DNS set | Explicit `direct`/`single_trusted_proxy`; KT-only canonical header in trusted mode; normalized public IP; bounded A/AAAA cache for internally pinned official hostnames. |
| Provider validator | Query-validation result | Pinned sandbox/production validation endpoints; prebuilt canonical confirmation-body POST; timeout; redirect error; bounded response; exact `VALID`; no internal retries or transaction. |
| Domain policy | Status normalization | COMPLETE succeeds, PENDING processes, FAILED only fails unresolved attempts, unknown reconciles; verified success has precedence over later pending/failed/local navigation. |
| Service | Verification and application | Verification is mutation-free; application creates one fingerprint receipt and applies evidence idempotently in one short serializable transaction; reconciliation never provides manual success. |
| Ledger | Journal specification | `EXTERNAL_PAYMENT_RECEIPT`, gross authoritative ZAR amount, debit platform cash clearing, credit platform customer funds held, deterministic payment-scoped key/source and safe references only. |
| DTO | Safe administrative data | List/detail DTOs expose public references, safe provider/amount/status/verification/link evidence only; omit fingerprint, raw data, signature, credentials, headers and payer identity. |
| API | ITN and admin routes | Public POST ITN with direct text/no-store responses; permission-gated read-only webhook/reconciliation GET list/detail; no mutation endpoints. |
| UI | Event and reconciliation tables | Exact headings, semantic read-only tables, labelled filters, stable pagination, verification checklist, safe evidence/linkage, no destructive or success controls. |
| Tests | Fixtures and assertions | Pure parser/signature/source/validation/status/fingerprint/event/reconciliation/ledger/readiness/source-audit coverage; service/API mocks; deferred PostgreSQL concurrency/atomicity and browser contracts. |
| Documentation | Final semantics | Trust/signature/ledger/reconciliation/test guides, Phase 12 implementation guide/report and risk register; executed checks separated from deferred validation. |

## Migration-state declaration

Phase 12 requires durable, queryable verification and atomic financial evidence, so a migration is necessary. It is prepared at `prisma/migrations/20260717040000_phase12_payfast_itn_reconciliation/migration.sql` but is not applied. The preflight refuses any existing webhook placeholder row because no legacy row can be promoted to verified evidence deterministically. Legacy Phase 4 columns remain physically present and are mapped as ignored, null-only compatibility fields; runtime services do not read/write them, DTOs do not expose them, and their physical removal is deferred to the consolidated cleanup gate. The migration does not fabricate success, rewrite payment status, delete payment/attempt/ledger records, or store raw ITN bodies, signatures, credentials, customer names, email addresses, cookies or full headers.
