# Phase 18 research and implementation map

Status: implementation research complete; deep runtime validation is deferred to Phase 26.5.

This map was written before any Phase 18 Prisma edit. It records the repository state at the end of Phase 17 and the compatibility decisions that govern the catalog implementation.

## 1. Existing catalog-related models

The initial baseline contains a Phase 4 marketplace placeholder, not an operational catalog. No application service or API writes these models; only `tests/database/foundation-schema.test.ts` asserts that their names remain present.

### `ProductCategory` — legacy placeholder

- Fields: `id String @id @default(cuid())`, `parentId String?`, `name String`, `slug String @unique`, `description String?`, `imageUrl String?`, `isActive Boolean @default(true)`, `sortOrder Int @default(0)`, `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`.
- Relations: self-relation `parent`/`children` with `onDelete: SetNull`; `products Product[]`.
- Indexes: `parentId`, `isActive`, `sortOrder`. Unique constraint: global `slug`.
- Status representation: a Boolean only. There is no draft/hidden/archive lifecycle.
- Missing Phase 18 evidence: public reference, stable sibling slug, depth/path, actor IDs, optimistic version, cycle protection, archive-after-use policy, and category-to-product-type mappings.
- Writers/seeds/fixtures: no runtime writer, no seed, and no catalog fixture was found.
- Classification: non-operational placeholder. It remains for compatibility and is not a Phase 18 writer target.

### `Product` — legacy placeholder

- Fields: `id`, `storeId`, `categoryId?`, `name`, `slug`, `description?`, `sku?`, `status ProductStatus @default(DRAFT)`, `price Decimal(12,2)`, `currency @default("ZAR")`, `compareAtPrice? Decimal(12,2)`, `imagesCount @default(0)`, `metadata? Json`, timestamps.
- Relations: required `store`; optional `category`; `images`; optional one-to-one `inventory`; `cartItems`; `orderItems`; `adCampaigns`.
- Constraints/indexes: unique `(storeId, slug)`; indexes on `storeId`, `categoryId`, `status`, and `createdAt`.
- Statuses: `DRAFT`, `ACTIVE`, `OUT_OF_STOCK`, `HIDDEN`, `ARCHIVED`.
- Money precision: legacy display price is `Decimal(12,2)` and combines product identity with mutable store price. It has no effective period, immutable price version, VAT flag, activation evidence, or overlap control.
- Writers/seeds/fixtures: no `prisma.product.create/update/upsert` or product API was found. The model is referenced only by future placeholder cart/order/advertising relations and schema tests.
- Classification: structurally incompatible placeholder. Phase 18 does not activate, backfill, publish, or delete it.

### `ProductImage` — legacy placeholder

- Fields: `id`, `productId`, arbitrary `url`, optional `altText`, `sortOrder`, `createdAt`.
- Relations/indexes: cascade relation to legacy `Product`; indexes on `productId` and `sortOrder`.
- Missing controls: asset ownership, MIME/size/dimension evidence, media role, variant association, required alt text, and external-URL prohibition.
- Classification: non-operational placeholder, not reused as the Phase 18 media association.

### `InventoryItem` and `InventoryMovement` — legacy placeholders

- `InventoryItem` fields: `id`, unique `productId`, `quantityOnHand Int @default(0)`, `quantityReserved Int @default(0)`, optional `lowStockThreshold`, `trackInventory Boolean @default(true)`, `updatedAt`.
- `InventoryItem` relations/indexes: one legacy product, movement collection, `quantityOnHand` index.
- `InventoryMovement` fields: `id`, `inventoryItemId`, `type InventoryChangeType`, `quantityChange Int`, optional `reason`, `referenceType`, `referenceId`, optional `createdByUserId`, `createdAt`.
- Movement statuses/types: `INITIAL`, `ADJUSTMENT`, `SALE`, `RESTOCK`, `RETURN`, `RESERVATION`, `RELEASE`.
- Relations/indexes: cascade item relation, nullable actor relation; indexes on item, type, `(referenceType, referenceId)`, actor, and timestamp.
- Missing controls: offer/variant/location identity, idempotent operation and request hashes, projection checks, resulting balance, immutable evidence, serializable locking, and reservation boundary.
- Writers/seeds/fixtures: no runtime writers or seed records were found.
- Classification: incompatible placeholder. Phase 18 creates movement-backed `CatalogInventory*` models and does not expose reservation/sale movement types.

## 2. Existing store ownership

`Store` is the canonical business aggregate and is reused.

