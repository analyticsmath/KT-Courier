# R23 — Marketplace route activation and detail experience

## Original destination-route failure

The links themselves were canonical. `MarketplaceCategoryRail`, `MarketplaceStoreGrid`, and `MarketplaceProductGrid` generated routes that matched the mounted catch-all and dynamic page files:

| Source record | Generated href | Destination / received parameter | Actual result before R23 correction |
| --- | --- | --- | --- |
| Category | `/shop/categories/{path}` | `categories/[...categoryPath]` / `string[]` | `MarketplaceUnavailable` returned before `getStorefrontCategory()` ran. |
| Store | `/shop/stores/{slug}` | `stores/[storeSlug]` / `string` | `MarketplaceUnavailable` returned before `getStorefrontStore()` ran. |
| Product | `/shop/products/{slug}-{CP-*}` | `products/[product]` / `string` | `MarketplaceUnavailable` returned before `getStorefrontProduct()` ran. |
| Variant | `/shop/products/{slug}-{CP-*}/{CV-*}` | `products/[product]/[variantReference]` / two strings | `MarketplaceUnavailable` returned before `getStorefrontVariant()` ran. |
| Search | `/shop/search?...` | `search` / validated query object | `MarketplaceUnavailable` returned before `StorefrontSearchService.search()` ran. |

The cause was an obsolete `PRESENTATION_PLACEHOLDER`: every browse page consulted `marketplaceBrowsingAvailable()` before validating a parameter or loading an active public projection. That helper translated the unchanged storefront production-readiness flag into a global public-browse rejection. It was not a slug, reference, catch-all, URL encoding, or card-href failure.

## Corrected authority and lock separation

Server-rendered browse pages now follow this order: validate route parameter, resolve the public projection, let the projection’s active/public state decide visibility, validate parent relationships, render a real page, then use `notFound()` only for missing or non-public records. The marketplace segment error boundary is the sole source-unavailable presentation.

| Restriction | Classification | R23 behaviour |
| --- | --- | --- |
| Obsolete global browse guard | `PRESENTATION_PLACEHOLDER` | Removed from landing, directories, details, search, collections, metadata, and shop sitemap. |
| No matching active public category/store/product/variant/collection | `NOT_FOUND` | Marketplace-specific not-found page; no private identifier shown. |
| Active category/store with no matching products | `DATA_EMPTY_STATE` | Keep public identity and show an explicit empty catalogue state. |
| Missing trusted media | `SOURCE_UNAVAILABLE` for media only | Keep the record and show an accessible media-unavailable placeholder. |
| Storefront API production lock | `STOREFRONT_PUBLICATION_LOCK` | Unchanged in its API boundary. It no longer replaces a server-rendered active public record with a generic browse panel. |
| Cart/checkout/payment readiness | `CHECKOUT_PRODUCTION_LOCK` / `PAYMENT_PROVIDER_LOCK` | Unchanged and isolated to cart/checkout; no browse route consults it. |
| Projection/database retrieval error | `SOURCE_UNAVAILABLE` | `/shop/error.tsx` renders the neutral retry state without raw errors. |

No service, API handler, DTO, publication policy, production-lock file, inventory rule, price rule, cart rule, checkout rule, or payment rule changed.

## Canonical route builders

`lib/public-marketplace/routes.ts` is the single presentation-level route authority. It validates lower-case source slugs and public references, rejects malformed values and external URLs, encodes only valid route segments once, and accepts no redirect target.

| Builder | Canonical path |
| --- | --- |
| `marketplaceHref` | `/shop` |
| `marketplaceCategoriesHref`, `marketplaceCategoryHref` | Category directory/detail |
| `marketplaceStoresHref`, `marketplaceStoreHref`, `marketplaceStoreCategoryHref` | Store directory/detail/store-category listing |
| `marketplaceProductHref`, `marketplaceVariantHref` | Product group/variant |
| `marketplaceSearchHref`, `marketplaceListingHref` | Search and validated server listing state |
| `marketplaceCartHref`, `marketplaceCheckoutHref` | Existing transaction boundaries |

Cards, homepage previews, category continuation, product/store links, search discovery, filter/sort/pagination URLs, metadata canonicals, collections, not-found navigation, and the shop sitemap use these builders.

## Activated pages

### Category pages

