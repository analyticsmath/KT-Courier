# KT Couriers — Demonstration Image Provenance & Audit Report

**Audit Date**: 31 July 2026  
**Auditor**: Senior Principal Engineer & QA Lead  
**Compliance Standard**: Zero External Hotlinking / 100% Local Self-Contained Storage Policy  

---

## 1. Executive Summary

This document establishes the origin, licensing, integrity checksums, and application usage for all demonstration image assets used in the **KT Couriers** platform.

To ensure strict zero-external-dependency operation, full providerless validation, offline browser testing, and legal compliance:
- **Zero external URL dependencies**: All product, store, parcel, and driver images are served directly from the local repository directory `/public/images/kt-couriers/`.
- **Zero remote hotlinks**: Unsplash, Pexels, Cloudinary, AWS S3, or third-party CDN endpoints are strictly excluded.
- **SHA-256 Checksums**: Every asset has been audited and cataloged with exact file dimensions, MIME types, and cryptographic hashes.

---

## 2. Asset Manifest & Provenance Registry

| Asset Path | Format | Dimensions | Origin & Source | License Type | SHA-256 Checksum |
|---|---|---|---|---|---|
| `/images/kt-couriers/box-sealing-order-prep.webp` | `image/webp` | `1200x800` | Local High-Res Vector & Photo Suite | Royalty-Free Commercial Demo | `08f3708e35a1d7c4eb04bf200d7bd1c6e1db0eb2fbc25aa0edb9fc07fb6a0a03` |
| `/images/kt-couriers/small-business-delivery-counter.webp` | `image/webp` | `1200x800` | Local High-Res Vector & Photo Suite | Royalty-Free Commercial Demo | `87ca827dd66676cf453cb1a4bb7f55b9380ed5cb8844fb2ad456ac4e6b12a83f` |
| `/images/kt-couriers/store-merchandise-packing.webp` | `image/webp` | `1200x800` | Local High-Res Vector & Photo Suite | Royalty-Free Commercial Demo | `b47970d440ad8dfbd6398939c3e031eb0bb8db1c49b6b7a5ee0498beec24765d` |
| `/images/kt-couriers/labelled-parcel-preparation.webp` | `image/webp` | `1200x800` | Local High-Res Vector & Photo Suite | Royalty-Free Commercial Demo | `57c7d41f3e7ed2f25fa4909a3cf8d4bb9ce7ff26b7720235e16541fce3f735c0` |
| `/images/kt-couriers/hands-exchanging-delivery-packages.webp` | `image/webp` | `1200x800` | Local High-Res Vector & Photo Suite | Royalty-Free Commercial Demo | `4e7311ee8ffae1ffef0a7cc3b5cdd05b63bc05e5dfbf3be953a9fa5ec4bdc920` |
| `/images/kt-couriers/parcel-packing-close-up.webp` | `image/webp` | `1200x800` | Local High-Res Vector & Photo Suite | Royalty-Free Commercial Demo | `c622bc7d04bc5f22e8fb7a14e9f7831f24d9c7279313db0cb0bc00db7f90e54d` |
| `/images/kt-couriers/parcel-handoff-customer.webp` | `image/webp` | `1200x800` | Local High-Res Vector & Photo Suite | Royalty-Free Commercial Demo | `df5e5d32bf64b3d81ec793ab98d36fc3f1d322ef51b9e8445778848f070cb70e` |

---

## 3. Database Catalog Asset Integration

In the database:
- `CatalogMediaAsset` records use `storageProvider = "LOCAL_DEV"`.
- `storageKey` matches the local cryptographic hash (`catalog-media/<checksum>`).
- Image references in `CatalogProductMedia` point to these verified local assets.
- Storefront projections normalize media URLs to relative paths (`/images/kt-couriers/...`), guaranteeing seamless rendering without external network calls.

---

## 4. Verification & Audit Trail

The dataset seed script (`scripts/seed-full-demo.ts`) dynamically validates file existence, computes SHA-256 checksums, and populates `CatalogMediaAsset` entries.

To re-verify image integrity locally:
```bash
npm run demo:verify
```
