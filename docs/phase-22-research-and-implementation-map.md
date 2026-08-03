# Phase 22 research and implementation map

## Scope and architectural decision

Phase 22 replaces the unused legacy store-plan placeholder with a separate,
versioned membership domain.  A public plan is an offer; a subscription
contract is the immutable agreement accepted by one authenticated customer or
one store through its authorised billing actor.  A billing cycle and its
invoice are evidence for a contractual period, while the existing Phase 10–12
`Payment` aggregate remains the sole payment and provider-confirmation
authority.  This phase does not create recurring marketplace baskets, product
orders, stock reservations, cash credits, commissions, or a second refund
system.

## Correction completion audit

The statuses distinguish code that exists from a launch claim. “Production-
locked” means the canonical code path is present but cannot mutate production
until the Phase 26.5 gate is approved. “Deferred validation” is not a claim
that an external protocol or deployed database has been proven.

| Capability | Status | Correction evidence / boundary |
| --- | --- | --- |
| PayFast recurring authorization | concretely implemented; production-locked | Recurring REST adapter creates an invoice-bound authorization action; browser return is non-authoritative. |
| Provider-managed subscriptions | concretely implemented; production-locked | `PROVIDER_MANAGED_SUBSCRIPTION` is the initial target for monthly rolling contracts, prepared invoices and authoritative ITN application. |
| Platform-scheduled token charges | production-locked | Modelled, but `chargeTokenizedCycle` fails closed; no token charge is attempted. |
| Recurring API authentication | concretely implemented | Recurring REST uses the Phase 15 MD5 primitive with explicit sandbox exclusion, timestamp binding and PHP-compatible encoding. |
| Subscription-token encryption | concretely implemented; production-locked | AES-GCM opaque envelopes and SHA-256 fingerprints require the server key vault; absent key returns `PROVIDER_TOKEN_STORAGE_UNAVAILABLE`. |
| Initial ITN activation | concretely implemented; production-locked | Phase 12 post-success invokes settlement before contract activation/grants. |
| Renewal ITN application | test-only; production-locked | Exact invoice/token/payer/amount/environment resolver and lifecycle policy exist; deployment wiring is deferred. |
| Billing-cycle settlement | concretely implemented; production-locked | Serializable locks, held-to-deferred journal, unique settlement evidence and reconciliation fallback. |
| Subscription revenue accounting | concretely implemented; production-locked | Deferred/revenue accounts, schedule/entry evidence and cumulative daily recognition are implemented. |
| Entitlement creation | concretely implemented; production-locked | Grants occur only in the settled activation transaction and are unique by paid cycle/benefit. |
| Delivery-benefit reservation | concretely implemented; production-locked | Phase 6 base quote is wrapped by the paid-grant reservation adapter before Phase 20 review freeze. |
| Delivery-benefit consumption and release | concretely implemented; production-locked | Canonical reserve/consume/release/reverse usage service exists; end-to-end order/failure proof is deferred. |
| Commission-plan eligibility | concretely implemented; production-locked | Phase 20 freezes only an eligible approved Phase 14 plan/version. |
| Cancellation | interface-only; production-locked | End-of-period request evidence is concrete; provider apply/sync needs validated provider semantics. |
| Refund and entitlement reversal | interface-only; production-locked | Phase 15 request composition exists; accounting/revocation orchestration awaits deployment proof. |
| Provider synchronization | interface-only; production-locked | Concrete fetch/cancel methods exist; durable synchronization awaits exact provider status semantics. |
| Customer/store API completeness | concretely implemented; production-locked mutations | Owner-scoped reads are present; source-locked launch mutations state their status. |
| Administrative recovery | interface-only; production-locked | Read/reconciliation authority exists; canonical recovery mutations await the same validation gate. |
| Operational processors | production-locked | Dry-run/limit parsing exists; apply is intentionally unavailable until runtime composition is validated. |
| Service/API test completeness | deferred validation | Focused DB-free protocol, settlement, entitlement, renewal and source tests are executable; DB/provider/browser/concurrency work is Phase 26.5. |

## Legacy migration compatibility audit

`20260717140000_phase22_subscriptions` is an **unapplied non-destructive
compatibility migration**. It performs the retained-object renames below
before creating the Phase 22 domain.

