# Storefront integration testing

`vitest.storefront-integration.config.ts` and the integration script are deferred
until Phase 26.5. They must use a uniquely named disposable Compose project and
database, never the canonical volume, with no external search or geocoder.
Scenarios cover snapshot replay/withdrawal, prices/media, search/facets, area
context, cache evidence, SEO and source-lock invariants.

