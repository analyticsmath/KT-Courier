# KT Couriers Phase 11 Implementation Report

## 1. Executive Summary

IMPLEMENTATION COMPLETE — DEEP VALIDATION DEFERRED

Phase 11 implements the South African Payfast custom form-POST handoff, its provider-neutral contract extension, sandbox-only runtime readiness, customer initiation/status surfaces, non-authoritative return/cancel pages, persistence audit scaffold, tests, disposable integration/E2E scaffolds, and security/operations documentation. Only explicitly permitted lightweight checks were run; the database, migration, generated Prisma client, build, browser, Docker, CI, and real provider remain unvalidated.

## 2. Provider Identity

- Provider: South African Payfast by Network.
- Runtime domains: `sandbox.payfast.co.za` and inactive `www.payfast.co.za` only.
- No Pakistani PayFast implementation or domain is present in the runtime integration.
- Integration method: server-generated, signed custom HTML form POST.

## 3. Prior-Defect Prevention

| Defect pattern | Phase 11 prevention | Files |
|---|---|---|
| Wrong provider identity | Named identity constant, pinned `.co.za` endpoints, runtime source audit | `payfast-config.ts`, `payfast-provider-identity.test.ts`, `payfast-source-audit.test.ts` |
| Schema/DTO drift | Explicit audit columns/enums propagated through mappers, admin DTOs, and customer-safe DTOs | `schema.prisma`, migration, `payment.dto.ts`, `payment-dto-mappers.ts` |
| Signed/post field mismatch | One normalized frozen object is signed, returned, and enumerated as the form field map | `payfast-signature.ts`, `PayfastAutoSubmitForm.tsx` |
| Incorrect field order | Closed `PAYFAST_V1_FIELD_ORDER`; unsupported keys fail closed | `payfast-fields.ts`, `payfast-fields.test.ts` |
| Incorrect URL encoding | Byte-level UTF-8 PHP-`urlencode` implementation and special-character vectors | `payfast-url-encoding.ts`, `payfast-url-encoding.test.ts` |
| Secret leakage | Passphrase never leaves signer; snapshots/DTOs omit credentials and full fields; no client storage | `payfast-signature.ts`, `provider-snapshot-policy.ts`, `payfast-snapshot-safety.test.ts` |
| Network inside transaction | Existing reserve/call/finalize boundary retained; Payfast adapter performs local computation only | `payment-provider-session.service.ts`, `payfast-adapter.ts` |
| Public security bypass | Auth, role, ownership, same-origin, UUID operations, body limits, and rate limits | customer API routes, `customer-api-policy.ts` |
| Browser return authority | Return/cancel are owned reads only; reserved ITN rejects without processing | return/cancel pages, ITN route |
| Unsafe production activation | Code-level production lock tied to absent authoritative confirmation capability | `payfast-config.ts`, registry, adapter |
| UI/E2E mismatch | E2E targets the real UI and intercepts the exact pinned POST endpoint locally | `payfast-checkout.spec.ts` |
| Inaccurate reporting | This report separates written coverage from the small executed subset and lists deferred proof | this report, deferred risk register |

## 4. Existing Phase 10 Contract Audit

Phase 10 exposed an optional `redirectUrl`, a redirect-only capability, a registry with no live PAYFAST adapter, and a reserve/call/finalize orchestration that persisted GET redirects. The mandatory pre-implementation audit found that this could not faithfully represent Payfast's browser POST. Phase 11 replaces adapter-boundary redirect transport with a `ProviderCustomerAction` union, adds form-POST and authoritative-confirmation capabilities, leaves the existing nullable redirect column for future GET providers, validates action-specific fields, and stores only non-secret action audit metadata. Registry configuration is now resolved before reservation so invalid, disabled, or production-locked configuration consumes no attempt.

## 5. Final Payfast Architecture

The configuration module resolves server-only mode/credentials/origin against internal endpoint constants. A closed field builder derives provider values from authoritative application records. A byte-level encoder implements PHP `urlencode`; the signer applies the ordered field protocol, appends the encoded passphrase, and emits lowercase MD5. The request builder returns one frozen signed map. The Payfast adapter wraps that map in a non-definitive `FORM_POST` action without a network request. The central registry constructs it only for valid sandbox configuration.

