# KT Couriers Phase 12 Implementation Report

## 1. Executive Summary

IMPLEMENTATION COMPLETE — DEEP VALIDATION DEFERRED

The South African Payfast ITN endpoint now has bounded public intake, ordered parsing, source/signature/merchant/amount/provider validation, durable exact-delivery receipts, conservative status precedence, reconciliation, and atomic gross-receipt ledger posting. Production remains code-locked. No database migration, live provider operation, build, integration suite, browser, Docker, or CI was executed.

## 2. Prior-Defect Prevention

| Defect pattern | Phase 12 prevention | Files |
|---|---|---|
| Body-order loss | Strict parser returns immutable ordered fields and a separate lookup map. | `payfast-itn-parser.ts` |
| Checkout/ITN signature confusion | Dedicated ITN signature builder; checkout order constant is never imported. | `payfast-itn-signature.ts`, signature tests |
| Proxy-header spoofing | Explicit proxy mode; only proxy-written `x-kt-source-ip` is accepted in single-hop mode. | `payfast-source-address.ts` |
| Stale copied IP list | Pinned hostnames resolve dynamically through bounded A/AAAA cache. | `payfast-source-hosts.ts`, `payfast-source-ip-resolver.ts` |
| Network inside transaction | Provider confirmation completes before receipt application opens its short serializable transaction. | verification/application services |
| Duplicate webhook posting | Exact byte fingerprint, event lock, payment success links, ledger idempotency/source keys, unique SQL constraints. | fingerprint, application service, migration |
| Amount floating comparison | Strict textual format and exact `LedgerMoney`/Prisma Decimal equality. | `payfast-itn-amount.ts` |
| Browser return authority | Return/cancel stay read-only; only verified application writes provider-authoritative state. | ITN service and source audits |
| Payment/ledger split commit | Shared transaction-aware ledger primitive is invoked within the payment application transaction. | ledger/application services |
| Secret/raw-body persistence | Raw bodies remain fingerprint-only; retained Phase 4 fields are ignored null-only compatibility columns and only an allowlisted safe snapshot is stored. | migration, fields service, invariant script |
| Out-of-order downgrade | Success precedence, stale-pending ignore, failure-after-success reconciliation. | status and application policies |
| Schema/DTO drift | Schema, SQL, types, DTOs, queries, APIs, UI, fixtures, scripts and docs evolved together. | Phase 12 contract matrix and changed files |
| Inaccurate validation reporting | Executed lightweight checks are separated from unexecuted deep scaffolding. | this report and risk register |

## 3. Existing Webhook Architecture Audit

`PaymentWebhookEvent` was an unused generic placeholder with optional provider event ID, generic event/status fields, optional signature flag, required JSON payload, and no runtime writer. Repository inspection found no seeded or operational rows. The migration fails if any placeholder row exists, then evolves the same table rather than creating a duplicate webhook system. The old columns remain as ignored, null-only Phase 4 compatibility mappings; Phase 12 state uses the distinct physical `itnProcessingStatus` column. No runtime service reads/writes the compatibility fields, no DTO exposes them, and physical cleanup is deferred. The full model inventory and writer/fixture audit is in `docs/phase-12-implementation-map.md`.

## 4. Final ITN Architecture

```text
content type + declared length
→ bounded timed stream
→ strict ordered form parser and required fields
→ canonical source address
→ dynamic DNS membership
→ exact merchant-reference attempt
→ credential version
→ ITN signature
→ Merchant ID
→ exact gross ZAR amount
→ pinned Payfast VALID confirmation (no DB transaction)
→ conservative normalized status
→ durable fingerprint receipt
→ event/payment/attempt/account locks
→ atomic state/history/reconciliation/ledger application
→ plain-text response
```

## 5. ITN Transport Security

- Method: POST export only; framework handles unsupported methods.
- Content type: form-urlencoded only, with optional UTF-8 charset.
- Body limit: 32 KiB; declared and streamed lengths enforced.
- Reader: incremental Web stream, five-second timeout, fatal UTF-8 decoding.
- Response: no redirect/cache/stack; only `OK`, `INVALID`, or `RETRY`.
- Rate limits: global, finite per verified source, and 16-request concurrency bound.

