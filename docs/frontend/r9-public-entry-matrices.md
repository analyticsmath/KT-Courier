# R9 verified public-entry matrices

Verified against the repository before R9 presentation work. This record is
about public rendering boundaries; it does not alter the authorities named
below.

## Marketplace matrix

| Route | Current state | Lock authority | Data authority | Indexability | Safe public rendering | Canonical action | Risk addressed |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/shop` | Storefront locked | `storefrontPublicExposureAllowed()` | `getStorefrontHome()` only when allowed | Indexable editorial entry | Editorial availability preview, no catalog DTO | `/join#stores`, `/account/request-delivery` | Fixture catalog or lock bypass |
| `/shop/categories` and `/shop/categories/[...categoryPath]` | Storefront locked | Same storefront guard | Category projection and search service only when allowed | Noindex while locked | Marketplace unavailable state | `/shop`, `/join#stores` | Fixture categories and category leakage |
| `/shop/stores` and `/shop/stores/[storeSlug]` | Storefront locked | Same storefront guard | Store projection only when allowed | Noindex while locked | Marketplace unavailable state | `/shop`, `/join#stores` | Fixture stores and private store leakage |
| `/shop/products/[product]` and variant route | Storefront locked | Same storefront guard | Product/offer projection only when allowed | Noindex while locked | Marketplace unavailable state | `/shop`, `/join#stores` | Product/offer schema and private catalog leakage |
| `/shop/collections` and `/shop/collections/[collectionSlug]` | Storefront locked | Same storefront guard | Collection projection only when allowed | Noindex while locked | Marketplace unavailable state | `/shop`, `/join#stores` | Fixture collections and unpublished collection leakage |
| `/shop/search` | Legacy fixture client search | Storefront guard added by R9 | Storefront search service only when allowed | Noindex while locked | Marketplace unavailable state without a search form | `/shop`, `/contact` | Fixture products, ranking exposure, unsafe query echo |
| `/cart` | Static scaffold | Marketplace/cart authority remains unchanged | Cart service is not called by R9 | Noindex | Explicit unavailable state, no lines or totals | `/shop`, `/account/request-delivery`, `/contact` | Simulated persisted cart or checkout CTA |
| `/checkout` | Static scaffold | `marketplaceCheckoutProductionReady()` remains false | Checkout review authority is not called by R9 | Noindex | Explicit unavailable state, no form or payment control | `/cart`, `/contact` | Payment or inventory simulation |
| `/order-confirmation/[publicReference]` | Boundary copy only | Existing customer/guest-secret authority remains unchanged | No safe DTO is loaded by the route | Noindex | Generic access boundary; no reference echo or confirmation claim | `/account/orders`, `/contact` | Arbitrary-reference disclosure or fabricated success |

## Participation matrix

| Participant | Public information source | Canonical action | Eligibility and document authority | Earnings authority | Current lifecycle/public state | Unsupported claims excluded |
| --- | --- | --- | --- | --- | --- | --- |
| Store | `StoreSignupSchema`, `SignupForm`, store role redirect | `/signup?role=store` | Existing secure signup and store operations; no public document list is exposed | Store earnings services are protected | Business/store account registration exists; storefront exposure remains locked | Fees, commissions, settlement timing, approval timing, delivery volume, marketplace placement |
| Driver | Public careers snapshot plus `/services/driver-network` | `/services/driver-network`, with `/careers` for published roles | Recruitment opening authority publishes role-specific criteria only | Driver earning services are protected | Driver-network route is contact-led; recruitment only exposes published openings | Vehicle/licence/insurance/background requirements, income, rate, commission, work volume, approval time |
| Promoter | Promoter lifecycle service and public contact contract | `/contact` labelled “Ask about the promoter programme” | Promoter lifecycle and agreement acceptance are protected and production-locked | Qualification and withdrawal services are protected | Lifecycle includes `APPLIED`, review outcomes, `APPROVED`, then `ACTIVE`; there is no public application endpoint | Acceptance, referrals, customers, earnings, withdrawal, commission, review time, risk/fraud information |

## Developer matrix

| Public route/resource | Protected route or authority | Application/lifecycle | Terms and credentials | Supported environments | Scopes, limits, quotas | Webhook/OpenAPI authority | Public-safe fields |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/developers` | Existing developer portal route family and `/api/developer/*` session gateway | `DeveloperApplicationService`; `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → ACTIVE` plus suspension, revocation, rejection and archive states | `DeveloperTermsService`; `CredentialService` returns an opaque secret once only | `TEST`; `LIVE` exists in the contract but remains production-locked | `DEVELOPER_SCOPE_KEYS`; OpenAPI rate-limit classes and quota categories, without invented numeric allocations | `WebhookSubscriptionService`, signed-event contract, `/api/openapi/v1.json` | Version, route families, scopes, contract-backed headers and security guidance; never secrets, user data, internal IDs, operational metrics or private endpoints |
| `/api/openapi/v1.json` | Static OpenAPI source and parity manifest | N/A | N/A | Test and locked live server entries | Per-operation `x-rate-limit-class`, `x-quota-categories`, and idempotency parameters | `openapi/kt-couriers-v1.json`, served unchanged | Public API description and schemas only |
| `/developers/*` and `/api/developer/*` | Session gateway plus own-permission checks | Owner-bound applications and review outcomes | Credential, webhook and usage records remain owner-bound | Application environment is owner-bound | Scope grants are authoritative and owner-bound | Webhook subscription/delivery operations remain owner-bound | Only authenticated, authorized DTOs from the gateway |

## R9 authority decisions

- Storefront and checkout production locks remain unchanged and are only read on
  the server.
- R9 does not make a catalog, cart, checkout, promoter, recruitment, or
  developer mutation.
- Public editorial imagery is local, provisional, and labelled
  `EDITORIAL_ONLY`; it is never attached to catalog identity or pricing.