Authenticated APIs prepare the payment and reserve/finalize an attempt, then return only an internal checkout URL. The owned no-store checkout page reconstructs the deterministic signed action and renders its exact fields. Return and cancel pages read only the current local payment; they never infer a provider outcome.

## 6. Provider Contract Changes

- `ProviderCustomerAction` is a discriminated union of `REDIRECT_GET` and `FORM_POST`.
- `FORM_POST` carries an immutable HTTPS URL, frozen string field map, and optional expiry.
- Capabilities add `supportsFormPostCheckout` and `supportsAuthoritativeWebhookConfirmation`.
- Provider results now expose `customerAction` instead of a direct redirect URL.
- Attempt DTOs expose public reference/environment/action/protocol audit; customer DTOs expose no internal IDs or provider material.
- The union preserves future redirect providers without modeling Payfast as a query-string redirect.

## 7. Configuration

- Server variables: `PAYFAST_MODE`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYMENT_APP_ORIGIN`.
- Allowed modes: `disabled`, `sandbox`, `production`; endpoints are not configurable.
- Valid sandbox configuration is `configured: true`, `active: true`.
- Valid production configuration is visible but `active: false` with `AUTHORITATIVE_CONFIRMATION_NOT_IMPLEMENTED`.
- Invalid values are categorized as configuration errors; secrets are never returned by readiness DTOs.
- Readiness exposes code, safe environment, configured/active state, block reason, and capabilities only.

## 8. Signature Implementation

- Ordered unsigned fields: merchant ID/key, return/cancel/notify URLs, optional names, email, merchant payment ID, amount, item name, optional description.
- Empty optional values are omitted; required empty values fail closed.
- Values normalize to trimmed NFC strings and are encoded as UTF-8 PHP `urlencode` bytes.
- The required non-empty passphrase is appended as an encoded `passphrase` pair and is never returned.
- The protocol-required MD5 output is lowercase hexadecimal.
- The exact normalized map used for signing becomes the posted map; `signature` is appended afterward.
- Independent fixed vector: `8b36dff459ec9656d0d625fc4610caee`, established with .NET UTF-8/MD5 and covered by the focused suite.

## 9. Payfast Fields

| Field | Source | Required | Persisted |
|---|---|---:|---:|
| `merchant_id` | Server environment | Yes | No |
| `merchant_key` | Server environment | Yes | No |
| `return_url` | Pinned server callback builder | Yes | No |
| `cancel_url` | Pinned server callback builder | Yes | No |
| `notify_url` | Pinned reserved ITN callback | Yes | No |
| `name_first` | Authenticated database user name or safe fallback | No | No form copy |
| `name_last` | Authenticated database user name | No | No form copy |
| `email_address` | Authenticated database user email | Yes | Existing user record only |
| `m_payment_id` | Immutable attempt merchant reference | Yes | Yes, as `merchantReference` |
| `amount` | Server payment/accepted quote | Yes | Yes, payment and attempt amount |
| `item_name` | Server order public reference | Yes | No form copy |
| `item_description` | Fixed non-sensitive server text | No | No form copy |
| `signature` | Server signer | Yes | No |

## 10. Server-Authoritative Payment Data

The server resolves the owned payable order, payer, database email/name, accepted-quote amount, ZAR currency, public order reference, and fixed description. Preparation and checkout bodies accept only UUID operation IDs. Client-supplied amount, currency, provider, payer, email, item text, callback URL, merchant reference, endpoint, mode, or signature fields are rejected by strict schemas or are absent from the contract.

## 11. Provider Adapter

Input contains stable merchant/payment references, exact amount/currency, hashed customer reference, authoritative email/name/order reference, server callbacks, and description. Output is non-definitive `REQUIRES_ACTION` with a `FORM_POST` action to `https://sandbox.payfast.co.za/eng/process`, no provider reference, `CHECKOUT_FORM_READY`, and safe version/environment metadata. Construction is deterministic/local and makes no provider network call.

## 12. Payment and Attempt Lifecycle

Preparation idempotently creates the server-authoritative payment. Session preflight resolves an active sandbox adapter before mutation. A Serializable transaction locks the payment, rejects unresolved attempts, allocates a stable attempt/merchant reference, and records `RESERVED`/`PROVIDER_PENDING`. Local form preparation runs after commit; finalization records `REQUIRES_ACTION` plus safe action audit and discards the signed fields. The checkout page reconstructs the action for the current owned attempt. Return and cancel navigation perform no write. Authoritative provider results, success, reconciliation, order effects, and ledger effects are deferred to Phase 12 or later authorized phases.

