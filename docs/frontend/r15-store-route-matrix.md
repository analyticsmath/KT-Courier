# R15 — Verified Store Route Matrix

## Verification basis

This matrix follows `app/(store)/store`, not the conceptual R12 list. Every row inherits the store layout’s `STORE` role guard, protected noindex/shell boundary, and server-side navigation filtering. Record-specific ownership, eligibility, and permissions remain in the existing service/API authority.

| ID | Path | Authority / DTO | Page composition and mobile behavior | State, lock, validation, risk |
| --- | --- | --- | --- | --- |
| S01 | `/store` | Store dashboard/pickup services; `listOrders`; `listStoreOrderQueue`; earning summary | Queue-first overview; four max metrics; compact record list; context rail desktop | Concrete; server ordering; active-store finance projection only; medium privacy/aggregation risk |
| S02 | `/store/orders` | `listOrders`; owned active-store queue | Marketplace queue plus distinct courier table/records | Concrete; list detail routes; ownership server-side; medium operational risk |
| S03 | `/store/orders/[id]` | `getOrder` owned DTO; existing cancellation action | Courier request status, minimal addresses, request details, timeline | Concrete; canonical action and ownership retained; medium privacy risk |
| S04 | `/store/marketplace-orders/[reference]` | owned `MarketplaceStoreOrder` projection; canonical actions API | Store-safe fulfilment detail and action island | Concrete/partial; idempotency/concurrency/action eligibility retained; high fulfilment/privacy risk |
| S05 | `/store/new-delivery` | `DeliveryRequestForm`; pickup service; repeat prefill | Existing canonical form in protected frame; one-column mobile | Concrete; pricing/region/idempotency authority unchanged; high request risk |
| S06 | `/store/catalog` | active owned-store catalog summary | Four compact source counts, catalog context, locked storefront state | Concrete; no public visibility claim; medium publication risk |
| S07 | `/store/catalog/products` | `listStoreCatalogProducts` | Server GET search/status; table to stacked records | Concrete; canonical products; medium catalog/privacy risk |
| S08 | `/store/catalog/products/new` | existing `StoreCatalogWizard`; type/category options | Existing progressive wizard; one-column mobile | Concrete; draft/validation/submission unchanged; high mutation risk |
| S09 | `/store/catalog/products/[publicReference]` | `getStoreCatalogProduct` | Identity, state, variants, locked storefront context | Concrete; owned product record; medium publication risk |
| S10 | `/store/catalog/offers` | `listStoreCatalogOffers` | Offer table to structured records | Concrete; price/inventory stay separate; medium commercial risk |
| S11 | `/store/catalog/offers/[publicReference]` | `getStoreCatalogOffer` | Offer, versioned price, inventory evidence | Concrete; canonical records; medium finance/publication risk |
| S12 | `/store/catalog/inventory` | `listStoreInventory` | Inventory table to records; no mutation control | Concrete; movement-backed; no threshold/reservation invention; high stock risk |
| S13 | `/store/catalog/media` | `listStoreCatalogMediaForPage` | Media evidence table to records | Partial/locked lifecycle; no storage key or standalone uploader; medium media risk |
| S14 | `/store/catalog/modifiers` | `listStoreModifierGroups` | Group panels with exact options | Partial; modifiers distinct from variants; medium catalog risk |
| S15 | `/store/catalog/imports` | `listStoreCatalogImports` | Import safeguard panel plus stack table | Partial; existing dry-run/apply validation retained; high import risk |
| S16 | `/store/earnings` | `getStoreEarningSummaryForOwner`; `listStoreEarningsForOwner` | Currency-explicit metrics and earnings records | Concrete; source-backed money; execution locked; high financial risk |
| S17 | `/store/earnings/[publicReference]` | `getStoreEarningForOwner` | Store-safe money/status/activity detail | Concrete; journal references omitted; execution unavailable; high financial risk |
| S18 | `/store/profile` | `getStoreProfile`; pickup service; existing profile/address forms | Identity and pickup form panels | Concrete; existing validation/mutation APIs retained; medium identity risk |
| S19 | `/store/notifications` | minimal owned inbox projection | Server semantic inbox list | Concrete; title/body/state/time only; low privacy risk |
| S20 | `/store/support` | Existing `/contact` path | Source-honest support handoff | Concrete route/no ticket DTO; no ticket fixture; low risk |
| S21 | `/store/subscription` | Existing subscription production state | Locked protected state | Locked; no plan/billing inference; high payment risk |
| S22 | `/store/subscription/plans` | Existing subscription production state | Locked protected state | Locked; no tier/pricing/upgrade control; high payment risk |
| S23 | `/store/subscription/billing` | Existing subscription production state | Locked protected state | Locked; no invoice/provider history; high payment risk |
| S24 | `/store/subscription/benefits` | No store-safe entitlement projection | Locked protected state | Partial/locked; no quota/benefit fixture; medium entitlement risk |
| S25 | `/store/promotions` | Existing promotions production state | Locked protected state | Locked; no campaign/coupon fixture; high commercial risk |
| S26 | `/store/promotions/new` | Existing promotions production state | Locked protected state | Locked; no form/action made available; high commercial risk |
| S27 | `/store/promotions/[reference]` | Existing promotions production state | Locked protected state | Locked; no campaign detail fixture; high commercial risk |
| S28 | `/store/promotions/[reference]/budget` | Existing promotions production state | Locked protected state | Locked; no budget/billing data; high financial risk |
| S29 | `/store/promotions/[reference]/redemptions` | Existing promotions production state | Locked protected state | Locked; no redemption/customer data; high privacy/financial risk |
| S30 | `/store/advertising` | Existing advertising production state | Locked protected state | Locked; no campaign/funding/reporting action; high commercial/financial risk |

## Absent conceptual areas

There is no concrete store route for staff permissions, operating-hours configuration, commissions, withdrawals, wallet activity, storefront configuration, marketplace availability, categories/collections, security/preferences, or store-specific developer access. R15 adds none.

## Loading, error, and query behavior

No `loading.tsx`, `error.tsx`, or `not-found.tsx` exists under the store segment; root boundaries remain effective. The concrete query behavior is preserved: new delivery reads `repeatFrom`; product list reads `search` and `status`. No query-backed route is renamed or given client-only authority.
