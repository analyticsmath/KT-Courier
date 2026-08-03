# Phase 11 Payfast implementation map

This mandatory pre-implementation map records the Phase 10 contract audit and the exact Phase 11 impact before the Payfast adapter is implemented. The accepted migration chain ends at `20260717020000_phase10_payment_provider_foundation`; every earlier migration remains immutable.

## Phase 10 result-shape audit

Phase 10 models a customer handoff as the optional `redirectUrl` member of `ProviderCheckoutSessionResult`. `provider-result-validation.ts` requires that URL whenever the normalized status is `REQUIRES_ACTION`, validates it as an allowlisted HTTPS GET destination, and `payment-provider-session.service.ts` persists it on `PaymentAttempt.redirectUrl`. The adapter capability model correspondingly exposes only `supportsRedirectCheckout`.

That result is insufficient for South African Payfast custom integration. Payfast requires a browser `POST` whose hidden fields are the exact normalized values covered by the provider signature. Encoding those values into a query string or treating the processing URL as a redirect would change the HTTP semantics and create a signed-versus-posted mismatch risk.

Phase 11 therefore changes the provider result to carry a normalized discriminated action:

```ts
type ProviderCustomerAction =
  | { type: "REDIRECT_GET"; url: string; expiresAt: string | null }
  | { type: "FORM_POST"; url: string; fields: Readonly<Record<string, string>>; expiresAt: string | null }
```

`ProviderCheckoutSessionResult.customerAction` replaces direct `redirectUrl` transport at the adapter boundary. The existing nullable database `redirectUrl` remains for future GET providers and compatibility; Payfast stores `checkoutActionType=FORM_POST` and leaves `redirectUrl` null. Signed fields, signatures, Merchant Key, passphrase, callback URLs, and rendered HTML are never persisted. The internal authenticated checkout page reconstructs the deterministic signed action from the attempt/payment/payer records and current validated server configuration.

## Existing Phase 10 contract audit

| Area | Existing Phase 10 behavior | Phase 11 decision |
|---|---|---|
| Provider adapter | Normalized status plus optional redirect URL/reference/metadata | Add `ProviderCustomerAction`; Payfast returns `FORM_POST`, `REQUIRES_ACTION`, no provider reference, and a non-definitive outcome |
| Capabilities | Redirect, lookup, idempotent creation, cancellation, authorization/capture | Add form POST and authoritative webhook confirmation booleans; Payfast declares only form POST in Phase 11 |
| Registry | Knows PAYFAST but constructs no production adapter | Resolve server-only Payfast config once; construct only a valid sandbox adapter; report production configured but code-locked inactive |
| Configuration | Generic inactive state plus `PAYMENT_APP_ORIGIN` callback policy | Add pinned mode/credentials/origin resolver; no arbitrary endpoint or public security flag |
| Session input | Merchant/payment refs, exact amount, hashed payer reference, return/cancel URLs, description | Add authoritative payer name/email, order reference, and notify URL; no client amount/provider/payer fields |
| Orchestration | Reserve, call outside transaction, finalize; configuration failure currently becomes a failed attempt | Resolve active adapter before reservation so disabled/invalid/production-locked configuration creates no attempt; preserve call-outside-transaction and finalization stages |
| Result validation | Requires/validates an allowlisted redirect for action status | Validate the discriminated action, exact adapter capability, action URL, frozen string field map, and safe metadata |
| Persistence | Attempt keeps redirect/provider status/safe snapshots | Add public attempt reference, provider environment, action type, prepared time, protocol version, and safe configuration version; no signed material |
| DTOs | Admin attempt DTO exposes internal attempt ID and redirect | Add aligned audit fields; introduce separate customer-safe DTOs without internal IDs, hashes, snapshots, errors, or credentials |
| APIs/UI | Read-only admin only | Add authenticated same-origin preparation/session APIs, owned status API, server-rendered internal checkout, payment/return/cancel pages, and reserved non-success ITN route |

## Contract-impact matrix