## 13. APIs

| Endpoint | Method | Authorization | Purpose |
|---|---|---|---|
| `/api/orders/[orderId]/payment` | POST | Authenticated active CUSTOMER/STORE owner; same-origin; rate-limited | Idempotently prepare an exact server-authoritative payment |
| `/api/payments/[publicReference]/checkout-session` | POST | Authenticated owner; same-origin; rate-limited | Server-select Payfast, reserve/finalize action, return internal checkout URL |
| `/api/payments/[publicReference]` | GET | Authenticated owner; rate-limited | Return safe current local payment status |
| `/api/payments/payfast/itn` | POST | Public provider reservation with strict content type/declared size | Return controlled non-success without reading or processing the body |

## 14. Customer UI

The owned payment page displays the server amount/status, Payfast action, and a prominent sandbox/no-real-money indicator. Retry-safe operation IDs live in component memory only and are reused after an ambiguous client error. The internal owned checkout page renders the exact signed hidden inputs, one-shot `requestSubmit`, a visible manual fallback, live-status text, and ordinary accessible controls. The return page states confirmation is pending and uses bounded no-store polling. The cancel page explicitly states no final result was inferred. Both pages provide navigation back to payment details and perform no mutation.

## 15. Prisma and Migration

- Migration folder: `prisma/migrations/20260717030000_phase11_payfast_integration_v1`.
- Enums: `PaymentProviderEnvironment` (`SANDBOX`, `PRODUCTION`) and `PaymentCustomerActionType` (`FORM_POST`, `REDIRECT_GET`).
- Fields: optional unique `publicReference`, environment, action type, checkout-prepared timestamp, protocol version, and non-secret configuration fingerprint.
- Constraints/indexes: unique public reference, reference/length checks, Payfast merchant-reference bound, complete-action audit check, form-post/no-redirect check, and immutable-trigger extension.
- All prior migration contents remain unchanged.
- The new migration was written but not executed.

## 16. Security

- Credentials remain server-side; passphrase is never output, and no real credential is committed.
- Sandbox/live processing URLs are pinned internal constants and HTTPS allowlisted.
- Production is code-locked without a public/environment bypass.
- Callback URLs use the exact HTTPS root `PAYMENT_APP_ORIGIN` and fixed route builders.
- Pages/APIs are no-store; payment pages are noindex.
- No logging/analytics path receives signed fields, signature bases, passphrases, or credentials.
- No local/session storage is used; operation IDs are in memory.
- Safe snapshots exclude payer email, callback values, full fields, Merchant Key, passphrase, and signature.
- Test adapters/config are dependency-injected; runtime security checks have no test-only public bypass.

## 17. Ledger, Wallet, and Order Boundaries

Phase 11 posts no ledger journal, mutates no wallet balance or wallet transaction, changes no order status, changes no price/quote, and performs no dispatch/assignment/driver mutation. Payment preparation/action state is the only financial-domain write introduced by the customer flow.

## 18. ITN Boundary

No ITN is processed. The reserved route validates only method/content type/declared size, deliberately does not read the body, performs no persistence, and returns HTTP 501. Browser navigation and the reserved route cannot infer success. ITN authentication, signature/source/amount verification, replay protection, confirmation, reconciliation, and authoritative state transitions belong to Phase 12.

## 19. Admin Readiness

Admin provider readiness displays safe sandbox/production/not-configured state, configured/active flags, block reason, and provider capabilities including form POST and absent authoritative webhook support. It exposes no merchant values, passphrase, endpoint override, or credential fingerprint, and provides no mutation/activation controls.

## 20. Seed and Environment Examples

`.env.example` and `.env.docker.example` contain names/placeholders only, not usable credentials. Seed code was not given payment/attempt/ITN fixtures. No production mode is enabled by examples or seed.

## 21. Preflight and Invariant Scripts