## 6. Ordered Parser

The parser preserves decoded key/value/index order, converts `+` to space, performs fatal UTF-8 percent decoding, retains empty values, and rejects malformed escapes, duplicate/empty/nested/bracket/dotted/prototype keys, nulls, excessive fields, and oversized keys/values. Its output objects/arrays are frozen.

## 7. Signature Verification

The shared parameter builder processes ITN fields in received order, requires `signature` to be the final non-empty field, excludes it, omits empty values, and retains unknown non-empty fields. It uses the established Payfast encoder. Signature reconstruction appends the active passphrase; confirmation reconstruction does not. Credential version is checked before signing. Supplied and calculated fixed 16-byte MD5 digests are compared with `timingSafeEqual`. The independently calculated fixed digest is `3af95032720fc38f5d83197919f2329f`; no signature/base/passphrase is persisted or logged.

## 8. Source-IP Verification

`PAYMENT_PROXY_MODE` must be `direct` or `single_trusted_proxy`. Direct mode fails readiness without an injected peer. Single-proxy mode trusts only proxy-written `x-kt-source-ip`, with documented stripping/direct-access requirements. Pinned official hostnames resolve through A/AAAA with normalized/deduplicated results, maximum 128 addresses, 30-second–5-minute TTL clamp, refresh at 80%, and one-minute stale grace. No individual IP list is copied. Missing/invalid/unmatched/expired-DNS source fails closed.

## 9. Merchant and Amount Verification

`m_payment_id` resolves exactly and uniquely to a PAYFAST attempt with payment evidence, known environment, and stored credential version. Runtime environment/version and configured Merchant ID must match. `amount_gross` must be positive ZAR with at most two decimals and equal both attempt and authoritative payment Decimal exactly. Mismatches never succeed or post; merchant/amount/version mismatches create safe reconciliation where a payment is resolved.

## 10. Payfast Server Confirmation

The client receives a prebuilt canonical confirmation body and posts it to the internal sandbox or production `/eng/query/validate` constant. The body is reconstructed from immutable ordered fields, excludes `signature` and passphrase, and is never the exact received bytes. The client does not parse or rebuild fields, with form content type, no credentials/cookies, five-second abort, `redirect: error`, no broad retry, and no request-controlled URL. It requires HTTP 200 and a bounded 64-byte UTF-8 response equal to `VALID` after surrounding whitespace. Unavailability is retryable and cannot mutate success. This call occurs before any application transaction.

## 11. Status Normalization

| Payfast status | Local attempt | Local payment | Ledger |
|---|---|---|---|
| COMPLETE | SUCCEEDED | SUCCEEDED | One gross receipt journal |
| PENDING | PROCESSING | PROCESSING | None |
| FAILED | FAILED where legal | FAILED where legal | None |
| unknown | PROCESSING or remains UNKNOWN | PROCESSING where legal | None; reconciliation |

## 12. Webhook Event Model

Identity is the unique SHA-256 fingerprint over provider, environment, delimiters, and exact bytes plus a public event reference. Safe evidence contains bounded non-contact fields/counts only. Processing states are `RECEIVED`, `REJECTED`, `VERIFIED`, `APPLIED`, `DUPLICATE`, `IGNORED_STALE`, `RECONCILIATION_REQUIRED`, and `TEMPORARY_FAILURE`. SQL protects identity/evidence, established links/timestamps, verification monotonicity, terminal states, deletion, and relation coherence. Exact duplicates converge on the same receipt and cannot repost.

## 13. Reconciliation Model

Reasons cover unknown, credential/confirmation, conflicting/out-of-order, amount/merchant/reference, unrecognized status, application failure, and stale attempts. Cases use `OPEN`, `MONITORING`, `RESOLVED`, `CLOSED`, deterministic unique case keys, priorities, observation count, original safe evidence, and immutable identity. Repeated observations update time/count/summary; verified complete/failure resolves matching cases. The scanner covers all specified anomaly classes. There is no manual success boundary or mutation endpoint/control.