| Layer | Required consideration | Planned implementation |
|---|---|---|
| Provider contract | Form POST action support | Discriminated `REDIRECT_GET` / `FORM_POST` union; no query-string emulation |
| Registry | Payfast adapter construction | Central production factory constructs a validated sandbox adapter only; test adapters remain direct injections |
| Configuration | Sandbox/production separation | `PAYFAST_MODE` supports disabled/sandbox/production; processing endpoints are internal constants; production is code-locked until Phase 12 |
| Signature | Field order and encoding | Explicit Payfast v1 field order, PHP-`urlencode` compatible UTF-8 encoder, protocol-required MD5 with encoded passphrase |
| Adapter | Canonical Payfast request | One immutable signed field map returned directly as the form fields; local deterministic construction and no network request |
| Service | Session orchestration | Readiness before reservation; reservation/call/finalization transaction boundaries preserved; checkout reconstruction service verifies ownership/current attempt |
| DTO | Checkout action representation | Provider action union internally; safe preparation/session/status DTOs expose only public references and internal checkout URL |
| API | Authenticated initiation | Strict JSON, UUID operation ID, same-origin, active CUSTOMER/STORE roles, ownership, rate limits, no amount/currency/provider input |
| UI | Form POST and return pages | Server-rendered checkout with narrow one-shot auto-submit client component and manual fallback; non-authoritative return/cancel status surfaces |
| Prisma | Environment/action audit fields | Nullable historical-compatible attempt public reference/environment/action/prepared/protocol/configuration fields; no secret columns |
| Migration | Additive schema changes | `20260717030000_phase11_payfast_integration_v1`; enums, nullable columns, unique attempt public reference, safe constraints; never executed here |
| Tests | Fixed vectors and boundary tests | Pure encoder/signature/config/request/adapter tests plus service/API/frontend/source-audit code; hardcoded independent signature vector |
| E2E | Form interception and return behavior | Deferred Playwright code inspects/intercepts POST without reaching Payfast and proves return/cancel non-authority |
| Documentation | Security and Phase 12 boundary | Provider identity, signature, checkout security, testing, sandbox setup, production lock, ITN deferral, and deferred-risk register |

## Schema, DTO, and UI propagation

The new `PaymentAttempt` audit concepts propagate as follows:

| Concept | Prisma/migration | Domain and service | Validator/DTO/API | UI, fixture, mock, script, docs |
|---|---|---|---|---|
| `publicReference` | Nullable unique URL-safe text for historical rows | Generated at attempt reservation and immutable | Customer APIs use it instead of the internal attempt ID | Checkout URL/page, admin table, test fixtures, transaction mocks, invariant scripts |
| `providerEnvironment` | `PaymentProviderEnvironment?` (`SANDBOX`, `PRODUCTION`) | Set from adapter/config metadata | Safe readiness/attempt audit only | Sandbox badge/admin state/invariants/docs |
| `checkoutActionType` | `PaymentCustomerActionType?` (`FORM_POST`, `REDIRECT_GET`) | Set during normalized finalization | Internal action union and safe attempt audit | Checkout guard/admin table/form-action invariant |
| `checkoutPreparedAt` | Nullable timestamp | Set when action becomes `REQUIRES_ACTION` | ISO string where an attempt audit DTO is authorized | Admin audit and invariant checks |
| `providerProtocolVersion` | Nullable bounded text | Payfast safe metadata version | No secret content | Admin audit, snapshot/version tests, docs |
| `configurationFingerprint` | Nullable bounded static configuration identity | Stores only a non-secret version/environment identifier, never a secret hash | No customer exposure | Admin audit, persistence source audit, docs |

`types/db.ts` re-exports the two new generated enums. `types/domain.ts` gains application-facing provider environment/action types. Prisma generation is deferred, so production code avoids relying on newly generated enum constants during this implementation-only pass.

## Server-authority and transaction map