- `phase11-payfast-preflight.mjs`: live fail-closed checks for Phase 10 payment/attempt compatibility, unsupported providers, merchant/public references, form-action audit, state pairs, ZAR values, unsafe snapshots, premature provider references, and production attempts.
- `verify-payfast-invariants.mjs`: live disposable-database checks for attempt audit completeness, no persisted secrets/form material, FORM_POST/no redirect, production absence, and cross-module non-effects.
- `payfast-integration-test.mjs`: unique disposable Compose/database runner with migration/seed/preflight/serial integration/invariant stages and guarded deletion of only its own volume.
- Package scripts expose `db:preflight:payfast`, `db:verify:payfast`, and `test:integration:payfast`.
- Deferred CI jobs are explicitly gated by `ENABLE_DEFERRED_PAYFAST_VALIDATION`.

## 22. Unit and Policy Tests Written

| Test file | Coverage |
|---|---|
| `payfast-provider-identity.test.ts` | South African identity and official domains |
| `payfast-config.test.ts` | Disabled/invalid/sandbox/production resolution, pinned endpoints, secret-safe readiness |
| `payfast-url-encoding.test.ts` | PHP-compatible ASCII, punctuation, spaces, percent, and Unicode encoding |
| `payfast-fields.test.ts` | Closed order, required/optional normalization, limits, amount/email/reference policy |
| `payfast-signature.test.ts` | Independent digest, signed-map immutability, field sensitivity, passphrase requirement |
| `payfast-callback-urls.test.ts` | Fixed HTTPS callback paths and invalid-origin/reference rejection |
| `payfast-checkout-request.test.ts` | Server field derivation, exact amount, name/item/callback rules |
| `payfast-adapter.test.ts` | Capability declaration, local FORM_POST result, no provider reference, production/abort failure |
| `payfast-registry.test.ts` | Sandbox construction/readiness and production fail-closed behavior |
| `payfast-snapshot-safety.test.ts` | Credential/email/full-form absence from persisted snapshots |
| `payfast-source-audit.test.ts` | Runtime provider/domain identity, no client imports, no mutation/logging hazards |
| `provider-result-validation.test.ts` | Frozen action/capability/URL/form validation for both union members |
| `provider-retry-policy.test.ts` | Capability-aligned retry policy remains conservative |
| `order-boundary-source-audit.test.ts` | Payment code does not invoke order mutation surfaces |

Only the URL-encoding, signature, and adapter files above were executed in the permitted focused run; other written tests are not reported as passed.

## 23. Service Tests Written

| Test file | Coverage |
|---|---|
| `payfast-checkout.service.test.ts` | Ownership/current-attempt/config-audit reconstruction policy |
| `payment-customer-query.service.test.ts` | Owned safe status/page DTOs and non-disclosure |
| `payment-provider-session.service.test.ts` | FORM_POST reservation/finalization/replay and transaction/network boundary |
| `payment-provider-registry.test.ts` | Readiness/adapter construction compatibility |
| `payment-preparation.service.test.ts` | Authoritative payer email/preparation compatibility |

These service tests were written/updated but not executed in this workflow.

## 24. API and Frontend Tests Written

| Test file | Coverage |
|---|---|
| `order-payment-prepare.test.ts` | Auth, same-origin/body/operation contract, server authority |
| `payfast-checkout-session.test.ts` | Ownership-before-readiness, server provider choice, internal handoff URL |
| `payment-status.test.ts` | Owned status and safe 404 behavior |
| `payfast-itn-reserved.test.ts` | Controlled non-success and no body processing |
| `payfast-payment-page.test.ts` | Amount/readiness/sandbox customer surface |
| `payfast-auto-submit-form.test.ts` | POST form, exact hidden map, one-shot submit, fallback/accessibility |
| `payfast-return-page.test.ts` | Pending/non-authoritative language and safe polling |
| `payfast-cancel-page.test.ts` | No cancellation/success inference or mutation |
| `payfast-client-operation.test.ts` | In-memory stable operation IDs and explicit clearing |
| `payfast-admin-ui-contract.test.ts` | Safe readiness/action/environment audit presentation |

These API/frontend tests were written but not executed in this workflow.

## 25. PostgreSQL Integration Scenarios Written