## 14. Payment and Attempt Changes

`Payment` adds unique canonical `successfulAttemptId`, `successWebhookEventId`, `successLedgerJournalId`, `providerConfirmedAt`, `reconciliationStatus`, relations to attempts/events/journal/cases, coherence checks, and success-evidence triggers. `PaymentAttempt` adds `providerCredentialVersion`, `providerConfirmedAt`, webhook/case relations, versioned identity protection, immutable established provider reference, and an operational version/status index. DTO/mappers expose safe confirmation/reconciliation fields without customer credential identifiers.

## 15. Ledger Posting Architecture

- Journal type: `EXTERNAL_PAYMENT_RECEIPT`.
- Debit: platform cash-clearing ASSET.
- Credit: platform customer-funds-held LIABILITY.
- Amount/currency: authoritative gross `Payment.amount`, exact ZAR.
- Idempotency: `payfast:payment:<public-reference>:complete:v1`.
- Source: `payfast:payment:<public-reference>:complete` (canonicalized by the shared ledger normalizer).
- Metadata: safe payment/attempt/event/provider-payment references and fee deferral.
- Fees/revenue: no Payfast fees, net settlement, expense, commission, earning, or platform revenue.

## 16. Atomic Transaction

Lock order is event, payment, attempt, and ledger accounts sorted by ID. The shared transaction-aware ledger primitive applies existing normalization, idempotency, balancing, owner/account policy, immutable journal/entries, and projection updates. The same serializable transaction then transitions attempt/payment, assigns the provider reference once, links event/journal/success evidence, writes immutable history, resolves reconciliation, and marks the event applied. Any exception rolls back the entire unit; retry is limited to recognized serialization/deadlock conflicts.

## 17. Duplicate and Replay Handling

An exact duplicate repeats source validation then short-circuits terminal receipt state to stable 200 without provider/payment/ledger mutation. Concurrent identical deliveries converge on the unique fingerprint and locked event. A different fingerprint after success, a changed body with the same provider payment ID, or a different provider payment ID never overwrites evidence; it opens reconciliation and creates no second journal. Temporary receipts may be reverified and applied idempotently.

## 18. Out-of-Order Handling

Stale verified `PENDING` after success is marked ignored and cannot downgrade success. `FAILED` after success preserves success and opens a conflict case. Verified `COMPLETE` after `UNKNOWN`/processing/action-required/non-authoritative failure may establish success. Unknown provider status stays unresolved, moves to processing where legal, records history, and opens reconciliation.

## 19. Production Activation

Authoritative webhook capability, credential-version readiness, source-trust readiness, provider validator, and ledger policy are implemented. `PAYFAST_CREDENTIAL_VERSION` and `PAYMENT_PROXY_MODE` are server-only. `PAYFAST_PRODUCTION_VALIDATION_APPROVED` remains the code constant `false`; production configured state stays inactive with `CONSOLIDATED_VALIDATION_NOT_APPROVED`. Sandbox remains usable, but ITN intake itself fails closed if source trust is absent.

## 20. Permissions

`payment_webhooks.read` and `payment_reconciliation.read` are registered and included in the default admin grant seed. Established permission resolution preserves SUPER_ADMIN behavior and explicit DENY precedence. No Phase 12 mutation permission exists.

## 21. Admin APIs

| Endpoint | Method | Permission | Purpose |
|---|---|---|---|
| `/api/admin/payment-webhooks` | GET | `payment_webhooks.read` | Filtered, paginated safe receipt list |
| `/api/admin/payment-webhooks/[id]` | GET | `payment_webhooks.read` | Safe event/verification/journal/case detail |
| `/api/admin/payment-reconciliation` | GET | `payment_reconciliation.read` | Filtered, paginated case list |
| `/api/admin/payment-reconciliation/[id]` | GET | `payment_reconciliation.read` | Safe case evidence/detail |

## 22. Admin UI

