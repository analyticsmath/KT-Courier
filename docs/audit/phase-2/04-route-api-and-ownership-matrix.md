# 04 — Route, API, and Ownership Matrix

## Overview

This matrix maps all public storefront routes, marketplace cart APIs, checkout endpoints, and administrative control paths to their handler locations, HTTP methods, security boundaries, rate-limit policies, and lock status.

## Public Storefront Routes

| Route Path | Type | Handlers / File Path | Exposure Gate | Metadata Invariant | Lock Status |
| --- | --- | --- | --- | --- | --- |
| `/shop` | Server Component | `app/(public)/shop/layout.tsx`, `app/(public)/shop/page.tsx` | `publicStorefrontPageExposureAllowed()` | `noindex` when locked | Fail-closed by default |
| `/shop/categories/[...categoryPath]` | Server Component | `app/(public)/shop/categories/[...categoryPath]/page.tsx` | Layout & `generateMetadata` gate | `noindex` when locked / filters present | Fail-closed by default |
| `/shop/collections/[collectionSlug]` | Server Component | `app/(public)/shop/collections/[collectionSlug]/page.tsx` | Layout & `generateMetadata` gate | `noindex` when locked | Fail-closed by default |
| `/shop/products/[product]` | Server Component | `app/(public)/shop/products/[product]/page.tsx` | Layout & `generateMetadata` gate | `noindex` when locked | Fail-closed by default |
| `/shop/products/[product]/[variantReference]` | Server Component | `app/(public)/shop/products/[product]/[variantReference]/page.tsx` | Layout & `generateMetadata` gate | `noindex` when locked | Fail-closed by default |
| `/shop/stores/[storeSlug]` | Server Component | `app/(public)/shop/stores/[storeSlug]/page.tsx` | Layout & `generateMetadata` gate | `noindex` when locked | Fail-closed by default |
| `/shop/sitemap` | Dynamic Metadata | `app/shop/sitemap/route.ts` | Request-time lock check | Dynamic XML | Fail-closed by default |

## Marketplace Cart & Checkout APIs

| Endpoint | Method | File Path | Auth Requirement | Rate Limit | Primary Mutation | Lock Status |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/cart` | GET | `app/api/cart/route.ts` | Customer / Guest Token Cookie | Standard (60/min) | None (Read Cart) | Checks public exposure before line resolution |
| `/api/cart/line` | POST | `app/api/cart/line/route.ts` | Customer / Guest Token Cookie | Mutation (30/min) | `ADD_LINE` | Checks public exposure before line resolution |
| `/api/cart/line/[lineReference]` | PATCH | `app/api/cart/line/[lineReference]/route.ts` | Customer / Guest Token Cookie | Mutation (30/min) | `UPDATE_QUANTITY` / `REPLACE_MODIFIERS` | Checks public exposure before line resolution |
| `/api/cart/line/[lineReference]` | DELETE | `app/api/cart/line/[lineReference]/route.ts` | Customer / Guest Token Cookie | Mutation (30/min) | `REMOVE_LINE` | Active cart owner required |
| `/api/cart/clear` | POST | `app/api/cart/clear/route.ts` | Customer / Guest Token Cookie | Mutation (30/min) | `CLEAR` | Active cart owner required |
| `/api/cart/claim` | POST | `app/api/cart/claim/route.ts` | Customer Auth + Guest Cookie | Mutation (15/min) | `CLAIM` / `MERGE` | Revalidates guest items server-side |
| `/api/checkout/quote` | POST | `app/api/checkout/quote/route.ts` | Customer Auth | Mutation (15/min) | `DELIVERY_QUOTE` | Locked by `assertMarketplaceCheckoutProductionReady()` |
| `/api/checkout/review` | POST | `app/api/checkout/review/route.ts` | Customer Auth | Mutation (15/min) | `CHECKOUT_REVIEW` | Locked by `assertMarketplaceCheckoutProductionReady()` |
| `/api/checkout/reserve` | POST | `app/api/checkout/reserve/route.ts` | Customer Auth | Mutation (10/min) | `RESERVATION` | Locked by `assertMarketplaceCheckoutProductionReady()` |
| `/api/checkout/payfast/prepare` | POST | `app/api/checkout/payfast/prepare/route.ts` | Customer Auth | Mutation (10/min) | `PAYMENT` | Locked by PayFast configuration |

## Security Verification Evidence

* **Route Security Manifest**: Verified via `node scripts/verify-route-security-manifest.mjs` (587 route files, 680 methods checked). Exit code `0`.
* **Server Action Audit**: Verified zero exported Server Actions exist in public storefront or cart API paths.