| Scenario | Expected invariant |
|---|---|
| preparation | One owned exact-ZAR payment; idempotent replay; no provider attempt yet |
| checkout reservation | One locked counter/reference and complete sandbox audit |
| form fields | Exact allowed normalized provider field set |
| signed/post equality | Posted field values are the same map covered by the signature |
| replay | Same operation key reuses payment/attempt/reference |
| attempt race | At most one winner/current unresolved attempt and monotonic counter |
| configuration failure | Disabled/invalid config creates no attempt |
| production lock | Valid production config remains inactive and creates no attempt |
| wrong payer | Non-owner gets no payment/action/internal identity |
| return navigation | Read only; no payment/order/ledger mutation |
| cancel navigation | Read only; no cancel/delete/refund mutation |
| reserved ITN | No body processing, provider evidence, or state transition |
| secret persistence | No passphrase, credential, signature, base, or complete fields in database/snapshots |
| cross-module boundaries | Ledger/wallet/order/pricing/dispatch/driver rows remain unchanged |

The scenarios are implemented across the six `tests/integration/payfast-*.integration.test.ts` files and shared `payfast-fixtures.ts`; none were executed.

## 26. E2E Scenarios Written

| Flow | Coverage |
|---|---|
| payment preparation | Real customer UI/API path with server amount |
| form POST handoff | Exact sandbox-host POST intercepted and fulfilled locally |
| return page | Pending language/status with no success inference |
| cancel page | Navigation-only state with retry path |
| wrong customer | Checkout/status non-disclosure |
| production lock | Conditional configured-production inactive surface |
| admin readiness | Safe environment/capability/block-reason display |
| secret safety | No passphrase/credential material in URLs or application JSON/storage |

`tests/e2e/payfast-checkout.spec.ts` contains these deferred flows. No browser was executed.

## 27. Files Changed

