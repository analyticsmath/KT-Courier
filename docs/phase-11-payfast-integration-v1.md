# Phase 11 Payfast integration v1

## Scope

Phase 11 implements the South African **Payfast by Network** aggregation custom integration as a server-generated HTML form POST. It does not implement the similarly named Pakistani provider. Runtime checkout actions are pinned to `https://sandbox.payfast.co.za/eng/process` and `https://www.payfast.co.za/eng/process`; only the sandbox action can be active in this phase.

The implementation extends the provider-neutral Phase 10 contract with `FORM_POST`, creates a stable Payfast merchant payment ID from the Phase 10 merchant reference, signs one immutable canonical field map, exposes an authenticated internal checkout transition, and renders that exact map as hidden inputs. It adds no provider network call: the browser performs the later form POST.

## Configuration and readiness

The server-only variables are `PAYFAST_MODE`, `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, and `PAYMENT_APP_ORIGIN`. Allowed modes are `disabled`, `sandbox`, and `production`. Endpoints cannot be overridden by environment variables. A valid sandbox requires non-empty bounded credentials, the KT-required passphrase, and a credential-free root HTTPS application origin.

Production credentials may be structurally valid, but readiness remains `configured: true`, `active: false`, with `AUTHORITATIVE_CONFIRMATION_NOT_IMPLEMENTED`. `PAYFAST_PRODUCTION_NOT_READY` is enforced in code; no environment bypass exists. Phase 12 must change code after authoritative confirmation support exists.

Create a dedicated Payfast sandbox account. Do not use published shared sandbox values or commit real credentials. Ordinary localhost cannot receive an external ITN. Later manual validation needs a public HTTPS testing origin or approved secure tunnel.

## Checkout lifecycle

1. An active authenticated CUSTOMER or STORE owner opens `/orders/[orderReference]/payment`.
2. `POST /api/orders/[orderId]/payment` accepts only a UUID `operationId`; the server resolves payer, order, quote, exact ZAR amount, and currency.
3. `POST /api/payments/[publicReference]/checkout-session` accepts only a second UUID `operationId`; the server selects PAYFAST.
4. Registry readiness is checked before reservation, so invalid/disabled/production-locked configuration creates no attempt.
5. The existing Serializable reservation allocates one attempt number, public attempt reference, stable merchant reference, sandbox audit, and moves the aggregate to `PROVIDER_PENDING`.
6. Outside any transaction, the adapter constructs the canonical signed fields and returns `REQUIRES_ACTION` with a `FORM_POST` action.
7. Finalization stores only status and non-secret audit/snapshot evidence, sets attempt/payment `REQUIRES_ACTION`, and discards the fields and signature.
8. The API returns only `/payments/payfast/checkout/[attemptReference]`.
9. The authenticated no-store server page verifies ownership/current state, reconstructs the deterministic signed action, and passes it to the narrow auto-submit form. A visible manual submit remains available.

Same-key preparation and checkout requests replay their original records. Signed fields never enter ordinary JSON client state, URLs, localStorage, sessionStorage, logs, analytics, or database snapshots.

## Server authority

The amount is copied from the accepted immutable quote as an exact decimal string and rendered with two places. There is no client amount, currency, provider, payer, item, or callback authority. Payer name/email come from the authenticated database user. Item name is `KT Courier Order <public-order-reference>` and the description is `Courier service payment`; addresses, phones, parcel contents, and database IDs are excluded.

The existing merchant reference `kt:payment:<payment-public-reference>:attempt:<number>` becomes `m_payment_id`. It is stable for the attempt, unique, contains no PII/spaces/internal ID, and is constrained to the Payfast 100-character limit.

## Persistence

Migration `20260717030000_phase11_payfast_integration_v1` adds nullable historical-compatible `PaymentAttempt.publicReference`, `providerEnvironment`, `checkoutActionType`, `checkoutPreparedAt`, `providerProtocolVersion`, and `configurationFingerprint`, plus the environment/action enums, unique index, consistency/length checks, and identity-trigger extension. The configuration fingerprint is a static non-secret version/environment identity, never a credential digest.

The migration stores no Merchant ID, Merchant Key, passphrase, signature, signature base, callback URL set, form field map, or HTML. It is prepared but not executed in the implementation-only workflow.

## Browser return, cancellation, and ITN boundary

`/payments/payfast/return` authenticates and resolves the owned payment public reference, displays current local state, and polls the owned status API at a bounded interval. A browser return does not mark success, change the order, or post accounting evidence.

`/payments/payfast/cancel` displays that checkout was not completed in that browser. It does not cancel the attempt/payment/order, delete data, start another attempt, or refund.

`POST /api/payments/payfast/itn` is reserved, requires form content type and a bounded declared size, deliberately does not read the body, performs no mutation, and returns controlled HTTP 501. ITN signature/source/amount verification, duplicates, replay, provider confirmation, reconciliation, success, ledger, and order effects belong to Phase 12 or later authorization.

## Financial and operational boundaries

Phase 11 imports/invokes no ledger posting, transfer, reversal, wallet transaction, refund, order-status writer, pricing writer, dispatch, assignment, or driver mutation. Form preparation and browser navigation can only reach `REQUIRES_ACTION`. No payment is marked successful and no production checkout is activated.

## Validation status

Implementation-only status applies. Pure encoder/signature/adapter tests and file-scoped static checks may be run, but migration application, Prisma generation, PostgreSQL integration, Docker, build, complete tests, browser E2E, real sandbox checkout, real ITN, security validation, CI, and audit remain deferred to the consolidated validation gate.
