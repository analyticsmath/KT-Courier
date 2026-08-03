# Phase 19 research and implementation map

## Audit conclusion

Phase 19 is a public **read model** over Phase 18 publication evidence.  It must
not query mutable catalog drafts for public truth, and it must not introduce a
cart, order, payment, inventory, ledger, or pricing writer.

## Source-of-truth audit

| Area | Existing authority and relevant evidence | Public use in Phase 19 | Boundary / cache implication |
| --- | --- | --- | --- |
| Publication | `CatalogPublicationSnapshot` is immutable, has `status`, `publicationVersion`, product/variant/offer foreign keys and a unique offer version. `rebuildCatalogPublicationSnapshot` makes the snapshot from product, variant, offer, price, inventory and media evidence. | Only `PUBLISHED`, non-superseded snapshots seed product documents. | A changed or withdrawn snapshot invalidates the corresponding document and public tags; a malformed snapshot opens a reconciliation case. Phase 20 may revalidate its own commercial truth independently. |
| Catalog events | `CatalogChangeEvent` is the existing outbox-style evidence with aggregate reference/version, typed events, `processedAt`, and uniqueness. `recordCatalogEvidence` is its writer. | The storefront consumer records its own idempotent processing evidence; it does not replace the catalog event architecture. | Catalog events create projection/cache invalidation intent only. |
| Product and taxonomy | `CatalogProduct`, `CatalogProductVariant`, `CatalogCategory`, `ProductTypeDefinition`, and `CatalogBrand` carry lifecycle/status, versions, public references, category path, approved facet schema, and product/variant attributes. | Snapshot content is checked against current active product/category/type/brand eligibility before projection. | Draft, moderation, suspension and schema-private fields never reach public DTOs. |
| Offers and prices | `StoreCatalogOffer` has active/publication lifecycle, fulfilment and selling-unit data. `StoreOfferPriceVersion` is immutable when active and is ZAR/VAT-inclusive with positive exact value checks. | Projection stores one exact active price version per snapshot/variant/offer. | Price is rendered from the projection, never recalculated or replaced with a promotion. Phase 20 must revalidate before commitment. |
| Inventory | `CatalogInventoryItem` and `CatalogInventoryLevel` are the inventory projections. Inventory is location based and its movement evidence is append-only. | Only bounded `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `BACKORDER`, or `UNKNOWN` availability is exposed. | No quantity, reservation count, location name, or inventory identifier is public. Availability is advisory only. |
| Media | `CatalogMediaAsset` requires READY validation and privacy inspection. `CatalogProductMedia` carries role/alt text. `/api/catalog/media/[publicReference]` is the established trusted media delivery route. | Documents keep public references, dimensions, and alt text only. | Storage keys, checksums and private/compliance media never leave the server. |
| Stores | `Store` has public name/slug/status and legacy address/contact fields; `StoreProfile` is owner-facing and includes contact data. There is no separate public storefront profile or branch/schedule model. | Store documents intentionally use only reviewed name/slug/status, public categories and fulfilment modes inferred from projected offers. | Owner/contact/address data remains private. A public profile policy is represented by the projection rather than copying private store fields. |
| Location/serviceability | `DeliveryRegion` is the existing coarse active service-area model (`slug`, city, province, centre, radius); `Address` contains private exact coordinates. | A signed opaque area cookie represents a selected active `DeliveryRegion` reference. | No raw address, coordinate, place id, or precision enters a URL, cache key, telemetry, or public response. Existing order serviceability remains authoritative for Phase 20. |
| Routing/SEO | App Router has `(public)` marketing pages, root `robots.ts`, `sitemap.ts`, root metadata, and no storefront preview or public catalog pages. | Add `/shop`, category/product/variant/store/collections pages plus store APIs. | Query/search/location pages use `noindex, follow`; canonical browse documents only enter sitemaps. |
| Caching | No compatible domain cache helper exists. Next 16 Cache Components documentation requires cache directives/tags only in an appropriate cache scope and runtime values outside it. | Cache policy is expressed by bounded public tags and a cache-invalidation intent table; route responses use safe cache headers. | Preview must be private/no-store. Publication withdrawal fails closed. |
| Auth/rate limiting | `getCurrentUser`, permission helpers, `PERMISSIONS`, and the in-memory IP limiter are existing conventions. Explicit user `DENY` overrides role grants. | Public search uses the same IP limiter. Admin storefront tools reuse existing permission semantics. | Public APIs are anonymous/read-only; internal IDs and account data are excluded. |
| Analytics | No compatible public analytics event pipeline exists. | Telemetry is intentionally a bounded, anonymous, no-query-text/no-location-precision server record. | No profiles, history, advertising, or personalised ranking are introduced. |

## Current writers and privacy classification

`catalog-publication.service.ts`, catalog product/variant/offer/price/inventory
services, and catalog moderation services are canonical writers. Phase 19 only
writes storefront documents, event processing evidence, reconciliation cases,
approved editorial collections, synonym sets, and coarse anonymous telemetry.
The publication snapshot is public-source evidence but its raw JSON is still not
a public API contract. Store profiles, address rows, media storage keys,
moderation data, operation receipts, request hashes, inventory counts and
catalog drafts are private.

## Research converted to implementation

Marketplace discovery research is implemented as product-family grouping, clear
price/unit-price labels, availability caveats, multiple-offer comparison and
safe zero-result recovery. Search research is implemented with deterministic
normalisation, reviewed immutable synonym versions, typed facets, stable cursors
and an injected PostgreSQL-neutral adapter. Local-service research is limited to
an explicit coarse service-area selection; unknown location remains browsable.
SEO research becomes canonical document URLs, `noindex` filtered/search pages,
structured data sourced from visible document values, and segmented sitemaps.
Accessibility research becomes labelled landmarks, keyboard-operable filtering
and combobox controls, announced results, visible focus states and mobile filter
controls. Performance research keeps public pages server-rendered, dimensions
media, limits payloads/facets and uses tag-based invalidation intent.

## Phase 20 boundary

The storefront availability and eligibility states are advisory browse evidence.
They neither reserve stock nor promise delivery. Phase 20 must independently
validate an active price, inventory, store/service area and publication state
before any commercial commitment.

## Completion-correction audit (2026-07-18)

The initial Phase 19 implementation was structurally complete but its DB-free
verification and editorial administration were not approval-ready. The
following audit records the corrected state without calling scaffolding a test.

| Surface | Initial audit status | Corrected Phase 19 status | Deferred to Phase 26.5 |
| --- | --- | --- | --- |
| `tests/storefront/*` policy files | 2 executable files and 23 `test.todo` scaffolds | 25 executable policy files covering publication, projection, ranking, privacy, SEO, cache, availability, lifecycle, source audit, and UI contracts | Live database/search behaviour and browser/a11y validation |
| Storefront service tests | 13 `test.todo` scaffolds | 13 executable DB-free/mocked service files for projection, consumer, search, suggestions, category, product, store, collection, location, SEO, sitemap, preview, and reconciliation | Transactional PostgreSQL behaviour and outbox concurrency |
| Storefront API tests | Missing focused route-contract coverage | 2 executable route-contract files cover public browse-only handlers, bounds, safe deletion, preview, collection/synonym routes, and reconciliation boundaries | Auth-session/browser/network integration |
| Editorial collections | Read-only listing; category/store targets were intentionally omitted in rendering | Explicit `CATEGORY`, `PRODUCT`, `VARIANT`, and `STORE` targets; source-version evidence; tombstoned removal; immutable lifecycle history; guarded lifecycle API and admin controls | Migrated-data and production activation tests |
| Synonyms | Model/read list only | Deterministic normalized equivalent/one-way terms, reviewed version lifecycle, one-active-version rule, immutable history, strict APIs and draft/review controls | Search-quality evaluation on live corpus |
| Projection reconciliation | Read-only case list | Case inspection plus canonical snapshot rebuild and post-coherence resolution; no price/publication/cache/JSON override | Live recovery drills |
| Public schedule | No authoritative source | Store/collection-facing status is `HOURS_UNAVAILABLE`; no `OPEN`, `CLOSED`, opening-hours markup, or order-acceptance claim | Approved public schedule source |

The unexecuted Phase 19 migration was amended in place to remove the unsupported
`OFFER` collection target and add source-version/tombstone evidence, lifecycle
history, synonym optimistic versioning, and reconciliation resolver/version
evidence. No Phase 18 or older migration was modified. No Phase 19.1 migration
was created.