Read-only list/detail screens exist under `/admin/payment-webhooks` and `/admin/payment-reconciliation`, with exact headings, labelled filters, semantic tables, stable pagination, verification checklist, linked public evidence, loading/empty/error states, and navigation entries. The pages show no fingerprint/source, raw payload, signature, credential, payer identity, mark-success, approval, journal-post, or delete control.

## 23. Seed

Permission definitions/default grants and the idempotent platform foundation registry now include both read permissions and `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR` as zero-balance HELD/LIABILITY/ZAR/non-negative. Existing seed upserts provision them idempotently. No payment, event, reconciliation, journal, entry, or non-zero financial evidence is seeded.

## 24. Migration

Folder: `prisma/migrations/20260717040000_phase12_payfast_itn_reconciliation`.

It adds enums, event evidence columns/states, reconciliation table, payment/attempt success links, receipt journal type, indexes, foreign keys, checks, and immutability/coherence triggers. It fails if the webhook placeholder contains any row, retains the Phase 4 columns as null-only compatibility fields, and fabricates no verification/success. Prior migrations were not edited. The migration was prepared only and not executed.

## 25. Preflight and Invariant Scripts

Preflight checks: unsupported legacy event rows/states; populated Phase 4 compatibility fields; incoherent cases; success without complete evidence; provider reference without verified event; partial ledger links; duplicate provider references; missing Payfast credential version; non-ZAR evidence; payment/attempt amount divergence; held account absence/conflict; incompatible production attempts.

Invariant checks: unique fingerprints; APPLIED relation coherence; null legacy compatibility fields; successful verified COMPLETE evidence; exactly linked receipt journal; journal amount/ZAR/balance; cash debit; held credit; one receipt per payment; event/attempt/payment/provider-reference coherence; no FAILED/PENDING journal; stale ignore preserves success; canonical event/journal links; unique/coherent cases; no fee journal; no production attempt before approval; no prohibited safe-persistence material; no redirect/session/origin authority; no Order/refund writer; no runtime compatibility-field writer/reader or DTO exposure. The scanner checks stale UNKNOWN/PROCESSING/action-required attempts, active credential mismatch, verified-unapplied and repeated temporary events, missing success evidence, orphan receipt journals, and provider-reference conflict.

## 26. Unit and Policy Tests Written

| Test file | Coverage |
|---|---|
| `payfast-itn-parser.test.ts` | Ordering, decoding, Unicode, limits, duplicates, pollution/null/malformed input |
| `payfast-itn-parameter-string.test.ts` | Hardcoded canonical confirmation body, no signature/passphrase, shared ordered range, empty/unknown fields, encoder/Unicode normalization, and signature-position rejection |
| `payfast-itn-fields.test.ts` | Required fields, safe snapshot, unknown count, exact optional fee/net audit values |
| `payfast-itn-signature.test.ts` | Independent vector, order/field changes, empty/unknown fields, constant-time path, secret safety |
| `payfast-itn-amount.test.ts` | Exact positive ZAR Decimal and invalid formats/no tolerance |
| `payfast-itn-status-policy.test.ts` | Complete/pending/failed/unknown, duplicate and out-of-order precedence |
| `payfast-source-address.test.ts` | Proxy modes, canonical header, normalization, spoof/list/private rejection |
| `payfast-source-ip-resolver.test.ts` | A/AAAA, membership, proactive refresh, stale grace, expiry/DNS failure |
| `payfast-itn-validation-client.test.ts` | Pinned exact canonical-body POST, VALID, status/body/size/redirect/timeout/no retry |
| `payfast-webhook-fingerprint.test.ts` | Exact byte/environment identity |
| `payfast-event-policy.test.ts` | Terminal/retry event states |
| `payfast-reconciliation-policy.test.ts` | Reason priority/summary policy |
| `payfast-ledger-posting-policy.test.ts` | Exact debit/credit/gross/idempotency/safe metadata/no revenue/fee and shared normalization |
| `payfast-production-readiness.test.ts` | Capability booleans and production validation lock |
| `payfast-phase12-source-audit.test.ts` | No cross-domain writers, copied IPs, arbitrary validation URL, session authority |
| `payfast-phase12-admin-ui-contract.test.ts` | Exact headings, read-only controls, forbidden evidence absence |
| `payfast-itn-transport.test.ts` | Content type, declared/streamed limit, timeout, UTF-8 |

