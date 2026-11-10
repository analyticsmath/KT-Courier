# KT Couriers — Phase 1 Schema & Migration Impact Report

## 1. Schema Authority & Migration Chain Summary

- **Canonical Schema File**: [`prisma/schema.prisma`](file:///d:/KT-Courier/prisma/schema.prisma)
- **Active Baseline Migration**: `20260710010000_initial_baseline`
- **Incremental Migrations**: `110` (`20260710090000_phase1_1_foundation_invariants` through `20261108000000_store_checkout_certification`)
- **Total Active Migrations Applied on Clean PostgreSQL**: `111`
- **Archived Pre-Baseline Migrations**: `8` (verified via `npm run migrations:check`)
- **Phase 1 Schema Verdict**: **Zero new destructive or ad-hoc migrations required.** All Phase 1 domain models (`PricingQuote`, `Order`, `Payment`, `PaymentAttempt`, `PaymentWebhookEvent`, `LedgerJournal`, `LedgerEntry`, `MarketplaceCart`, `MarketplaceCartStoreGroup`, `MarketplaceCartLine`, `MarketplaceCheckout`, `MarketplaceOrder`, `MarketplaceStoreOrder`, `StoreSellerLegalIdentity`, `StoreOrderOperationalPolicy`, `StoreCheckoutCertification`, `SystemSetting`, `NotificationEventIntent`, `NotificationDelivery`) are already present in [`prisma/schema.prisma`](file:///d:/KT-Courier/prisma/schema.prisma) and verified against the 111-migration chain.

## 2. Phase 1 Domain Table & Constraint Inventory

| Domain Area | Prisma Models / PostgreSQL Tables | Key Invariants & Constraints Enforced |
|---|---|---|
| **Parcel Quotes & Orders** | `DeliveryServiceDefinition`, `ParcelProfileVersion`, `PricingQuote`, `PricingQuoteLineItem`, `Order`, `OrderStatusHistory`, `Address` | Versioned tariff & parcel profile snapshots (`ruleSnapshot`, `taxSnapshot`, `regionSnapshot`); `Order.orderNumber` unique; immutable historical quote/order pricing. |
| **Marketplace Cart & Checkout** | `MarketplaceCart`, `MarketplaceCartStoreGroup`, `MarketplaceCartLine`, `MarketplaceCartLineModifier`, `MarketplaceCartOperation`, `MarketplaceCheckout`, `MarketplaceOrder`, `MarketplaceStoreOrder` | `MarketplaceCartLine` links to both `MarketplaceCartStoreGroup` (`storeGroupId`) and `MarketplaceCart` (`cartId`); `MarketplaceCartOperation` enforces `(cartId, operationId)` idempotency under `Serializable` isolation. |
| **Store Governance & Live Readiness** | `Store`, `StoreSellerLegalIdentity`, `StoreOrderOperationalPolicy`, `StoreCheckoutCertification`, `PrivateMediaObject` | Maker-checker separation (`approvedByUserId <> preparedByUserId` / `ownerUserId`); `StoreCheckoutCertification` binds `pickupAddressId`, `pickupFingerprint`, `routeEvidenceDigest`, and `checkoutEvidenceDigest`. |
| **Payments & Double-Entry Ledger** | `Payment`, `PaymentAttempt`, `PaymentStatusHistory`, `PaymentWebhookEvent`, `PaymentMethodPolicy`, `LedgerAccount`, `LedgerJournal`, `LedgerEntry`, `FinancialIdempotencyRecord` | Unique `providerEventId` on `PaymentWebhookEvent`; unique `idempotencyKey` on `Payment`, `PaymentAttempt`, and `LedgerJournal`; balanced journal postings (`sum(DEBIT) === sum(CREDIT)` in ZAR cents). |
| **Commercial Settings & Notifications** | `SystemSetting`, `AdminActivityLog`, `NotificationEventIntent`, `NotificationSourceReceipt`, `NotificationMessage`, `NotificationDelivery` | `SystemSetting` stores `pricing.vat.enabled`, `pricing.marketplace_vat.enabled`, `delivery.high_risk_areas`, and `notifications.admin_alert_recipients` with `Serializable` row locking and SHA-256 `AdminActivityLog` audit digests. |

## 3. Clean-Database Migration & Drift Verification Evidence

Executed via `npm run migrations:check` and `npm run docker:migration-smoke` (including while host port `0.0.0.0:55832` was actively occupied):

1. `npm run migrations:check`:
   - `Active baseline: 20260710010000_initial_baseline; incremental migrations: 110; archived migrations: 8` — **PASS** (`exit 0`).
2. `npx prisma validate`:
   - `The schema at prisma\schema.prisma is valid` — **PASS** (`exit 0`).
3. `npm run docker:migration-smoke`:
   - Disposable project `kt-couriers-baseline-smoke` started with [`compose.migration-smoke.yml`](file:///d:/KT-Courier/compose.migration-smoke.yml) (`ports: !override []`).
   - `npx prisma migrate deploy` applied all 111 migrations from an empty PostgreSQL 16 database.
   - `npx prisma migrate status` confirmed 0 pending or unfinished migrations in `_prisma_migrations`.
   - `node scripts/verify-database-schema.mjs` (`prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --exit-code`) confirmed **zero schema drift**.
   - First and second disposable smoke seeds ran back-to-back, proving **seed idempotency**.
   - Disposable volume `kt-couriers-baseline-smoke_kt_couriers_postgres_baselined_clean` removed cleanly on exit without touching developer volumes.
