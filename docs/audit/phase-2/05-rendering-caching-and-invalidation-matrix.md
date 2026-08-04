# 05 — Rendering, Caching, and Invalidation Matrix

## Overview

This document details the rendering modes, caching strategies, and projection invalidation triggers across all public storefront routes and API endpoints.

## Rendering and Caching Policy Matrix

| Route / Context | Rendering Classification | Cache Policy Header | Prerendering Behavior | Exposure Invariant | Invalidation Trigger |
| --- | --- | --- | --- | --- | --- |
| `/shop` (Shop Home) | `REQUEST_TIME_PUBLIC` | `public, max-age=60, s-maxage=300, stale-while-revalidate=600` | Dynamic at request-time; no prerender DB reads | Renders `MarketplaceUnavailable` when exposure locked | Publication / Category / Store status changes |
| `/shop/categories/*` | `REQUEST_TIME_PUBLIC` | `public, max-age=60, s-maxage=300, stale-while-revalidate=600` | Dynamic at request-time; no prerender DB reads | Layout short-circuits before category query | Category tree updates / Product category re-assignments |
| `/shop/collections/*` | `REQUEST_TIME_PUBLIC` | `public, max-age=60, s-maxage=300, stale-while-revalidate=600` | Dynamic at request-time; no prerender DB reads | Layout short-circuits before collection query | Collection publication / Product curation changes |
| `/shop/products/*` | `REQUEST_TIME_PUBLIC` | `public, max-age=60, s-maxage=300, stale-while-revalidate=600` | Dynamic at request-time; no prerender DB reads | Layout short-circuits before product query | Product / Variant / Offer / Price publication |
| `/shop/stores/*` | `REQUEST_TIME_PUBLIC` | `public, max-age=60, s-maxage=300, stale-while-revalidate=600` | Dynamic at request-time; no prerender DB reads | Layout short-circuits before store query | Store profile / Operating hours / Status changes |
| `/shop/sitemap` | `METADATA_ROUTE` | `public, max-age=3600, s-maxage=3600` | Dynamic XML generation; checks lock first | Returns empty sitemap when exposure locked | Any published product/category/store change |
| `/api/cart/*` | `MUTATING_API` / `PRIVATE_NO_STORE` | `no-store, no-cache, must-revalidate` | N/A (API Handler) | Private to cart owner; never cached publicly | Cart mutation / Claim / Merge operation |
| `/api/checkout/*` | `MUTATING_API` / `PRIVATE_NO_STORE` | `no-store, no-cache, must-revalidate` | N/A (API Handler) | Private to customer owner; never cached | Reservation / Quote / Payment operation |

## Invalidation Event Triggers

1. **Publication Snapshots**: Rebuilding publication snapshots triggers updates to search index documents (`StorefrontProductDocument`) and category counts.
2. **Offer / Price Changes**: Price updates invalidate search display prices and force cart line revalidation on next cart read/claim.
3. **Store Status**: Suspending or closing a store immediately removes its products from public search projections and blocks checkout reservations.
4. **Next.js Cache Config**: `cacheComponents` is set to `false` in `next.config.ts`, maintaining standard compatible dynamic routing.