Only the test files explicitly named in section 32 were executed.

## 27. Service Tests Written

| Test file | Coverage |
|---|---|
| `payfast-itn-resolution.service.test.ts` | Exact resolution, missing/wrong provider, version/environment mismatch, safe failure |
| `payfast-itn-verification.service.test.ts` | Full gates, source-first, signature, merchant/amount, credential, confirmation unavailable/invalid, unknown, no transaction around network |
| `payfast-itn-application.service.test.ts` | Complete transaction double, locks, journal/entries/projections/state/history/case update, serialization retry, conflict/stale/unknown/rollback branches, no Order/network |
| `payment-reconciliation.service.test.ts` | Idempotent create/observation and immutable history |
| `payment-confirmation-query.service.test.ts` | Safe read mapping, fingerprint/source omission, no mutation |

## 28. API Tests Written

| Test file | Coverage |
|---|---|
| `payfast-itn.test.ts` | POST-only, content type, declared/stream overflow, safe acknowledgements, source/signature/form/amount/conflict/temporary errors, no session/origin/redirect |
| `admin-payment-webhooks.test.ts` | Auth/permission/filter/pagination/safe list/no mutation |
| `admin-payment-webhook-detail.test.ts` | Auth/permission/safe detail/not-found/no secrets/mutation |
| `admin-payment-reconciliation.test.ts` | Auth/permission/filter/pagination/safe list/no mutation |
| `admin-payment-reconciliation-detail.test.ts` | Auth/permission/safe evidence/not-found/no success mutation |

## 29. PostgreSQL Integration Scenarios Written

| Scenario | Expected invariant |
|---|---|
| verified COMPLETE | One verified receipt, success attempt/payment, one balanced linked journal, unchanged Order |
| exact duplicate | One fingerprint receipt and no second financial mutation |
| concurrent duplicate | One applied result/journal/projection update |
| provider-reference conflict | Established reference preserved; case; no second journal |
| invalid source | No application/payment/journal |
| invalid signature | No application |
| amount mismatch | Exact amount unchanged; no success/journal; case where resolved |
| merchant mismatch | No application |
| confirmation unavailable | Retryable receipt; no applied event/journal |
| PENDING | Processing states; no journal |
| FAILED | Legal failure; no journal |
| stale PENDING | Success and journal unchanged; ignored receipt |
| FAILED after success | Success preserved; conflict case; journal unchanged |
| COMPLETE after UNKNOWN | Verified success and exactly one journal |
| rollback | Journal/entries/projections/payment/attempt/event all roll back |
| lock-order race | Deterministic event/payment/attempt/account ordering; no persistent deadlock |
| credential mismatch | No guessing/verification/journal; case |
| reconciliation scan | Stale UNKNOWN case upserts once |
| cross-module boundary | Order/dispatch/driver/pricing unchanged |

These scenarios are written in the six required `payfast-itn-*.integration.test.ts` files and were not executed.

## 30. E2E Scenarios Written

| Flow | Coverage |
|---|---|
| return before ITN | Pending customer state; no success/order mutation |
| verified fixture notification | Controlled local ITN succeeds payment and status only |
| duplicate fixture | No duplicate success/journal |
| webhook admin inspection | Exact heading, verification and journal; no body/signature |
| reconciliation admin inspection | Exact heading/case; no mark-success |
| permission denial | Non-admin and explicit DENY rejected |
| secret safety | Visible text, storage, URLs and JSON exclude credentials/signature/body/hash |

The browser scaffolding was not executed.

## 31. Files Changed