- Fields: `id`, nullable `ownerUserId`, `name`, unique `slug`, `status StoreStatus @default(PENDING)`, contact fields, legacy address fields, country defaulting to South Africa, `featured`, timestamps, and nullable `defaultPickupAddressId`.
- Relations: owner `User`, canonical saved/default pickup `Address` records, orders, subscriptions, legacy products/cart/order items/promotions/ads, and store earnings.
- Indexes: `ownerUserId`, `defaultPickupAddressId`, `slug`, `status`, and `featured`.
- Statuses: `PENDING`, `ACTIVE`, `SUSPENDED`, `REJECTED`, `INACTIVE`.
- Runtime ownership lookup: `lib/services/stores.service.ts#getStoreByOwner` selects the first store by `ownerUserId`; current store pages require the `STORE` role. Phase 18 additionally requires `Store.status === ACTIVE` and exact store ownership for every store catalog operation.
- Location audit: `Address` is a contact/geographic address and the store has one default pickup address. It is not an inventory branch/location aggregate, so Phase 18 may add `InventoryLocation` without duplicating `Address`.

## 3. Existing media/upload architecture

- No trusted upload service, media asset table, object-storage adapter, or catalog asset authorization service exists.
- The only catalog-like model is legacy `ProductImage.url`, which violates the Phase 18 rule against arbitrary external image URLs.
- Marketing images are repository-owned files under `public/images` and are not user uploads.
- `lib/validation/delivery.ts` explicitly reserves proof media for a future trusted media service and accepts neither URLs nor paths.
- Conversion: Phase 18 introduces catalog media-asset evidence and product/variant associations. Draft metadata may reference only an owned asset record; remote image ingestion remains unsupported.

## 4. Existing category/product placeholders and legacy compatibility

The five Phase 4 models above were created by `20260710010000_initial_baseline`. They have no runtime writers and cannot safely be reinterpreted because existing nullable/required columns collapse product, offer, price, and inventory concepts. Phase 18 therefore:

1. preserves all legacy tables, fields, relations, and earlier migration files;
2. adds a distinct `Catalog*` aggregate with explicit identity boundaries;
3. never backfills or activates legacy rows;
4. makes preflight fail closed if a legacy row is active or otherwise appears operational;
5. leaves future cart/order/advertising placeholders attached to the legacy model until their owning phases explicitly migrate compatibility references.

## 5. Existing inventory fields

The complete existing inventory surface is the legacy `InventoryItem`/`InventoryMovement` pair documented above. There is no location model, availability projection, row locking helper, operation ID, request hash, immutable trigger, direct-stock-write guard, or current catalog endpoint. Phase 18 will not create customer reservations and keeps `reserved` at zero except isolated future-compatible integration fixtures.

## 6. Existing money types

- Current repository models use Prisma `Decimal`; financial phases standardized ledger/payment evidence on PostgreSQL `Decimal(18,2)`.
- The legacy product price is `Decimal(12,2)` and is intentionally not reused.
- Phase 18 price versions and modifier deltas use `Decimal(18,2)`, exact string parsing, and currency `ZAR` only.
- Consumer-facing offer prices are explicitly VAT-inclusive. No compare-at/promotional field is added.

## 7. Existing audit models

- `AdminActivityLog`: actor, bounded action enum, entity type/ID, message, JSON metadata, timestamps; indexes by actor/action/entity/time. It is mutable at the Prisma level and is retained for cross-domain admin activity.
- `SecurityEvent`: target/actor, string type/severity, safe message, IP/user-agent, JSON metadata, `createdAt`; indexes by subject, actor, type, severity, and time.
- `PricingAuditLog`: order/rule links, calculated `Decimal(10,2)` amount, currency, breakdown, timestamps.
- Domain histories include `PaymentStatusHistory`, commission/store/driver earning histories, and immutable operational event patterns. They demonstrate append-only evidence but are aggregate-specific.
- Conversion: catalog lifecycle, moderation, price activation, inventory movement, product-type, import, and change-event evidence receive dedicated append-only models and database update/delete guards. Security denials continue to use `SecurityEvent`; admin catalog actions may also be summarized in `AdminActivityLog` without storing raw HTML or import files.

## 8. Existing import/export utilities

- No catalog CSV parser/import service exists.
- The foundation has reporting/export placeholders (`ReportJob`, `ExportFormat`) but no reusable catalog import aggregate.
- Conversion: Phase 18 provides a bounded CSV-only, UTF-8, versioned template flow with mandatory dry-run, formula-injection rejection, row errors, idempotent apply, and draft-only results. Raw files are not retained in audit metadata.

## 9. Existing outbox/event infrastructure