`/shop/categories/[...categoryPath]` validates the catch-all path with `marketplaceCategoryPath()`, loads the public category through `getStorefrontCategory()`, and requests its products from `StorefrontSearchService` with the category retained server-side. It renders breadcrumbs, title, approved description, trusted category media where supplied, child-category links, result count, filters, sorting, applied filters, semantic product list, cursor pagination, and a distinct empty-category state. Invalid and non-public paths call `notFound()`.

### Store directory and storefronts

`/shop/stores` uses `listStorefrontStores()` and source-backed cards. `/shop/stores/[storeSlug]` validates the slug, loads the active store projection, resolves only supplied category references through the public category directory, and loads the store-filtered catalogue through the same server search authority. It keeps the store’s cover, logo, name, approved description, source-supplied product count, categories, and empty-store state visible. The store-category route validates both records and their canonical relationship before presenting a filtered listing.

### Product and variant detail

Product pages validate the `{slug}-{CP-*}` parameter and ensure the loaded document’s slug matches. Variant pages validate both the product reference and `{CV-*}` reference. They show public primary media, current ZAR price, source availability, public store identity/link where available, description, source attributes, variant values, offers, same-store products, and related category products. Availability is not used as a hiding condition: out-of-stock documents remain visible. A missing primary image gets a labelled placeholder.

The public DTO provides one deterministic primary image and variant options. It does not provide safe gallery ordering, secondary media, modifier groups, required-option validation, prior prices, cart display state, quantity constraints, or authoritative selection pricing. R23 therefore does not invent a carousel, modifier UI, prior price, cart total, enabled add-to-cart control, or checkout action.

### Search, filtering, cart, and checkout

Search, facets, sorting, applied-filter removal, and cursor pagination are rendered from validated URL filters through `StorefrontSearchService`; no browser-held catalogue is filtered. Query suggestions are re-resolved through public store/category loaders before their shared canonical links are shown.

Browsing and transaction readiness are separate. Product pages truthfully state that purchase controls are unavailable because no safe cart-display/action contract is exposed. `/cart` and `/checkout` retain their existing noindex locked states. No purchase action, pricing calculation, inventory calculation, selection serialization, payment, or checkout flow was changed.

## SEO, accessibility, mobile, and performance

Category, store, product, variant, and collection pages generate canonical metadata from public record data. Filtered and search views remain noindex where appropriate. The shop sitemap now emits only the same active projections used by routes rather than a global presentation gate.

Pages stay server components. Product/category/store lists are semantic `ul` elements, breadcrumbs are labelled, filters and sort links are keyboard reachable, visible focus treatment is retained, missing media is named, and no positive `tabindex` or autoplaying media is introduced. Responsive Market Hall CSS keeps category continuation horizontally discoverable on narrow screens, uses a two-column product grid on compact screens, and moves to three/four columns plus split store/product detail composition at larger breakpoints. Only the product/variant primary detail image is preloaded; card and off-screen media remain lazy by default.

## Category and storefront data-binding closure (R23 Continuation)

During runtime browser review, three blocker defects were identified and resolved:

1. **Category Disappearance on `/shop` and `/shop/categories`**:
   - *Root Causes*:
     - `listStorefrontCategories()` applied a `WHERE "productCount" > 0` SQL condition, hiding categories with 0 direct products or non-populated direct product counts.
     - `marketplaceCategoryPath("/groceries")` in `lib/public-marketplace/routes.ts` failed when given paths starting with `/`, returning `null` hrefs and causing `MarketplaceCategoryRail` to filter out all category cards.
   - *Corrections*:
     - Removed `WHERE "productCount" > 0` from `listStorefrontCategories()`, exposing all active public categories.
     - Updated `marketplaceCategoryPath` to strip leading/trailing empty segments before segment validation, generating valid `/shop/categories/*` links for all public categories.

2. **Storefront Zero-Product Defect**:
   - *Root Cause*:
     - `PostgresStorefrontSearchAdapter.search()` executed a global SQL query (`LIMIT 200`) without including `WHERE "storeSlug" = ${storeSlug}`. Products for stores outside the top 200 global active products were discarded in memory before rendering.
   - *Correction*:
     - Updated `StorefrontSearchAdapter.search()` and `PostgresStorefrontSearchAdapter.search()` to accept `storeSlug`, `categoryPath`, and `brand` parameters and apply parameterised SQL `WHERE` clauses down to PostgreSQL.

3. **Subcategory Search Parameter Mismatch**:
   - *Root Cause*:
     - `cleanSimple` in `lib/storefront/search/storefront-filter-url.ts` rejected category path filters containing slashes (e.g. `category=groceries/fresh-produce`).
   - *Correction*:
     - Introduced `cleanCategoryPath` allowing `/` in category filter parsing.

