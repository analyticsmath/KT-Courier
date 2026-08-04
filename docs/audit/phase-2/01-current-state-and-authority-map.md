# 01 — Current State and Authority Map

## Overview

This document maps all canonical aggregates, domain boundaries, services, writers, readers, and production locks for Phase 2: Store, Catalogue, Customer Discovery and Checkout.

## Branch and Commit Baseline

* **Branch**: `phase/2-store-catalogue-checkout`
* **Starting Commit**: `049be5b734ef4847d74baf9cd7436bf0017111ec`
* **Phase 1 Tag**: `phase-1-foundations-complete-20260804` (reachable at HEAD)

## Authority Map

| Domain / Aggregate | Canonical Model / Entity | Service & Boundary Authority | Writer Authority | Reader Authority | Lock & Exposure Status | Evidence Label |
| --- | --- | --- | --- | --- | --- | --- |
| Catalogue & Taxonomy | `CatalogProduct`, `CatalogVariant`, `CatalogOffer`, `CatalogPrice`, `CatalogInventoryBalance`, `CatalogPublicationSnapshot` | `lib/catalog/*`, `lib/services/storefront-catalog.service.ts` | Server-only admin/storefront services | Projection services & internal services | Locked by `assertCatalogProductionActivationAllowed()` (`CATALOG_PRODUCTION_VALIDATION_APPROVED = false`) | `STATIC_EVIDENCE`, `DECLARED_POLICY` |
| Catalogue Media | `CatalogMediaAsset`, `CatalogMediaAssociation` | `lib/catalog/media/*` | Admin intake routes | Projection rebuild & public media proxy | Production media provider & security scan locked | `DECLARED_POLICY`, `EXTERNAL_PROVIDER_ACTIVATION_PENDING` |
| Public Storefront & Projections | `StorefrontProductDocument`, `StorefrontCategory`, `StorefrontCollection`, `StorefrontSynonym` | `lib/storefront/*`, `lib/services/storefront-catalog.service.ts` | Storefront projection rebuild service | Public `/shop` routes & `/api/storefront/*` | Exposure fail-closed via `storefrontPublicExposureAllowed()`; safe local test opt-in supported | `STATIC_EVIDENCE`, `BEHAVIORAL_TEST` |
| Cart | `MarketplaceCart`, `MarketplaceCartStoreGroup`, `MarketplaceCartLine`, `MarketplaceCartOperation` | `lib/marketplace-checkout/cart-mutation.service.ts`, `lib/marketplace-checkout/prisma-cart-repository.ts` | Owner-scoped cart route handlers & cart mutation service | Owner DTO (`/api/cart/*`) | Storefront exposure checked before line resolution; active carts preferred | `BEHAVIORAL_TEST`, `DB_FREE_VALIDATION` |
| Checkout | `MarketplaceCheckout`, `MarketplaceCheckoutSnapshot`, `MarketplaceCheckoutAcknowledgement` | `lib/marketplace-checkout/*` | Owner-scoped checkout API & reservation service | Owner DTO (`/api/checkout/*`) | Locked via `assertMarketplaceCheckoutProductionReady()` (`MARKETPLACE_CHECKOUT_PRODUCTION_VALIDATION_APPROVED = false`) | `STATIC_EVIDENCE`, `DECLARED_POLICY` |
| Payment Provider | `Payment`, `PaymentAttempt` | `lib/payments/*`, `lib/payments/providers/payfast/*` | Provider confirmation webhook | Safe owner payment status | Locked by PayFast configuration & checkout production lock | `DECLARED_POLICY`, `EXTERNAL_PROVIDER_ACTIVATION_PENDING` |
| Store Orders & Handoff | `MarketplaceStoreOrder`, `MarketplaceStoreOrderLine` | `lib/store-orders/*` | Finalizer service on verified payment confirmation | Customer order projection & store dashboard | Locked by `assertStoreOrderProductionReady()` (`STORE_ORDER_PRODUCTION_VALIDATION_APPROVED = false`) | `STATIC_EVIDENCE`, `DECLARED_POLICY` |

## Repository Architecture Invariants

1. **Legacy Aggregates**: Legacy `Cart`, `CartItem`, and courier `Order` models are preserved without reinterpretation; marketplace workflows use Phase 18–23 aggregates.
2. **Single Transaction Boundary**: Inner merge operations are executed inside the outer transaction; nested transaction-wrapping is prohibited.
3. **No Fallback Data**: No mock products, stores, pricing, or media fallbacks exist; infrastructure failures return structured unavailable presentations.
