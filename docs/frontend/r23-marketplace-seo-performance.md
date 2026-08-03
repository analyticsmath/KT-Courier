# R23 — Marketplace SEO and performance

## Metadata and indexability

`/shop` uses public layout metadata and is noindex when public storefront exposure is locked. Store, category, product, variant and collection routes generate canonical metadata only after the production guard permits public projection use. Search, filtered views, cart, checkout and confirmation remain noindex. Sitemap generation remains gated by `storefrontPublicExposureAllowed()`; root sitemap and robots behavior were not expanded.

## Structured data

Existing guarded ProductGroup, Product and Breadcrumb JSON-LD is preserved. It draws only product/offer fields projected by `StorefrontDocument`. R23 adds no Review, AggregateRating, discount, availability count, delivery estimate, seller-verification or Organization claims.

## Image strategy and layout stability

Primary product detail media and the first landing product use Next `priority`; all other card images use normal lazy loading. Every `Image` uses source dimensions from the DTO and an explicit responsive `sizes` value. The product gallery is deliberately one item because only deterministic primary media is projected; no secondary image is requested speculatively.

## Server/client and payload limits

Landing, directory, listing and detail modules are Server Components. Search uses bounded service page size (24 by default, 48 maximum) and server cursors. Homepage selection is bounded to four records per visible group. No full-catalogue object is passed to a Client Component, no third-party carousel is added and no filter state is held in browser memory.

## Backend/performance limits and validation

Store/product services currently use projection queries and may fail if the database is unavailable; the shop route has a segment error state and homepage preview degrades to editorial availability context. The R23 preflight could not contact the local database at `localhost:5433`; run Lighthouse only with a seeded local instance. Review LCP, image cache headers, cursor paging, media 404 behavior and source response time manually before release.