| File | Purpose |
|---|---|
| `.env.example`, `.env.docker.example` | Server-only Payfast placeholder configuration |
| `.github/workflows/ci.yml` | Opt-in deferred Payfast integration/E2E jobs |
| `next.config.ts` | No-store/noindex headers for payment pages |
| `package.json` | Payfast preflight/invariant/integration scripts; no dependency change |
| `prisma/schema.prisma` | Attempt public reference and safe checkout audit model |
| `prisma/migrations/20260717030000_phase11_payfast_integration_v1/migration.sql` | Additive enums/columns/index/checks/immutability update |
| `types/db.ts`, `types/domain.ts` | New database enum exports and domain value types |
| `lib/dto/payment.dto.ts` | Audit-aligned attempt and customer-safe DTOs |
| `lib/payments/types.ts`, `lib/payments/errors.ts` | Action/environment/policy types and Payfast failures |
| `lib/payments/payment-dto-mappers.ts` | Map new attempt audit fields |
| `lib/payments/client-operation.ts` | In-memory retry-safe operation ID store |
| `lib/payments/customer-api-policy.ts` | No-store JSON, strict body policy, safe error mapping |
| `lib/payments/providers/payment-provider-adapter.ts` | Customer-action union and capability/audit contract |
| `lib/payments/providers/provider-config.ts` | Safe configuration category/block reason |
| `lib/payments/providers/payment-provider-registry.ts` | Sandbox adapter construction and fail-closed readiness |
| `lib/payments/providers/provider-result-validation.ts` | Immutable action/URL/field/capability validation |
| `lib/payments/providers/provider-retry-policy.ts` | Capability-compatible conservative retry policy |
| `lib/payments/return-url-policy.ts` | Fixed Payfast return/cancel/notification routes |
| `lib/payments/providers/payfast/payfast-config.ts` | Identity, endpoints, environment/secret/origin resolution, production lock |
| `lib/payments/providers/payfast/payfast-url-encoding.ts` | UTF-8 PHP `urlencode` implementation |
| `lib/payments/providers/payfast/payfast-fields.ts` | Closed ordered field schema/normalization |
| `lib/payments/providers/payfast/payfast-signature.ts` | Ordered passphrase/MD5 signing and immutable form map |
| `lib/payments/providers/payfast/payfast-callback-urls.ts` | Fixed public-reference callback builder |
| `lib/payments/providers/payfast/payfast-checkout-request.ts` | Server-authoritative provider field construction |
| `lib/payments/providers/payfast/payfast-adapter.ts` | Local sandbox FORM_POST adapter |
| `lib/services/payment-preparation.service.ts` | Authoritative payer-email preparation guard |
| `lib/services/payment-provider-session.service.ts` | Preflight/reserve/local-action/finalize audit lifecycle |
| `lib/services/payment-customer-query.service.ts` | Owned customer page/status/identity reads |
| `lib/services/payfast-checkout.service.ts` | Owned current-attempt form reconstruction |
| `lib/validation/payments.ts` | Operation/route parameter schemas |
| `lib/security/rate-limit.ts` | Preparation, checkout, and status limits |
| `app/api/orders/[orderId]/payment/route.ts` | Authenticated preparation endpoint |
| `app/api/payments/[publicReference]/checkout-session/route.ts` | Authenticated Payfast action endpoint |
| `app/api/payments/[publicReference]/route.ts` | Owned no-store local status endpoint |
| `app/api/payments/payfast/itn/route.ts` | Reserved non-processing ITN endpoint |
| `app/(payments)/layout.tsx` | CUSTOMER/STORE payment shell |
| `app/(payments)/orders/[orderReference]/payment/page.tsx` | Customer payment/readiness page |
| `app/(payments)/payments/payfast/checkout/[attemptReference]/page.tsx` | Owned no-store signed checkout page |
| `app/(payments)/payments/payfast/return/page.tsx` | Non-authoritative return page |
| `app/(payments)/payments/payfast/cancel/page.tsx` | Non-authoritative cancel page |
| `app/(account)/account/orders/[id]/page.tsx` | Customer navigation to payment page |
| `components/payments/PaymentCheckoutClient.tsx` | Preparation/session client coordinator |
| `components/payments/PayfastAutoSubmitForm.tsx` | Exact POST fields, one-shot submit, manual fallback |
| `components/payments/PaymentStatusPoller.tsx` | Bounded no-store local-status polling |
| `components/admin/PaymentTables.tsx` | Public reference/environment/action/capability/block audit display |
| `tests/payments/fake-payment-provider.ts` | Provider-neutral action/audit test fake |
| `tests/payments/provider-result-validation.test.ts` | Action-union validation cases |
| `tests/payments/provider-retry-policy.test.ts` | New capability fixture alignment |
| `tests/payments/order-boundary-source-audit.test.ts` | Expanded payment boundary audit |
| `tests/services/payment-provider-session.service.test.ts` | FORM_POST/session fixture alignment |
| `tests/services/payment-provider-registry.test.ts` | Registry readiness fixture alignment |
| `tests/services/payment-customer-query.service.test.ts` | Customer-owned read tests |
| `tests/services/payfast-checkout.service.test.ts` | Form reconstruction service tests |
| `tests/api/order-payment-prepare.test.ts` | Preparation route source contract |
| `tests/api/payfast-checkout-session.test.ts` | Checkout route source contract |
| `tests/api/payment-status.test.ts` | Status route source contract |
| `tests/api/payfast-itn-reserved.test.ts` | ITN reserved-route source contract |
| `tests/payments/payfast/payfast-test-fixtures.ts` | Deterministic pure Payfast fixtures |
| `tests/payments/payfast/payfast-provider-identity.test.ts` | Identity/domain policy |
| `tests/payments/payfast/payfast-config.test.ts` | Configuration/production lock policy |
| `tests/payments/payfast/payfast-url-encoding.test.ts` | Encoding vectors |
| `tests/payments/payfast/payfast-fields.test.ts` | Field order/normalization/limits |
| `tests/payments/payfast/payfast-signature.test.ts` | Independent signature vectors |
| `tests/payments/payfast/payfast-callback-urls.test.ts` | Callback safety |
| `tests/payments/payfast/payfast-checkout-request.test.ts` | Exact request map |
| `tests/payments/payfast/payfast-adapter.test.ts` | Adapter result/capabilities/no-network policy |
| `tests/payments/payfast/payfast-registry.test.ts` | Registry sandbox/production policy |
| `tests/payments/payfast/payfast-snapshot-safety.test.ts` | Persistence/snapshot safety |
| `tests/payments/payfast/payfast-source-audit.test.ts` | Provider/security/boundary source audit |
| `tests/payments/payfast/payfast-admin-ui-contract.test.ts` | Admin safe-readiness UI contract |
| `tests/payments/payfast/payfast-payment-page.test.ts` | Payment-page UI contract |
| `tests/payments/payfast/payfast-auto-submit-form.test.ts` | POST/fallback/accessibility UI contract |
| `tests/payments/payfast/payfast-return-page.test.ts` | Return non-authority contract |
| `tests/payments/payfast/payfast-cancel-page.test.ts` | Cancel non-authority contract |
| `tests/payments/payfast/payfast-client-operation.test.ts` | Operation ID behavior |
| `tests/integration/payment-fixtures.ts` | Existing integration fixture action/audit alignment |
| `tests/integration/payfast-fixtures.ts` | Disposable database Payfast fixtures |
| `tests/integration/payfast-payment-preparation.integration.test.ts` | Preparation scenarios |
| `tests/integration/payfast-checkout-session.integration.test.ts` | Checkout/form/replay scenarios |
| `tests/integration/payfast-concurrency.integration.test.ts` | Attempt race scenarios |
| `tests/integration/payfast-configuration.integration.test.ts` | Configuration/production scenarios |
| `tests/integration/payfast-boundaries.integration.test.ts` | Ownership/return/cancel/ITN/cross-module scenarios |
| `tests/integration/payfast-invariants.integration.test.ts` | Persistence/secret/action invariants |
| `vitest.payfast-integration.config.ts` | Serial integration-suite configuration |
| `tests/e2e/payfast-checkout.spec.ts` | Intercepted sandbox form and customer/admin flows |
| `scripts/phase11-payfast-preflight.mjs` | Static/schema/migration preflight scaffold |
| `scripts/verify-payfast-invariants.mjs` | Live disposable invariant verifier |
| `scripts/payfast-integration-test.mjs` | Guarded disposable integration runner |
| `docs/phase-11-implementation-map.md` | Mandatory pre-implementation contract/schema/API/security map |
| `docs/phase-11-payfast-integration-v1.md` | Main lifecycle/configuration/boundary guide |
| `docs/payments/payfast-custom-integration.md` | Provider protocol and extension boundary |
| `docs/payments/payfast-signature.md` | Exact signing/encoding protocol |
| `docs/payments/payfast-checkout-security.md` | Checkout threat controls |
| `docs/payments/provider-adapter-contract.md` | FORM_POST provider-neutral contract update |
| `docs/payments/payment-state-machine.md` | Non-definitive action and Phase 12 authority update |
| `docs/testing/payfast-integration.md` | Deferred validation execution guide |
| `docs/deferred-validation/phase-11-risk-register.md` | Explicit unproven risks |
| `docs/phase-11-implementation-report.md` | Required 35-section implementation report |

