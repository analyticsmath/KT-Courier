# Phase 12 Payfast ITN and Reconciliation

## Scope and authority

Phase 12 turns `POST /api/payments/payfast/itn` into the only Payfast provider-authoritative payment-confirmation path. It is South African Payfast only. Customer return and cancel navigation remain read-only; neither can mark a payment successful or cancelled. Payment confirmation does not change Order, pricing, dispatch, assignment, custody, delivery, or driver state. Refunds, withdrawals, earnings, commissions, settlement, and fees remain out of scope.

The endpoint accepts no browser session, CSRF origin, redirect, or mutation method other than POST. It returns only `OK`, `INVALID`, or `RETRY` with no-store and nosniff headers.

## Verification pipeline

The pipeline is:

```text
transport validation
→ 32 KiB bounded streaming read with timeout
→ strict ordered form parsing
→ canonical source-address extraction
→ dynamic Payfast DNS source verification
→ merchant-reference attempt resolution
→ credential-version match
→ ITN-specific constant-time signature verification
→ configured Merchant ID match
→ exact ZAR Decimal gross-amount match
→ pinned Payfast query-validation POST outside any database transaction
→ conservative status normalization
→ durable fingerprint receipt
→ short serializable payment/attempt/ledger application transaction
→ plain-text acknowledgement
```

The event fingerprint is SHA-256 over `PAYFAST`, a zero byte, environment, another zero byte, and the exact received bytes. Source verification still occurs before an existing fingerprint can short-circuit as a duplicate.

## Canonical ITN representations

Phase 12 maintains three deliberately separate representations. Exact raw request bytes are bounded, UTF-8/form parsed, and fingerprinted only; they are never persisted or posted to Payfast. The parser exposes an immutable ordered field model for signature reconstruction, field validation, safe snapshots, and confirmation-body generation. `buildPayfastItnParameterString` then reconstructs the canonical string in received order using the PHP-compatible encoder, omitting empty values and the `signature` field.

For signature verification, the builder appends the encoded active passphrase and the MD5 digest is compared with `timingSafeEqual`. For `/eng/query/validate`, the same selected fields become the request body with neither signature nor passphrase. The builder requires `signature` to be the final non-empty field and rejects a non-empty later field, so signature and confirmation cannot select divergent ranges.

## Status policy

| Payfast evidence | Attempt | Payment | Ledger |
|---|---|---|---|
| verified `COMPLETE` | `SUCCEEDED` | `SUCCEEDED` | one gross receipt journal |
| verified `PENDING` | `PROCESSING` | `PROCESSING` | none |
| verified `FAILED` | `FAILED` where legal | `FAILED` where legal | none |
| verified unknown status | `PROCESSING` or remains `UNKNOWN` | `PROCESSING` where legal | none; reconciliation opens |

A stale `PENDING` after success is recorded and ignored. `FAILED` after success preserves success and opens reconciliation. Verified `COMPLETE` may resolve an `UNKNOWN`, `PROCESSING`, `REQUIRES_ACTION`, or non-authoritative local failure. Different provider evidence after success never creates another journal.

## Evidence and administration

`PaymentWebhookEvent` is the durable exact-delivery receipt. It stores safe allowlisted evidence and verification booleans, not the body, signature, signature base, Merchant Key, passphrase, payer contact data, full headers, or validation response. `PaymentReconciliationCase` idempotently records unresolved/conflicting evidence and provides no success authority.

The retained Phase 4 webhook columns are deprecated compatibility-only fields. Prisma maps them as ignored fields; the additive migration makes them nullable and constrains all Phase 12 receipts to leave them null. Runtime writers and verification do not use them, DTOs do not expose them, and their physical removal is deferred to the consolidated cleanup gate.

Read-only inspection is available at `/admin/payment-webhooks` and `/admin/payment-reconciliation`, guarded by distinct read permissions and established explicit-DENY precedence. There are no mark-success, ledger-posting, event-deletion, refund, or other mutation controls.

## Production lock

Sandbox configuration may remain active. Production is code-locked by `PAYFAST_PRODUCTION_VALIDATION_APPROVED = false`; a configured production provider remains inactive with `CONSOLIDATED_VALIDATION_NOT_APPROVED`. Activation additionally requires an approved HTTPS callback, credentials and credential version, source trust, DNS/source proof, server confirmation, ledger foundations, and the consolidated validation gate.

## Deferred validation

The migration, generated Prisma client, typecheck/build, actual Next.js stream behavior, reverse proxy, live Payfast DNS/source set, official sandbox signature compatibility, query-validation behavior, PostgreSQL races/rollback, and browser flows remain unexecuted pending authorization. See `docs/deferred-validation/phase-12-risk-register.md`.