| Stage | Reads/validation | Writes | Provider work | Boundary |
|---|---|---|---|---|
| Preparation API | Authenticated active payer, owned payable order, valid server email, quote evidence and exact ZAR total | One payment/history or idempotent replay | None | Client sends only UUID operation ID |
| Session preflight | Owned payment by public reference; Payfast sandbox readiness | None | Registry/config resolution only | Failure creates no attempt |
| Reservation | Serializable payment lock, payable/retry state, no unresolved attempt | Counter, public attempt ref, `RESERVED`, `PROVIDER_PENDING`, history | None | No signature/config secret used in transaction |
| Form construction | Normalized input including server user name/email and server callbacks | None | Local field normalization/signature only; no HTTP | Runs after reservation commit |
| Finalization | Locks payment then attempt and validates reservation/current version | `REQUIRES_ACTION`, audit fields, safe snapshots/history | None | Full fields/signature are discarded before persistence |
| Checkout page | Authenticated ownership, current actionable attempt, validated current sandbox config | None | Reconstruct same deterministic form | Server renders; no cache/storage/query field transport |
| Return/cancel | Authenticated owned payment public reference | None | None | GET is presentation only; no success/cancel inference |
| ITN reservation | Method/content-length checks only | None | None | Controlled non-success until Phase 12 |

## Route and UI map

Next.js 16 dynamic `params` and `searchParams` are promises and will be awaited. Route Handlers are public endpoints, so every customer data route performs explicit authentication/authorization. Personalized pages are Server Components; only operation submission, bounded polling, and one-shot form submission are client islands. Payment paths receive explicit `Cache-Control: no-store` headers through Next configuration and API responses.

| Route | Method and authority | Safe contract |
|---|---|---|
| `/api/orders/[orderId]/payment` | POST, active CUSTOMER/STORE owner, same origin, rate limited | Body `{operationId}` only; returns public payment summary |
| `/api/payments/[publicReference]/checkout-session` | POST, owned payable payment, same origin, rate limited | Body `{operationId}` only; server selects PAYFAST; returns internal checkout URL only |
| `/api/payments/[publicReference]` | GET, owned payment, rate limited | Current safe local status; no internal IDs/provider secrets/snapshots |
| `/api/payments/payfast/itn` | POST, bounded request | Phase 11 controlled non-success, no body processing or mutation |
| `/orders/[orderReference]/payment` | GET page, authenticated owner | Exact server amount/status/readiness and client operation controls; no amount/provider input |
| `/payments/payfast/checkout/[attemptReference]` | GET page, authenticated owner | Reconstructed immutable form POST action and manual fallback |
| `/payments/payfast/return?payment=<publicReference>` | GET page, authenticated owner | Current local status and bounded polling; no mutation/success inference |
| `/payments/payfast/cancel?payment=<publicReference>` | GET page, authenticated owner | Current local status and navigation; no cancellation inference |

## Security and Phase 12 boundary

- Runtime provider identity is South African Payfast by Network. Only `sandbox.payfast.co.za` and `www.payfast.co.za` are form action hosts; prohibited Pakistani provider names/domains are source-audited.
- `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_MODE`, and `PAYMENT_APP_ORIGIN` are server-only. No `NEXT_PUBLIC_*` value affects the integration.
- The Merchant ID, Merchant Key, and signature appear only as provider-required hidden fields on the no-store checkout response. The passphrase never enters fields, DTOs, logs, snapshots, persistence, or browser storage.
- Production remains inactive through a code-level `AUTHORITATIVE_CONFIRMATION_NOT_IMPLEMENTED` lock. No environment bypass exists.
- Return/cancel navigation never writes payment, attempt, order, wallet, ledger, pricing, dispatch, or driver state.
- The ITN route is reserved and rejects without processing. Signature/source/amount verification, duplicate/replay protection, confirmation calls, reconciliation, authoritative success, order effects, and ledger posting belong to Phase 12 or later authorized work.

## Migration-state declaration

Phase 11 requires durable attempt audit and a safe public checkout identity, so an additive migration is necessary. It will be created at `prisma/migrations/20260717030000_phase11_payfast_integration_v1/migration.sql`, after Phase 10, with only new enums, nullable columns, a partial-compatible unique index, and bounded/consistency constraints. It will not store credentials or signed fields, edit a prior migration, backfill fabricated evidence, or be executed during this phase.
