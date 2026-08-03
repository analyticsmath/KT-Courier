# R23 — Marketplace Data Parity Audit

## Overview

This document records the data parity audit and authority mappings across all public marketplace surfaces following R23 continuation.

---

## 1. Category Authority by Surface

| Surface | Route | Loader / Service Invoked | Public Category Predicate | Result / Rendering Authority |
|---|---|---|---|---|
| `/shop` | `app/(public)/shop/page.tsx` | `getStorefrontHome()` -> `listStorefrontCategories()` | `StorefrontCategoryDocument` (all active categories) | Top-level selection in `MarketplaceCategoryRail`. |
| `/shop/categories` | `app/(public)/shop/categories/page.tsx` | `listStorefrontCategories()` | `StorefrontCategoryDocument` (all active categories) | Complete directory hierarchy in `MarketplaceCategoryRail`. |
| `/shop/categories/[...categoryPath]` | `app/(public)/shop/categories/[...categoryPath]/page.tsx` | `getStorefrontCategory(path)` | `canonicalPath = path` (normalized with leading `/`) | Category identity, subcategories, and category-filtered products. |
| Marketplace Search | `app/(public)/shop/search/page.tsx` | `StorefrontSearchService.search(filters)` | Active product facets from `StorefrontProductDocument` | Category facets and category-filtered product list. |
| Sitemap | `app/(public)/shop/sitemap.ts` | `listStorefrontCategories()` | `StorefrontCategoryDocument` | Canonical category URLs (`/shop/categories/{path}`). |

*Rule Enforcement*: No public category is excluded because `productCount` is zero, media is missing, or checkout is locked.

---

## 2. Product Authority by Surface

| Surface | Route | Loader / Service Invoked | Visibility Predicates | Product Relationship |
|---|---|---|---|---|
| `/shop` (New Arrivals) | `app/(public)/shop/page.tsx` | `StorefrontSearchService.search({ pageSize: 12 })` | `status = 'ACTIVE'`, `searchable = true` | Global marketplace products. |
| Category Listing | `app/(public)/shop/categories/[...categoryPath]/page.tsx` | `StorefrontSearchService.search({ category: path })` | `status = 'ACTIVE'`, `searchable = true`, `categoryPath = path OR categoryPath LIKE path/%` | Products matching category hierarchy. |
| Storefront Catalogue | `app/(public)/shop/stores/[storeSlug]/page.tsx` | `StorefrontSearchService.search({ store: slug })` | `status = 'ACTIVE'`, `searchable = true`, `storeSlug = slug` | Products owned by the store (`StorefrontProductDocument.storeSlug`). |
| Product Detail | `app/(public)/shop/products/[product]/page.tsx` | `getStorefrontProduct(reference)` | `status = 'ACTIVE'`, `productPublicReference = reference` | Representative product and price-sorted offers. |

*Rule Enforcement*: Canonical product visibility (`status = 'ACTIVE'`, `searchable = true`) is uniformly applied across all discovery surfaces.

---

## 3. Store Identity Mapping

| Store Field | Canonical Schema Reference | URL Parameter | Query Filter | Usage |
|---|---|---|---|---|
| Public Slug | `Store.slug` / `StorefrontStoreDocument.slug` | `storeSlug` (e.g. `fynbos-floral-design`) | `storeSlug` | Public routing (`/shop/stores/{slug}`) and search filtering. |
| Public Reference | `Store.slug` / `StorefrontStoreDocument.storePublicReference` | — | — | Public DTO reference for store identity. |
| Primary Key | `Store.id` / `StorefrontStoreDocument.storeId` | — | `storeId` | Internal database relation to `StorefrontProductDocument`. |
| Owner User ID | `Store.userId` | — | — | Not exposed in storefront URLs or search filters. |

---

## 4. Storefront Product Relationship

- `StorefrontProductDocument.storeSlug` stores the store's public slug.
- `StorefrontProductDocument.storeId` stores the store's internal database ID.
- `PostgresStorefrontSearchAdapter.search()` executes parameterised SQL `WHERE "storeSlug" = ${input.storeSlug}` when querying products for a specific storefront.
- Internal database IDs (cuid) are never exposed in URLs, and public slugs are never passed into internal ID filters.

---

## 5. Count Consistency & Filter Defaults

- **Category Counts**: `productCount` in `StorefrontCategoryDocument` represents the total count of active published products in that category. Where count is unavailable, it is omitted rather than displayed as zero.
- **Store Counts**: `publishedOfferCount` in `StorefrontStoreDocument` represents the total count of active published offers owned by the store.
- **Filter Defaults**:
  - `category`: absent by default
  - `store`: absent by default
  - `q`: absent by default
  - `availability`: absent by default (all browseable availability states included)
  - `page`: 1 by default
  - `pageSize`: 24 by default

---

## 6. Checkout-Lock Separation

- Browsing queries (`listStorefrontCategories`, `getStorefrontStore`, `StorefrontSearchService.search`, `getStorefrontProduct`) do **NOT** consult `MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED`.
- Production checkout locks apply strictly at `/cart` and `/checkout` boundary routes.

---

## 7. Representative Runtime Verification

Verified against live PostgreSQL database instance:
- `listStorefrontCategories()` returns 9 public categories with 100% valid `/shop/categories/*` hrefs.
- `getStorefrontStore("archived-fashion-outlet")` resolves store identity, returns 30 published products, and derives store-scoped categories (`getStorefrontStoreCategories`).
- `StorefrontSearchService.search({})` (Full Catalogue) returns `resultCount = 1260` (uncapped, true total) and 24 paginated product cards (`currentPageItems`).
- `StorefrontSearchService.search({ store: "archived-fashion-outlet" })` returns `resultCount = 20` and 20 paginated product cards.
- `StorefrontSearchService.search({ category: "/bakery-coffee" })` returns `resultCount = 112` and 24 paginated product cards.
- 100% of product cards produce non-null `href`s (e.g. `/shop/products/country-sourdough-bread-tiny-tots-baby-co--cp-full-13-11-CP-FULL-13-11`).
- 28/28 automated Vitest assertions passed in `tests/public-v2/r23-marketplace-closure.test.ts`.