No unrelated baseline worktree changes are claimed as Phase 11 work.

## 28. Lightweight Checks Actually Run

| Command | Result |
|---|---|
| `.\node_modules\.bin\prisma.cmd format` | Passed; schema formatted in 92 ms. No generation or database access. |
| `.\node_modules\.bin\vitest.cmd run tests/payments/payfast/payfast-url-encoding.test.ts tests/payments/payfast/payfast-signature.test.ts tests/payments/payfast/payfast-adapter.test.ts` (first run) | 16 passed, 1 failed because the amount-sensitivity test used intentionally invalid `123.45x`; implementation validation rejected it. |
| Same focused Vitest command after test-vector correction | Passed: 3 files, 17 tests. Vite printed a pre-existing `vite-tsconfig-paths` deprecation warning. |
| Same focused Vitest command after adding the remaining explicit signature-policy cases | Passed: 3 files, 21 tests. The same pre-existing Vite warning was emitted. |
| File-scoped local ESLint command (first invocation) | Did not lint: one service path was mistyped; ESLint reported no matching file. |
| Corrected file-scoped local ESLint across 26 Phase 11 provider/service/API/page/component files | Passed with no findings. |
| File-scoped local ESLint across Phase 11 tests, integration/E2E scaffolds, config, and runner scripts (first run) | Found one malformed test expression and one `prefer-const` finding; no tests or runners executed. |
| Same test/scaffold file-scoped ESLint command after corrections | Passed with no findings. |
| Same test/scaffold file-scoped ESLint command after strengthening the deferred database scenarios/invariant queries | Passed with no findings; no test, database, or runner was executed. |
| Final file-scoped ESLint recheck of the strengthened signature/integration/E2E/invariant files | Passed with no findings. |
| File-scoped local ESLint recheck of the corrected preparation API route | Passed with no findings. |
| `git diff --check` | Passed with no whitespace errors in tracked diffs. |

No check in this table is represented as deep validation.

## 29. Validation Deferred

