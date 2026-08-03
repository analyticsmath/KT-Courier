# Phase 20 research and implementation map

## Audit date and scope

This map was prepared before the Phase 20 Prisma edit and updated for the Phase 20
completion continuation. It records the repository interfaces that Phase 20
extends, the boundaries it preserves, and the runtime completion status. No item
labelled complete is a claim of production validation; PostgreSQL concurrency,
provider, browser, migration-deployment and full-suite proof remain Phase 26.5
work.

## Completion audit

| Capability | Status at continuation start | Completion target in this correction |
| --- | --- | --- |
| Cart mutation service | Partially complete | Complete source-level canonical mutation service and route contracts. |
| Guest cart security | Partially complete | Complete cookie/token ownership, rotation/clearing and isolation contracts. |
| Cart claim and merge | Missing | Complete transaction-shaped service and API contracts. |
| Checkout creation | Partially complete | Complete revalidation-backed creation path. |
| Contact and address | Partially complete | Complete immutable-review invalidation and route contracts. |
| Delivery quotes | Missing | Complete narrow Phase 6 adapter and fail-closed evidence path. |
| Review and acknowledgement | Missing | Complete review/fingerprint/acknowledgement service and endpoints. |
| Inventory reservation | Missing | Complete serializable transaction-shaped reserve/release/hold/consume services. |
| Reservation expiry | Missing | Complete canonical expiry path preserving uncertain payment holds. |
| Payment preparation | Partially complete | Complete existing Payment/PayFast adapter boundary under source lock. |
| PayFast return/cancel | Missing | Complete explicitly non-authoritative pages and status contract. |
| Authoritative finalisation | Missing | Complete Phase 12-only idempotent finalisation entry point. |
| Order creation | Schema complete; runtime missing | Complete parent/store order and immutable evidence creation. |
| Settlement | Schema complete; runtime missing | Complete frozen snapshot and Phase 14/16 adapter boundary. |
| Reconciliation | Partially complete | Complete canonical case/retry/scanner operations. |
| Confirmation access | Missing | Complete owner/guest-secret confirmation query contract. |
| Customer APIs | Partially complete | Complete all listed route contracts. |
| Admin APIs | Partially complete | Complete protected read and canonical-retry route contracts. |
| Service tests | Missing | Complete DB-free mocked service suites. |
| API tests | Missing | Complete executable route-contract suites. |
| PostgreSQL/E2E proof | Deferred to Phase 26.5 | Deferred to Phase 26.5; scaffolds only. |

## Final correction capability status

| Capability | Final status | Evidence |
| --- | --- | --- |
| Cart mutations | complete | Canonical mutation service, Prisma adapter and add/update/remove/clear routes. |
| Guest cart security | complete | Hashed opaque cookie secret, ownership checks and clear-on-claim route behavior. |
| Cart claim and merge | complete | Transaction-shaped claim/merge service with fingerprint merge and explicit conflicts. |
| Checkout creation | partially complete | Existing canonical creation path is retained; review persistence adapter remains source-locked. |
| Contact | complete | Strict contact capture and review invalidation contract. |
| Address | complete | Strict minimised South African address capture and review invalidation contract. |
| Delivery quotes | complete at source level | `Phase6MarketplaceDeliveryQuoteAdapter` resolves persisted pickup/destination evidence and delegates quote creation to `pricing-quote.service.ts`; the production root then blocks at the source lock. |
| Review | complete at source level | Transaction-scoped review persistence appends review-versioned immutable snapshots, quote evidence, changes, fingerprint and operation receipt. |
| Acknowledgement | complete at source level | Transaction-scoped acknowledgement checks review/version/fingerprint/total/legal evidence, appends immutable acknowledgement, then marks only the current change set accepted. |
| Inventory reservation | complete | Transaction-shaped reserve/release/hold/consume runtime is covered by mocked tests. |
| Reservation expiry | complete | Expiry path preserves `PAYMENT_PENDING_HOLD`. |
| Payment preparation | complete at source level | Phase 10 uses the existing `Payment` aggregate with an explicit marketplace subject; Phase 11 reuses the existing provider-session/PayFast adapter without signing in Phase 20. |
| PayFast return/cancel | complete | Non-authoritative pages and bounded status contract are explicit. |
| Authoritative finalization | complete at source level | The Phase 12 post-commit hook recognizes marketplace subjects, creates a durable finalization receipt, and invokes the real Prisma finalization adapter without rolling back provider success. |
| Order creation | complete at source level | The real finalization adapter locks payment/checkout/reservation/inventory, consumes stock, creates parent/children/immutable lines/allocations/snapshots, binds Payment to MarketplaceOrder and converts the cart atomically. |
| Settlement | partially complete | Frozen/idempotent Phase 14/16 adapter boundary exists; transaction composition is deferred. |
| Reconciliation | complete | Expanded evidence schema, scanner queries and canonical case boundary exist. |
| Confirmation access | complete | Authenticated owner or hashed guest-secret confirmation service/route. |
| Customer APIs | partially complete | Review, acknowledgement, quote and cancellation routes now resolve composition first and return `CONSOLIDATED_VALIDATION_NOT_APPROVED` under the lock; reservation/payment still need their concrete request repositories. |
| Admin APIs | partially complete | Protected read route and route aliases exist; canonical retry composition remains source-locked. |
| Service tests | complete | Executable DB-free cart, checkout, reservation, payment and finalization tests. |
| API tests | complete | Executable route-contract tests. |
| PostgreSQL/Docker/browser proof | deferred to Phase 26.5 | Existing skipped integration and E2E scaffolds only. |