- Configuration/CI: `.env.example`, `.env.docker.example`, `.github/workflows/ci.yml`, `package.json`, `vitest.payfast-confirmation-integration.config.ts`, `vitest.payfast-integration.config.ts` — server configuration, scripts and deferred job isolation.
- Database: `prisma/schema.prisma`, `prisma/migrations/20260717040000_phase12_payfast_itn_reconciliation/migration.sql`, `types/db.ts` — models/enums/SQL/type exports.
- Permissions/foundations/navigation: `lib/auth/permission-keys.ts`, `lib/constants/foundation-models.ts`, `lib/constants/navigation.ts` — read permissions, held account and admin links.
- Provider/payment contracts: `lib/payments/errors.ts`, `lib/payments/types.ts`, `lib/payments/payment-dto-mappers.ts`, `lib/dto/payment.dto.ts`, `lib/payments/providers/payment-provider-adapter.ts`, `lib/payments/providers/provider-config.ts`, `lib/payments/providers/payment-provider-registry.ts`, `lib/payments/providers/payfast/payfast-adapter.ts`, `lib/payments/providers/payfast/payfast-config.ts` — readiness/capability/version/evidence contracts.
- Payfast runtime: `lib/payments/providers/payfast/payfast-itn-transport.ts`, `payfast-itn-parser.ts`, `payfast-itn-parameter-string.ts`, `payfast-itn-fields.ts`, `payfast-itn-signature.ts`, `payfast-itn-amount.ts`, `payfast-itn-status-policy.ts`, `payfast-itn-validation-client.ts`, `payfast-itn-rate-limit.ts`, `payfast-itn-observability.ts`, `payfast-source-address.ts`, `payfast-source-hosts.ts`, `payfast-source-ip-resolver.ts`, `payfast-webhook-fingerprint.ts`, `payfast-event-policy.ts`, `payfast-reconciliation-policy.ts`, `payfast-ledger-posting-policy.ts` — transport and verification policies.
- Services/ledger: `lib/services/payfast-itn-resolution.service.ts`, `payfast-itn-verification.service.ts`, `payfast-itn-application.service.ts`, `payment-reconciliation.service.ts`, `payment-confirmation-query.service.ts`, `payfast-checkout.service.ts`, `payment-provider-session.service.ts`, `ledger-posting.service.ts`, `lib/ledger/types.ts`, `lib/ledger/posting-normalization.ts` — versioned attempt preparation/reconstruction and atomic application.
- Validation/DTO/admin components: `lib/validation/payment-confirmation.ts`, `lib/dto/payment-confirmation.dto.ts`, `components/admin/PaymentConfirmationFilters.tsx`, `components/admin/PaymentConfirmationTables.tsx` — safe filters/projections/tables.
- Public/admin APIs: `app/api/payments/payfast/itn/route.ts`, `app/api/admin/payment-webhooks/route.ts`, `app/api/admin/payment-webhooks/[id]/route.ts`, `app/api/admin/payment-reconciliation/route.ts`, `app/api/admin/payment-reconciliation/[id]/route.ts` — public intake and read-only inspection.
- Admin pages: `app/(admin)/admin/payment-webhooks/page.tsx`, `[id]/page.tsx`, `loading.tsx`, `error.tsx`; `app/(admin)/admin/payment-reconciliation/page.tsx`, `[id]/page.tsx`, `loading.tsx`, `error.tsx` — list/detail UI states.
- Operations: `scripts/phase12-payfast-itn-preflight.mjs`, `verify-payment-confirmation-invariants.mjs`, `scan-payment-reconciliation.mjs`, `payfast-confirmation-integration-test.mjs`, plus evolved `scripts/verify-payment-invariants.mjs` — safety checks/scanner/deferred runner.
- Required unit/policy tests: all 16 files listed in section 26 plus `tests/payments/payfast/payfast-itn-test-fixtures.ts`.
- Required service/API tests: all files listed in sections 27–28.
- Integration scaffolding: `tests/integration/payfast-itn-fixtures.ts` and the six required `tests/integration/payfast-itn-{verification,application,concurrency,ledger,reconciliation,invariants}.integration.test.ts` files.
- E2E scaffolding: `tests/e2e/payfast-confirmation-customer.spec.ts`, `tests/e2e/payfast-confirmation-admin.spec.ts`; evolved `tests/e2e/payment-foundation-admin.spec.ts` for versioned attempt fixtures.
- Propagated fixtures/contracts: `tests/payments/fake-payment-provider.ts`, `tests/payments/payfast/payfast-test-fixtures.ts`, `payfast-config.test.ts`, `payfast-source-audit.test.ts`, `tests/services/payfast-checkout.service.test.ts`, `payment-provider-session.service.test.ts`, `tests/integration/payfast-fixtures.ts`, `payfast-configuration.integration.test.ts`, `tests/database/seed-foundations.test.ts`.
- Documentation: `docs/phase-12-implementation-map.md`, `phase-12-payfast-itn-reconciliation.md`, `payments/payfast-itn-security.md`, `payments/payfast-itn-signature.md`, `payments/payment-confirmation-ledger.md`, `payments/payment-reconciliation.md`, `testing/payfast-confirmation-integration.md`, `deferred-validation/phase-12-risk-register.md`, and this report.
- Removed obsolete assertion: `tests/api/payfast-itn-reserved.test.ts` — Phase 11's intentional 501 contract no longer applies.