No package installation, Docker operation, migration deployment, seed, Prisma generation, full test suite, coverage run, production build, real sandbox payment, browser E2E, CI execution, or formal/security audit was performed. PostgreSQL integration and invariant scripts were written but not run.

## 30. Deferred Validation Risk Register

- Signature risk: fixed vectors pass, but official sandbox acceptance is unproven.
- Encoding risk: byte vectors pass, but provider Unicode/special-character acceptance is unproven.
- Migration risk: SQL/schema were formatted/reviewed but never deployed or drift-checked.
- Build risk: Next.js/TypeScript/Prisma generated-client integration was not compiled.
- Sandbox risk: no dedicated account, HTTPS callback, provider POST, or ITN was exercised.
- Browser risk: hydration, one-shot/manual submission, headers, and polling are unexecuted.
- Secret risk: design/source tests exist, but bundle/log/trace/database auditing is deferred.
- Concurrency risk: Serializable/unique winner behavior needs live PostgreSQL races.
- Cross-module risk: source boundaries/scenarios exist; live ledger/wallet/order invariants are deferred.
- Phase 12 dependency: verified authoritative ITN/reconciliation is absent and blocks production/success.

The detailed register is `docs/deferred-validation/phase-11-risk-register.md`.

## 31. New Dependencies

None. Only package scripts were added; no dependency or version was introduced and no package was downloaded.

## 32. Bugs Found and Fixed

| Bug | Root cause | Fix | Code/test evidence |
|---|---|---|---|
| Signature sensitivity test rejected its input before hashing | The parameterized amount mutation appended `x`, violating the canonical two-decimal policy | Changed the amount case to valid `123.46` and gave every case a protocol-valid changed value | `payfast-signature.test.ts`; focused rerun 17/17 |
| Preparation API customer DTO was incomplete | Route projection omitted `provider` and `updatedAt` while the client treated it as `CustomerPaymentStatusDto` | Added both server-authoritative fields to the response | order payment API route and `payment.dto.ts` |
| Checkout-request test scaffold did not parse | Two compact nested expectation expressions omitted their final `it(...)` closing parenthesis | Expanded the expectations into structurally clear blocks | `payfast-checkout-request.test.ts`; test/scaffold ESLint pass |
| E2E fixture used a mutable declaration for an immutable identity | `customerEmail` was declared with `let` although never reassigned | Changed it to `const` | `payfast-checkout.spec.ts`; test/scaffold ESLint pass |
| Deferred invariant coverage omitted one snapshot and used only source assertions for ledger/order boundaries | `resultSnapshot` and database correlation/history checks were missing from the first scaffold | Added all-snapshot secret scans, authoritative quote comparison, ledger-reference correlation, and post-preparation order-history queries; strengthened encoded integration snapshots | preflight/invariant scripts and `payfast-*.integration.test.ts`; file-scoped ESLint pass only |
| Provider error code union initially had invalid separator syntax | Payfast error members were appended mechanically | Corrected the union separators before the static pass | `lib/payments/errors.ts`; file-scoped ESLint pass |

## 33. Architect Review Items

- Approve the Phase 12 authoritative ITN/reconciliation design before any production activation, success transition, order effect, or ledger posting.
- Confirm whether the non-secret environment/version configuration fingerprint is sufficient for credential-rotation audit, or whether deployment should supply a separate non-secret credential-version identifier.
- Confirm the production `PAYMENT_APP_ORIGIN`/reverse-proxy ownership and public HTTPS callback deployment model before sandbox or Phase 12 validation.

## 34. Progression Readiness

READY FOR ARCHITECT IMPLEMENTATION REVIEW

## 35. Final Confirmation

- Implementation-only workflow followed.
- No packages downloaded.
- No Docker operated.
- No migration executed.
- No seed executed.
- No full tests run.
- No production build run.
- No real Payfast request made.
- No browser executed.
- No prior migration modified.
- No shared/production database modified.
- No canonical/retained volume deleted.
- South African Payfast only.
- No Pakistani PayFast integration.
- No production Payfast activation.
- No ITN processed.
- No payment marked successful.
- No ledger journal posted.
- No wallet balance changed.
- No order status changed.
- No client amount/provider authority.
- No passphrase exposed.
- No real credentials stored.
- No secrets exposed.

IMPLEMENTATION COMPLETE — DEEP VALIDATION DEFERRED

READY FOR ARCHITECT IMPLEMENTATION REVIEW