## Existing aggregates retained without reinterpretation

| Existing area | Exact repository surface | Authority / Phase 20 decision |
| --- | --- | --- |
| Legacy basket | `Cart`, `CartItem`, and `CartStatus` near the legacy product models | Authenticated, legacy-product basket records. They remain dormant and compatible; Phase 20 does not alter, migrate, or treat them as marketplace carts. |
| Courier order | `Order`, `OrderItem`, `OrderStatusHistory` | The courier/dispatch aggregate remains unchanged. It is not a marketplace order and must never be fabricated merely to make a payment relation valid. |
| Saved address | `Address` (`userId?`, `storeId?`, `latitude`/`longitude` at `Decimal(10,7)`) | Saved customer/store address authority is retained. Phase 20 stores a minimised checkout snapshot rather than exposing coordinates or silently creating a saved address. |
| Stores | `Store`, `StoreProfile`, public Phase 19 storefront documents | Store identity and Phase 19 public discovery projections remain the source for a store. Cart and checkout resolve the canonical store server side. |
| Catalog offer | `StoreCatalogOffer`, `StoreOfferPriceVersion` | Phase 18 offers and immutable price versions are the source for purchasable offer, price and publication evidence. Client price is never authoritative. |
| Modifiers | `StoreModifierGroup`, `StoreModifierOption`, `StoreOfferModifierGroup` | Phase 20 records immutable per-line selections and snapshots. It validates that a group is attached to an offer and does not invent free-form attributes. |
| Inventory | `CatalogInventoryItem`, `CatalogInventoryLevel`, `CatalogInventoryMovement`, `CatalogInventoryMovementType` | Phase 18 levels/movements are authoritative inventory projections. Phase 20 only adds reservation/commitment evidence and uses canonical transaction services; the older `InventoryItem` / `InventoryMovement` models remain legacy. |
| Delivery pricing | `PricingQuote`, `PricingQuoteLineItem`, `pricing-quote.service.ts` | Phase 6 remains the only pricing authority. Its authenticated route/geocoding flow cannot be silently replaced; Phase 20 uses a strict marketplace quote adapter and fails closed when adequate trusted quote evidence is absent. |
| Payment | `Payment`, `PaymentAttempt`, histories, webhook events and reconciliation cases | Phase 10–12 remain the provider-neutral payment authority. The existing `Payment.orderId` relation is courier-order specific, so Phase 20 makes the compatibility relation optional and binds one payment explicitly to a marketplace checkout/order instead of creating a fake courier order. |
| Provider integration | `payment-preparation.service.ts`, `payfast-checkout.service.ts`, `payfast-itn-application.service.ts`, `payfast-itn-verification.service.ts` | Payment preparation and authoritative ITN confirmation are reused by adapter. Browser return is informational only; no public endpoint may mark a checkout paid or finalise an order. |
| Finance | `commission-*.service.ts`, `store-earning-*.service.ts`, `refund-*.service.ts`, `ledger-*.service.ts` | Phase 14/16 services remain canonical. Phase 20 freezes settlement inputs and prepares reconciliation/orchestration boundaries; it adds no balance override, settlement bypass, or Phase 21 fulfilment behavior. |

## Payment compatibility decision

`Payment` originally had required `userId` and required unique `orderId`, where
`orderId` references courier `Order`. Guest marketplace checkout and the explicit
no-fake-courier-order rule make that contract incompatible with Phase 20. The
additive Phase 20 migration makes the courier `orderId` nullable (while preserving
its unique compatibility constraint), makes `userId` nullable for guest payments,
and adds `PaymentSubjectType` plus unique optional relations to `MarketplaceCheckout` and
`MarketplaceOrder`. A database check and payment-subject trigger require courier
payments to carry one authenticated courier order, and marketplace payments to
carry one checkout and no courier order; authenticated/guest ownership and a
later marketplace-order link are checked by the trigger and service policy.
Existing payment writers continue to set their courier order
and user. Marketplace writers bind exactly one checkout and, after ITN authority,
one marketplace order. No second payment aggregate is introduced.