| Previous object | Legacy name | Rows / foreign keys / indexes | Prisma mapping and runtime readers/writers | Fail-closed condition |
| --- | --- | --- | --- | --- |
| `SubscriptionPlan` | `LegacySubscriptionPlan` | Existing rows, constraints and indexes survive PostgreSQL rename semantics. | Explicit legacy Prisma model; active runtime uses `SubscriptionPlanVersion`. | Deployment must prove rename before Phase 22 reads. |
| `StoreSubscription` | `LegacyStoreSubscription` | Existing rows, plan/store foreign keys and indexes are preserved. | Explicit legacy model; no Phase 22 runtime reader/writer uses it. | Missing renamed table aborts migration. |
| `SubscriptionInvoice` | `LegacySubscriptionInvoice` | Existing rows, subscription/payment foreign keys and indexes are preserved. | Explicit legacy model; Phase 22 uses the new immutable invoice. | Missing rename or incompatible payment FK aborts migration. |
| `SubscriptionInvoiceStatus` | `LegacySubscriptionInvoiceStatus` | Existing enum values stay attached to the legacy table. | New enum belongs only to the new Phase 22 model. | Collision resolves only through the explicit enum rename. |

Source audit: active application and subscription runtime code refers to the
new Phase 22 plan/invoice models. Historical migration fixtures and database
foundation tests retain obsolete names only as history. The Docker smoke query
uses `LegacySubscriptionPlan`; no active runtime writer targets an obsolete
legacy mapping.

## Repository audit

| Surface | Existing authority | Transaction / idempotency boundary | Ownership, privacy and production state | Phase 22 reuse decision |
| --- | --- | --- | --- | --- |
| Phase 10 payment | `Payment`, `PaymentAttempt`, payment status history and `payment-preparation.service` | Serializable transaction keyed by creation idempotency key and request hash | Payer is `Payment.userId`; provider data stays on attempts; production provider work is source-locked by later phases | Extend the disjoint subject discriminator with `SUBSCRIPTION_INVOICE`; do not create a payment replacement. |
| Payment subjects | `payment-subject-policy.ts` guards courier and marketplace subjects | Used by preparation, Phase 12 and finalisation | Marketplace permits its existing guest model only; subscriptions require a user payer | Add exact subscription-invoice payer/invoice checks while retaining courier and marketplace invariants. |
| Phase 11 / 15 PayFast | PayFast checkout adapter plus Phase 15 REST API-signature primitive | Payment evidence is committed before provider work; browser action is not authoritative | Credentials are configuration-owned; safe snapshots redact secrets; production remains locked | Recurring REST uses the Phase 15 API signer, not Phase 11 custom-checkout signing. No card collection or new secret loader. |
| Phase 12 ITN | `payfast-itn-application.service` and `PaymentWebhookEvent` | Verified receipt is applied serializably and replays converge; post-commit success hook isolates downstream failures | Verified provider evidence is authoritative; unknown outcomes open payment reconciliation | Add a subscription post-success hook. Browser return never activates a contract. |
| Phase 15 refunds | `PaymentRefund`, refund services, provider adapters and refund reconciliation | Request/execute/reconcile aggregate with exact cumulative funding checks | Original payment remains the default; provider outcomes are privacy-minimised and source-locked | Link subscription refund evidence to this aggregate; never add a second refund, wallet balance, or ledger writer. |
| Phase 6 delivery pricing | `pricing-quote.service`, `lib/pricing/*` and frozen quote evidence | Pricing service is the exact monetary authority | Customer/order data is scoped to the quote; no client discount is trusted | Provide a subscription entitlement adapter that returns a bounded adjustment; Phase 6 remains the fee calculator. |
| Phase 14 commissions | `CommissionPlan`, its version/status lifecycle and Phase 14 calculation services | Frozen Phase 20 evidence drives later accounting; direct charge mutation is forbidden | Store-scoped plan resolution is admin-approved and production-locked | Return only approved-plan eligibility. Phase 22 never writes a rate, accrual, earning or ledger journal. |
| Phase 20 checkout | Review, acknowledgement, commercial fingerprint, payment preparation and finalisation repositories | Review/acknowledgement versions and operation receipts provide durable replay | Customer and guest ownership have separate policies; existing checkout payments stay unchanged | Freeze a reservation/benefit reference in checkout evidence through a narrow adapter; do not alter marketplace payment authority. |
| Phase 21 identities | `Store.ownerUserId`, store profile and `hasPermission` with explicit user `DENY` overrides | Permission checks are request-time; canonical stores are locked by their service transaction | Store contracts have a store subject and a separate authorised billing payer | Require current owner or exact store subscription billing permission, and preserve explicit deny precedence. |
| Wallets / quotas | Customer and store wallets are Phase 9 financial aggregates; catalog inventory and staff access have their own authorities | Financial mutations use ledger-backed writers | Wallet and inventory data are financial/operationally sensitive | Benefits are non-cash entitlement records only. Store quota benefits are eligibility evidence, not direct resource mutation. |
| Notifications / event intents | Existing service notification primitives and Phase 20/21 durable event-intent pattern | Intent creation occurs with the canonical operation | Transactional notices are independent of marketing consent | Add subscription event intents only; Phase 27 owns delivery. |
| Operations / outbox | Marketplace checkout and store-order operation tables use operation IDs plus request hashes | Operation key is stable and changed requests fail | References and hashes must contain no personal data | Use subscription operation receipts, renewal jobs and append-only history. |
| Admin permissions | `PERMISSIONS`, `hasPermission`, `SYSTEM_PERMISSION_DEFINITIONS`, seeded admin grants | Explicit `DENY` overrides role grants | Admin-only financial visibility already uses narrow permissions | Add subscription read/manage/reconcile/lifecycle permissions; intentionally omit manual mark-paid/grant/token-write rights. |
| Legal / identity evidence | Phase 20 freezes seller identity, terms, privacy and refund references; store seller legal identities are versioned | Evidence is frozen in the review path | Legal and privacy versions are public-reference evidence, not mutable account fields | Freeze policy and legal versions inside contract/review/invoice snapshots; do not claim legal approval. |
| Provider-token handling | Payment attempts retain only safe provider snapshots; PayFast credentials are configuration authority | Token-bearing data is never returned in public DTOs | Raw secrets/card data are prohibited | Store only encrypted opaque recurring-token references where required, and never expose or log them. |
| Same-origin / rate policy | Existing API routes use authenticated route guards, same-origin checks and strict Zod payloads | Mutation operations carry replay keys | Avoid IDOR through exact user/store checks | Reuse the same route policy shape for subscription APIs. |
| Reconciliation cases | Payment, refund, checkout, commission and store-order cases are canonical drift records | Cases are opened idempotently and resolved through authoritative workflows | Internal safe evidence is not public | Add a subscription reconciliation case that links to payment/contract/cycle/grant instead of allowing manual convergence. |
| Invoice / VAT evidence | Payment and refund evidence exist; no universal VAT invoice authorisation exists | Amounts use exact `Decimal` amounts | Invoice data needs payer minimisation | Create immutable subscription invoice evidence, deliberately not labelled as a VAT invoice. |

