# 11 — Human Browser Validation Specification

## Overview

This document provides a step-by-step interactive manual testing guide for human acceptance testing of Phase 2 (Store Catalogue, Public Discovery, Cart, and Checkout) when executing with a local PostgreSQL instance and server-side local activation (`KT_LOCAL_STOREFRONT_VALIDATION=true` and `KT_LOCAL_CHECKOUT_VALIDATION=true`).

## Prerequisites

1. Local PostgreSQL running with applied migrations (`npx prisma migrate deploy`).
2. Seeded test marketplace data (`npm run demo:seed` or test seed).
3. Local server started:
   ```powershell
   $env:DATABASE_URL="postgresql://kt_user:kt_pass@localhost:5432/kt_phase2_disposable_test?schema=public"
   $env:KT_LOCAL_STOREFRONT_VALIDATION="true"
   $env:KT_LOCAL_CHECKOUT_VALIDATION="true"
   npm run dev
   ```

---

## 1. Store Catalogue Admin & Store Management

### Test Case 1.1: Product Draft Creation & Validation
* **Action**: Log in as a Store Manager; navigate to Store Admin -> Products -> Create Product. Fill in product name, description, category, product type, attributes, and initial offer price.
* **Expected Result**: Draft product is created in `DRAFT` state. Form validates missing required fields (e.g. category, offer price) with visible error messages.
* **Network / API**: `POST /api/catalog/products` returns `201 Created` with JSON product DTO.

### Test Case 1.2: Variant Attribute Combination Uniqueness
* **Action**: Add two variants to a product with identical attribute values (e.g. Size: "Medium", Color: "Red").
* **Expected Result**: System rejects duplicate variant combination with clear UI error message.
* **Network / API**: `POST /api/catalog/variants` returns `400 Bad Request` (`VARIANT_ATTRIBUTE_DUPLICATE`).

### Test Case 1.3: Cross-Store Reference Prevention
* **Action**: Attempt to attach a product or category belonging to Store A while logged in as Store B manager.
* **Expected Result**: Permission denied; cross-store reference rejected.
* **Network / API**: Returns `403 Forbidden` (`STORE_ACCESS_DENIED`).

---

## 2. Public Discovery & Storefront

### Test Case 2.1: Production exposure locked by default
* **Action**: Start server without `KT_LOCAL_STOREFRONT_VALIDATION=true`. Navigate to `http://localhost:3000/shop`.
* **Expected Result**: UI displays `MarketplaceUnavailable` component indicating storefront activation is pending. Page metadata returns `noindex`.
* **Network / API**: Server returns 200 OK with `noindex` robots meta tag; zero SQL projection queries executed.

### Test Case 2.2: Local Activation Discovery
* **Action**: Enable `KT_LOCAL_STOREFRONT_VALIDATION=true`. Navigate to `http://localhost:3000/shop`.
* **Expected Result**: Marketplace home page renders published store categories, featured collections, and store listings.

### Test Case 2.3: Category Navigation & Search Filtering
* **Action**: Click a category rail item (e.g. "Groceries"); apply price filter `$env:minPrice=10` & `$env:maxPrice=50`.
* **Expected Result**: URL updates to `/shop/categories/groceries?minPrice=10&maxPrice=50`. Results filter accordingly. Page metadata includes `noindex` due to active search filter parameters.

### Test Case 2.4: Product Detail Page & Variant Switcher
* **Action**: Navigate to `/shop/products/sample-product`. Select different variants (e.g. "500g" vs "1kg").
* **Expected Result**: Product image, price, and offer reference update dynamically without full page reload.

---

## 3. Cart & Claims

### Test Case 3.1: Anonymous Guest Cart Creation & Line Addition
* **Action**: Open incognito browser tab. Navigate to a product page and click "Add to Cart".
* **Expected Result**: Cart drawer opens showing item added. HttpOnly cookie `kt_marketplace_cart` is set containing a random secret.
* **Network / API**: `POST /api/cart/line` returns cart state with hashed guest owner token.

### Test Case 3.2: Quantity & Modifier Updates
* **Action**: In cart drawer, increase item quantity to 3; modify item options.
* **Expected Result**: Total price updates instantly based on server-calculated unit prices.
* **Network / API**: `PATCH /api/cart/line/[lineReference]` returns updated cart DTO.

### Test Case 3.3: Login & Cart Claim
* **Action**: With items in guest cart, click "Log In" and sign in as customer.
* **Expected Result**: Guest cart items are claimed and merged into customer cart without dropping lines. Guest cookie `kt_marketplace_cart` is deleted.
* **Network / API**: `POST /api/cart/claim` returns merged cart DTO; receipt is recorded with `MERGE` or `CLAIM`.

### Test Case 3.4: Unavailable Line Conflict Handling
* **Action**: In an admin tab, unpublish a product currently in a customer's cart. In customer tab, refresh cart or attempt claim.
* **Expected Result**: System displays structured warning conflict ("Item no longer available") and marks line unavailable without crashing cart.

---

## 4. Checkout & Payment Preparation

### Test Case 4.1: Delivery Address & Quote Calculation
* **Action**: In cart drawer, proceed to checkout. Enter delivery address within service area.
* **Expected Result**: Delivery fee options (Courier / Direct Delivery) and estimated transit times are calculated.

### Test Case 4.2: Checkout Review & Acknowledgements
* **Action**: Review order items, subtotal, delivery fee, and tax total. Check required policy acknowledgement.
* **Expected Result**: Checkout review summary freezes prices and creates a review snapshot.

### Test Case 4.3: Payment Session Creation
* **Action**: Click "Proceed to PayFast Payment".
* **Expected Result**: System creates inventory/promotion reservations and redirects to PayFast payment portal (or mock local PayFast gateway page).

### Test Case 4.4: Browser Return Cannot Finalize Paid Order
* **Action**: Click "Back to Merchant" or press browser back button from PayFast return URL without ITN callback execution.
* **Expected Result**: Page displays "Payment Pending Confirmation". Order is NOT marked finalized until authoritative server ITN callback executes.