- There is no generic transactional outbox.
- `PaymentWebhookEvent` is inbound provider evidence, not an outbound domain event.
- Order assignment/operational events and financial histories are domain-specific and cannot be reused as a catalog outbox.
- Conversion: add narrow `CatalogChangeEvent` rows transactionally with aggregate mutations. Payloads are bounded, contain no PII, have unique aggregate-version identity, and cause no external network call in Phase 18.

## 10. Existing public-content patterns

- Public marketing pages use server components, repository-owned images, metadata APIs, semantic headings, and static content.
- There is no public catalog/search/storefront route.
- Phase 18 adds only authenticated `/store/catalog` and `/admin/catalog` management experiences plus an internal snapshot reader. It adds no public product page, search endpoint, structured-data endpoint, cart, checkout, or purchase action.

## 11. Runtime writers

Repository search found no runtime writers for legacy products, categories, images, inventory items, or inventory movements. There are no legacy product API routes. The Phase 18 service layer becomes the sole catalog writer and enforces optimistic versions, ownership, transitions, and event evidence. SQL triggers prevent mutation/deletion of immutable evidence.

## 12. Current permissions

- Permissions are centralized in `lib/auth/permission-keys.ts`, seeded idempotently through `prisma/seed.ts`, and evaluated by `lib/auth/permissions.ts`.
- Explicit per-user `DENY` wins over role grants. `SUPER_ADMIN` is system-authorized; admins use exact permission checks.
- No catalog permission currently exists.
- Conversion: add the exact Phase 18 catalog, moderation, taxonomy, product-type, pricing, inventory, and import permission keys. Default admin grants are read-biased; mutation permissions remain explicit. Store role access also requires exact ownership and active store status.

## 13. Current UI route groups

- Store routes live under `app/(store)/store`, use `DashboardShell`, and are role-gated in the store layout. Current navigation has dashboard, earnings, delivery, orders, profile, and support.
- Admin routes live under `app/(admin)/admin`, use `DashboardShell`, and are gated to admin/super-admin roles. Fine-grained permission checks occur in pages/APIs.
- Next.js 16.2.9 local documentation confirms page `params`/`searchParams` and route-handler context `params` are promises; Phase 18 dynamic pages and handlers await them.
- Conversion: add Catalog navigation entries and the required management-only routes within the existing groups. Pages use semantic tables/forms, labelled controls, non-color status text, error summaries, keyboard controls, and responsive layouts.

## 14. Phase 19–21 compatibility requirements

- Phase 19 storefront/search must read immutable publication snapshots, never mutable authoring rows or legacy products.
- Phase 20 cart/checkout must validate the snapshot/offer/price version and implement reservations in its own transaction boundary; Phase 18 never reserves stock.
- Phase 21 marketplace orders must snapshot catalog identity and commit inventory through new movement types without rewriting Phase 18 authoring history.
- Product identity, variant identity, store offer, price version, and location inventory therefore remain separate aggregates. Stable public references and aggregate versions are included now.

## 15. Implementation map

| Requirement | Existing foundation | Phase 18 conversion |
| --- | --- | --- |
| Taxonomy | Boolean legacy category tree | `CatalogCategory` with sibling slug, path/depth, lifecycle, cycle trigger |
| Product schemas | None | immutable versioned `ProductTypeDefinition` JSON schemas and category mappings |
| Product identity | store-priced legacy `Product` | canonical/store-private `CatalogProduct` |
| Variants/options | None | product variants, option definitions/values, stable fingerprints |
| Offers | None | store-owned `StoreCatalogOffer` |
| Pricing | mutable legacy price | exact immutable `StoreOfferPriceVersion` periods |
| Inventory | one legacy product projection | location-aware item/level plus immutable movements |
| Media | arbitrary URL | owned asset evidence plus role association |
| Modifiers | None | flat reusable store groups/options and offer links |
| Compliance | unstructured metadata | reviewed schema values plus fail-closed restriction policy |
| Moderation | None | cases, append-only actions/history, explicit transitions |
| Duplicates/quality | None | deterministic candidates and explainable quality issues |
| Imports | None | bounded dry-run/apply jobs and row evidence |
| Publication | legacy `ACTIVE` enum only | immutable internal snapshot and hard-coded production lock |
| Events | no generic outbox | narrow transactional `CatalogChangeEvent` |

## 16. Non-goals and validation boundary

No public storefront, public customer search, cart/checkout writer, reservation, marketplace-order writer, payment/ledger writer, earnings writer, promotion, review, wish list, or external feed is introduced. Migration execution, seed execution, Docker, build, full typecheck/tests, coverage, browser/E2E, CI, and production validation remain deferred exactly as directed.