## 32. Lightweight Checks Actually Run

- Independent PowerShell/.NET MD5 calculation produced the fixed digest `3af95032720fc38f5d83197919f2329f`.
- `npx prisma format` — passed; schema formatted.
- `npx vitest run tests/payments/payfast/payfast-itn-parser.test.ts tests/payments/payfast/payfast-itn-signature.test.ts tests/payments/payfast/payfast-itn-status-policy.test.ts` — 3 files, 29 tests passed.
- File-scoped ESLint over new runtime/admin files — initially found eight React JSX-in-try errors; pages were corrected; rerun passed.
- File-scoped ESLint over new policy/service/API tests and modified ledger/checkout files — passed.
- File-scoped ESLint over later observability/history/DNS/test changes — passed.
- `npx vitest run tests/payments/payfast/payfast-itn-fields.test.ts tests/payments/payfast/payfast-ledger-posting-policy.test.ts tests/services/payfast-itn-application.service.test.ts` — first run: 2 files passed and the new application double had 4 fixture/assertion failures; test double was corrected; rerun: 3 files, 15 tests passed.
- Final file-scoped ESLint plus `npx vitest run tests/services/payfast-itn-application.service.test.ts` after the concurrent-receipt convergence fix — lint passed; 1 file, 5 tests passed.
- Final file-scoped ESLint plus `npx vitest run tests/payments/payfast/payfast-itn-fields.test.ts tests/services/payfast-itn-application.service.test.ts tests/services/payment-provider-session.service.test.ts` after terminal-state and DTO hardening — lint passed; 3 files, 20 tests passed.
- `git diff --check` — exited 0 with no whitespace errors; Git emitted only existing LF-to-CRLF working-copy warnings. The repository's Phase 1–12 foundation files remain largely untracked, so this command covers the tracked diff only.
- Targeted `rg -n '[ \t]+$'` scan across the untracked Phase 12 runtime, migration, tests and documentation — no trailing-whitespace matches.

These are lightweight checks only, not deep validation.

## 33. Validation Deferred

No package installation/update/audit, Docker operation, PostgreSQL startup, migration application/reset/push, seed execution, full tests, coverage, typecheck, production build, real Payfast checkout/ITN/query-validation request, public tunnel, browser E2E, CI execution, or dependency remediation occurred.

## 34. Deferred Validation Risk Register

Migration/bootstrap, Prisma generation/typecheck/build, actual Next raw-stream handling, reverse-proxy stripping, live Payfast DNS/source addresses, official signature and amount formats, real server confirmation, PostgreSQL duplicate/conflict races, ledger rollback/lock order, credential-drain operations, public HTTPS, logs/traces/database/bundle security, production fail-closed behavior, customer/admin browser flows, and live cross-module non-mutation remain deferred. Phase 10/11 risks are carried in `docs/deferred-validation/phase-12-risk-register.md`.

## 35. New Dependencies

None.

## 36. Bugs Found and Fixed