## New Phase 20 authorities

* `MarketplaceCart` is mutable buyer intent, owned by exactly one customer or
  hashed guest secret, with an opaque public reference, optimistic version and
  idempotent operation receipts.
* `MarketplaceCheckout` is a time-bounded revalidated commercial proposal. It
  owns contact/address snapshots, delivery groups, line/modifier snapshots,
  acknowledgement and commercial-fingerprint evidence.
* `MarketplaceInventoryReservation` temporarily protects stock only after
  checkout review. `UNKNOWN` payment outcomes cannot be released automatically.
* `MarketplaceOrder` and `MarketplaceStoreOrder` are immutable post-payment
  evidence. Store orders begin at `PENDING_STORE_REVIEW`; no Phase 21 transition
  is defined here.
* `MarketplaceSettlementSnapshot` and allocations freeze commission/store earning
  inputs. Delivery fee is separately traceable and outside seller basis.

## Existing writers and safety boundaries

* Catalog writers are the catalog and inventory services; cart/checkout services
  are readers until a transactionally valid reservation/commitment operation is
  invoked.
* The legacy `orders.service.ts` writes courier `Order`; it is not reused to
  create marketplace orders.
* `pricing-quote.service.ts` writes/claims Phase 6 pricing quotes and depends on
  route authority. The marketplace adapter only accepts safe existing evidence;
  it has no local fee formula and does not call a geocoder in Phase 20 checks.
* Payment preparation, PayFast checkout and ITN application are delegated to
  their existing services. The new checkout finalizer is callable only from an
  authoritative confirmation adapter, not an HTTP browser-return route.
* Commission, store earning, refunds and ledger effects remain delegated to
  canonical Phase 14–16 services. The source lock prevents any production
  reservation, payment preparation, order finalisation or settlement effect.

## Privacy and access classification

Public references, lifecycle statuses and aggregate-safe totals may be returned
to the owner or permitted administrator. Guest cart and checkout access require a
high-entropy HttpOnly cookie/secret whose database representation is hashed.
Contact, phone, email, delivery instructions and addresses are operationally
sensitive: no operation ID, request hash, telemetry event, public reference or
admin list response contains them. Coordinates are minimised and omitted from
public responses. Admin routes use explicit permissions; customer and guest routes
use ownership, same-origin checks, strict JSON and rate limits.

## Constraints carried into the implementation

1. ZAR is the only cart/checkout/order currency and all money uses
   `Decimal(18,2)`.
2. Cart, checkout, payment, marketplace order, store order and reservation stay
   separate aggregates.
3. Every cart mutation is optimistic-versioned and idempotent by operation ID and
   request hash.
4. Cart availability is advisory; checkout performs complete revalidation.
5. Variable-weight and made-to-order records fail closed until a reviewed price
   adjustment architecture exists.
6. A checkout supports one recipient and one delivery address, with one trusted
   Phase 6 quote per store group; clients never submit a fee.
7. Database protections enforce ownership, positive quantities, arithmetic,
   immutable snapshots, one live checkout/payment/order and inventory coherence.
8. `MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED` is a source constant set
   to `false`; there is no environment override.

## Research conversion

Marketplace checkout research is converted into explicit snapshots, immutable
evidence, acknowledgement state and parent/store order separation. Legal and
privacy research becomes minimised contact/address snapshots, visible review
evidence and documented retention. Payment research becomes reuse of the existing
provider-neutral aggregate and ITN-only finalisation. Inventory research becomes
bounded reservations with expiry, no cart hold and an `UNKNOWN` payment hold.
The remaining deployment, concurrency, provider, browser and database proof is
explicitly deferred to Phase 26.5.

## Frozen seller-settlement authority

Authoritative checkout review resolves one approved, effective seller-of-record
identity and one approved Phase 14 commission plan/version for every store group.
It freezes only legal seller reconstruction fields: public store reference,
legal/trading name, registration/VAT status where authoritative, country,
identity version and policy classification. Owner, payout and private-contact
data, moderation notes and operational metrics are excluded. Incomplete identity
or commission authority fails the entire multi-store review closed.

The immutable review record binds exact merchandise-plus-modifier seller basis,
commission, earning, line allocations, delivery quote, commercial fingerprint and
versions. Delivery fees remain outside seller basis. Acknowledgement records the
complete evidence-version set; finalization may only consume that accepted review.
This is implementation evidence, not legal or tax approval.