## Implementation map

1. Replace the Phase 4 placeholder plan/subscription/invoice tables with the
   additive Phase 22 program, version, contract, cycle, invoice, authority,
   entitlement, operation, reconciliation and policy records.  The migration
   carries no active commercial data and preserves prior migrations.
2. Add pure policy modules for plan lifecycle, subject/payer checks, contract
   state transitions, exact money, production lock, benefit bounds, dunning,
   cancellation and entitlement usage.
3. Add repositories and services for review/acknowledgement, initial payment,
   verified activation, renewal/dunning/cancellation/change/reconciliation and
   provider synchronization.  All provider calls occur after the local
   transaction commits.
4. Extend Phase 10 payment subjects and Phase 12 post-success composition;
   reuse Phase 11 PayFast primitives and Phase 15 refund composition.
5. Expose customer, store and admin APIs using the current auth/permission
   conventions, then supply server-rendered membership/admin views with small
   client-only interaction boundaries where required by Next.js 16.
6. Add dry-run operational scripts, focused policy/service/API tests, skipped
   integration/E2E scaffolds, documentation, and the Phase 26.5 risk register.

## Production source locks

The Phase 22 composition root must resolve the concrete local repositories and
PayFast recurring adapter before checking its fail-closed production gate.
Until consolidated validation approves it, plan activation, provider
authorisation, recurring charge, entitlement consumption, pause/resume and
provider cancellation remain blocked with
`CONSOLIDATED_VALIDATION_NOT_APPROVED`.  Source-level and injected-repository
tests remain permitted.

## Research conversion

The implementation uses the consumer-subscription pattern reflected in the
brief: clearly disclosed recurring terms, immutable acceptance evidence,
period-specific paid entitlements, non-overlapping contracts, bounded retries,
end-of-paid-period rolling cancellation, provider ambiguity routed to
reconciliation, and policy-versioned fixed-term controls.  It intentionally
separates the agreement, invoice, payment and benefit authorities so later
offer changes cannot rewrite an already accepted or paid membership period.