| Bug | Root cause | Fix | Code/test evidence |
|---|---|---|---|
| Receipt journal rejected by shared ledger | New enum/type was added to contracts but omitted from runtime journal allowlist | Added `EXTERNAL_PAYMENT_RECEIPT` to shared normalizer | Ledger-policy normalization test passes |
| Checkout reconstruction could cross credential rotation | Audit comparison omitted the stored credential version | Compare adapter and attempt credential versions | Checkout service mismatch test |
| Raw placeholder payload sink/schema drift | Phase 4 compatibility columns conflicted with additive migration policy | Retained all columns as ignored null-only mappings; new Phase 12 state uses `itnProcessingStatus`; cleanup deferred | Migration, schema, preflight, invariant script |
| Optional fee/net audit text was not Decimal-shaped | Allowlisting preceded exact optional validation | Added bounded signed two-decimal validation | Fields policy test |
| Reconciliation open/resolve lacked immutable history | Case service only wrote case rows | Added open/reopen/resolve history references | Reconciliation service test |
| DNS refreshed only after expiry | Initial cache returned until expiration | Added 80% proactive refresh with bounded stale grace | Resolver test |
| Confirmation invariant falsely matched schema key names | Full event row JSON included verification column names such as signature | Scan only persisted safe text fields | Invariant script |
| Scanner missed active-version mismatch/repeated temporary failures | Initial anomaly set was incomplete | Added both idempotent scan classes and removed undefined ID | Scanner source/integration scaffolding |
| Admin list lint violation | JSX was constructed inside catch scopes | Isolated data loading and rendered outside try/catch | File-scoped ESLint pass |
| Phase 11 tests still required reserved 501 route | Historical assertion was not advanced with the architecture | Removed obsolete test and narrowed Phase 11 source audit | Phase 12 API/source tests |
| Concurrent verified replay could rewrite receipt time | Nonterminal receipt promotion did not distinguish already-verified evidence | Reuse `VERIFIED` receipt without update and keep rejected/reconciliation receipts terminal | Application service convergence test and SQL trigger |
| Verified failure could overwrite cancelled/expired attempt | Failure branch did not distinguish unresolved from terminal local states | Reconcile terminal out-of-order failure instead of rewriting it | Application policy/source test |
| Credential version leaked through customer attempt DTO | Schema propagation added an operational identifier to a shared customer response mapper | Removed it from `PaymentAttemptDto`/mapper; retained only server-side evidence | Provider-session DTO assertion |

## 37. Architect Review Items

- Confirm the pinned sandbox/production Payfast hostname grouping and exact ITN/signature/query-validation compatibility against current official sandbox behavior.
- Approve and verify the deployment source strategy: single trusted proxy with header stripping/direct-access prevention, or a runtime adapter that exposes a true peer address.
- Approve the credential-rotation drain/monitoring runbook and disposition of any existing nonterminal Payfast attempts whose version cannot be inferred.
- If the migration finds a placeholder event row, decide its manual disposition; the migration intentionally refuses to fabricate Phase 12 evidence.
- Authorize the disposable consolidated validation gate before production approval can change.

## 38. Progression Readiness

READY FOR ARCHITECT IMPLEMENTATION REVIEW

## 39. Final Confirmation

- Implementation-only workflow followed.
- No packages downloaded; no Docker operated; no migration or seed executed.
- No full tests, coverage, typecheck, production build, real Payfast request, browser, or CI executed.
- No prior migration modified; no shared/production database modified; no canonical/retained volume deleted.
- South African Payfast only; production checkout remains locked.
- Browser return does not mark success; only verified ITN may mark success.
- Signature uses constant-time comparison; amount uses exact Decimal; source validation fails closed.
- One payment receipt journal maximum; ledger posting is atomic with payment success.
- Cash-clearing ASSET is debited; held-liability is credited; no platform revenue or Payfast fee is posted.
- No Order status, refund, withdrawal, earnings, commission, or settlement mutation was added.
- No credential, raw body, signature/base, payer contact data, full headers, or validation response is stored or exposed.

IMPLEMENTATION COMPLETE — DEEP VALIDATION DEFERRED

READY FOR ARCHITECT IMPLEMENTATION REVIEW
