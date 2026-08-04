# 03 — Domain Invariant Ledger

## Overview

This document details all enforced domain invariants across Store, Catalogue, Discovery, Cart, and Checkout boundaries.

## Enforced Invariants

| Invariant ID | Domain | Rule Statement | Implementation Authority | Validation Method |
| --- | --- | --- | --- | --- |
| INV-01 | Storefront Exposure | `/shop` and public API return `MarketplaceUnavailable` when exposure is denied; metadata short-circuits with `noindex` before reading projection database. | `lib/storefront/storefront-page-access.ts`, `app/(public)/shop/layout.tsx` | `BEHAVIORAL_TEST`, `DB_FREE_VALIDATION` |
| INV-02 | Store Ownership | Products, offers, and inventory belong strictly to a single store; cross-store mutation references are rejected. | `lib/catalog/catalog-product.service.ts` | `STATIC_EVIDENCE`, `BEHAVIORAL_TEST` |
| INV-03 | Variant Uniqueness | Variant references within a product must be unique; duplicate variant attributes are rejected. | `lib/catalog/catalog-variant.service.ts` | `STATIC_EVIDENCE`, `BEHAVIORAL_TEST` |
| INV-04 | Price Versioning | Every cart item and offer references an explicit immutable price version; price changes do not retroactively alter active cart items without structured revalidation. | `lib/marketplace-checkout/cart.service.ts` | `BEHAVIORAL_TEST` |
| INV-05 | Publication Integrity | Products must have an active publication snapshot to be visible in storefront search projections. | `lib/storefront/storefront-projection.service.ts` | `STATIC_EVIDENCE` |
| INV-06 | Anonymous Guest Cart Privacy | Guest cart ownership uses SHA-256 token hashing; raw secret tokens never enter database records, DTOs, or logs. | `lib/marketplace-checkout/tokens.ts` | `BEHAVIORAL_TEST`, `DB_FREE_VALIDATION` |
| INV-07 | Cart Ownership Isolation | Cart mutations require matching owner credentials (`CUSTOMER` userId or `GUEST` guestTokenHash); cross-user cart access throws `CART_ACCESS_DENIED`. | `lib/marketplace-checkout/cart-mutation.service.ts` | `BEHAVIORAL_TEST` |
| INV-08 | Cart Claim Revalidation | Guest cart claims revalidate offer, variant, modifier, and price evidence server-side; stale or unavailable lines trigger structured conflicts (`CART_LINE_INVALID`). | `lib/marketplace-checkout/cart-mutation.service.ts` | `BEHAVIORAL_TEST` |
| INV-09 | Transaction-Wrapped Merge | Merging a guest cart into a customer cart executes atomically within a single database transaction; operation receipts record true `MERGE` mutation type. | `lib/marketplace-checkout/cart-mutation.service.ts` | `BEHAVIORAL_TEST` |
| INV-10 | Cart Optimistic Concurrency | Cart updates enforce version matching (`expectedVersion`); version mismatches throw `CART_VERSION_CONFLICT`. | `lib/marketplace-checkout/cart-mutation.service.ts` | `BEHAVIORAL_TEST` |
| INV-11 | Idempotent Operation Receipts | Idempotent operations store request hashes and operation receipts; replayed requests return deterministic evidence with `replayed: true`. | `lib/marketplace-checkout/cart-mutation.service.ts` | `BEHAVIORAL_TEST` |
| INV-12 | Store Order Immutability | Finalized store orders create frozen line items and settlement snapshots; lines cannot be mutated after creation. | `lib/store-orders/store-order.service.ts` | `STATIC_EVIDENCE`, `DECLARED_POLICY` |