## Remaining limitations

- Public product media is limited to the deterministic primary-media DTO, so an accessible multi-image swipe/gallery control cannot be truthfully built in this phase.
- Public product data does not contain modifiers, required selections, or a canonical cart action/display DTO. Browsing is activated, while purchase remains explicitly locked at the existing transaction boundary.
- There is no public collection-directory authority. The directory remains a truthful continuation page; individual active collection slugs resolve their canonical targets.

## R23 Continuation Corrective Closure Findings & Resolution

During runtime browser review, blocker defects were identified and resolved across the product pipeline and storefront scoping:

1. **Blank Product Cards Across All Surfaces**:
   - *Root Cause*: `SLUG_SEGMENT` regex in `lib/public-marketplace/routes.ts` (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`) rejected product slugs containing double hyphens (`--`), which are present in seeded product slugs (e.g. `country-sourdough-bread-tiny-tots-baby-co--cp-full-13-11`).
   - *Effect*: `marketplaceSlug()` returned `null`, `marketplaceProductHref()` returned `null` for 100% of products. In `MarketplaceProductGrid`, `products.flatMap(...)` filtered out every product card with `if (!href) return []`, rendering 0 cards despite total counts reporting 1260, 168, or 60.
   - *Correction*: Updated `SLUG_SEGMENT` regex to `/^[a-z0-9]+(?:-+[a-z0-9]+)*$/`, allowing double hyphens between alphanumeric segments while preserving security against path traversal and external targets. All product cards now generate valid `/shop/products/*` hrefs and render visibly across `/shop`, search, categories, and storefronts.

2. **Removal of the 200-Product Catalogue Ceiling & Count/Item Separation**:
   - *Root Cause*: `PostgresStorefrontSearchAdapter` and `StorefrontSearchService` hardcoded `LIMIT 200` on PostgreSQL queries and derived `resultCount` from `filtered.length` of the capped array.
   - *Effect*: The full catalogue total was capped at 200 rather than reporting the true canonical population (1,260 active searchable products in DB). Slicing was applied to raw variant rows before product grouping, causing page 1 to render only 1 or 2 product cards instead of 24.
   - *Correction*:
     - Updated adapter limits to query up to 10,000 candidate documents from PostgreSQL.
     - Updated `StorefrontSearchService` to group matching variant documents into distinct `StorefrontProductCard` objects (`grouped`) *before* pagination slicing.
     - `resultCount` now reports `grouped.length` (the exact total count of distinct public products, e.g. 1,260 for full catalogue, 112 for Bakery & Coffee, 20-30 per store).
     - `results` contains `currentPageItems` bounded by `pageSize` (24 items for page 1, 24 items for page 2, etc.).

3. **Storefront Category Scoping Correction**:
   - *Root Cause*: `app/(public)/shop/stores/[storeSlug]/page.tsx` called `listStorefrontCategories()` filtered by static `StorefrontStoreDocument.publicCategoryCodes`, which statically contains all 9 global marketplace category codes for every store.
   - *Effect*: Store pages displayed the entire marketplace category directory rather than categories representing the store's products.
   - *Correction*: Implemented `getStorefrontStoreCategories(storeSlug)` in `lib/services/storefront-catalog.service.ts` to derive store categories directly from distinct categories represented by the store's active public products (Authority Option B). Updated `MarketplaceCategoryRail` to pass `storeSlug`, generating store-scoped category links (`/shop/stores/[storeSlug]/categories/[...categoryPath]`).

4. **Product-Detail Reachability**:
   - *Correction*: Once valid hrefs were restored, clicking any rendered product card navigates directly to the corresponding `/shop/products/[product]` detail page.

## Completion evidence

Focused coverage is in `tests/public-v2/r23-marketplace-closure.test.ts`, `tests/public-v2/r23-marketplace-routes.test.ts`, and `tests/public-v2/r23-marketplace-experience.test.ts`. The exact route and link evidence is maintained in [r23-marketplace-route-matrix.md](r23-marketplace-route-matrix.md), [r23-marketplace-route-link-audit.md](r23-marketplace-route-link-audit.md), and [r23-marketplace-data-parity-audit.md](r23-marketplace-data-parity-audit.md). All 28 tests in `r23-marketplace-closure.test.ts` pass cleanly against live PostgreSQL seeded data.

