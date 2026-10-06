# KT Couriers — Legacy 6amMart Data Migration Plan

## Purpose

Migrate business data from the legacy 6amMart/Laravel/MariaDB application hosted in cPanel into the current KT Couriers Next.js/Prisma/PostgreSQL production architecture.

This plan deliberately does **not** copy the legacy database structure. It migrates approved business data into the current canonical Prisma models.

## Source authority

Primary legacy business database:

- MariaDB database: `wwwktcouriers_ktcouaielidb`
- Application family: 6amMart / Laravel
- Tables: 132
- Approximate rows: 39,402
- Legacy media root: `/home/wwwktcouriers/about.ktcouriers.com/storage/app/public/`

Secondary legacy database:

- MariaDB database: `wwwktcouriers_aielktcdb`
- Newer 6amMart schema, but largely default/demo state
- Use for schema comparison only; do not use as the business-data source

## Confirmed source population

Primary legacy source contains approximately:

- 29 vendors
- 29 stores
- 535 items/products
- 424 categories
- 34 brands
- 90 customers/users
- 43 customer addresses
- 54 delivery personnel
- 761 historical orders
- 711 order transactions
- 632 account transactions

Order mix:

- 740 parcel/courier orders
- 17 marketplace-delivery orders
- 4 takeaway orders
- 712 delivered
- 49 cancelled

This is a populated predecessor production system, not an empty installer database.

## Migration principles

1. Source is read-only.
2. Legacy IDs are preserved through deterministic mapping metadata, not by reusing legacy PKs as current Prisma IDs.
3. Authentication artifacts are never migrated as active authority.
4. Financial history is not posted into the current ledger without a dedicated accounting reconciliation migration.
5. Media is migrated only when referenced by accepted business entities.
6. Importers are idempotent and rerunnable.
7. Publication is stricter than preservation: a legacy record can be preserved without being exposed publicly.
8. Every migrated entity must be traceable to source table + source ID.
9. Cutover occurs only after demo bootstrap is disabled and current live signups are reconciled into the clean target.
10. Production source and current production DB remain available for rollback until acceptance is complete.

## Migration phases

### Phase A — Business catalogue cutover

Priority because it replaces the synthetic storefront with real vendor/product data.

Source:

- vendors
- stores
- store_schedule
- categories
- brands
- items
- storages
- filesystem media

Target:

- User(role=STORE)
- StoreProfile
- Store
- CatalogCategory
- CatalogBrand
- CatalogProduct
- CatalogProductVariant
- StoreCatalogOffer
- StoreOfferPriceVersion
- InventoryLocation
- CatalogInventoryItem
- CatalogInventoryLevel
- CatalogMediaAsset
- CatalogProductMedia
- storefront publication/search documents

Publication rules:

- preserve legitimate existing businesses
- auto-publish only businesses/products that pass source status, integrity, media, and ownership checks
- retain inactive/unapproved records as pending/inactive rather than silently deleting them
- orphan products whose source store no longer exists must not be published automatically

### Phase B — Customer and driver identities

Source:

- users
- customer_addresses
- delivery_men
- d_m_vehicles

Target:

- User
- CustomerProfile
- Address
- DriverProfile
- vehicle/compliance models where compatible

Rules:

- do not import legacy passwords as trusted active credentials
- do not import sessions, OAuth tokens, reset tokens, remember tokens, or OTPs
- migrated identities activate through current KT authentication/verification policy
- legacy driver compliance evidence is preserved only where appropriate and does not automatically establish current compliance

### Phase C — Historical courier/order data

Source:

- orders
- order_references
- order_details
- order_delivery_histories
- delivery_histories
- order_transactions
- parcel_categories
- parcel_delivery_instructions

Target:

- historical Order
- Address snapshots
- status history / operational evidence
- OrderItem for the small set of marketplace orders with line items
- driver linkage where source driver remains identifiable

Rules:

- nullable customer linkage is allowed for guest/deleted legacy users
- preserve source timestamps and status evidence
- do not regenerate operational events that claim to have happened in the new system
- imported historical orders must be distinguishable as legacy-origin records

### Phase D — Historical finance (separate project gate)

Source:

- account_transactions
- order_transactions
- store_wallets
- delivery_man_wallets
- wallet_payments
- withdrawal_requests
- disbursements

Do not map directly into current LedgerJournal / double-entry accounting authority without a separate reconciliation specification.

Initial treatment: archived legacy financial evidence.

## Legacy authentication/config tables excluded from migration

Do not migrate active authority from:

- oauth_access_tokens
- oauth_auth_codes
- oauth_clients
- oauth_refresh_tokens
- password_resets
- email_verifications
- phone_verifications
- remember tokens
- auth_token / firebase token fields
- cache
- cache_locks
- failed_jobs
- soft_credentials
- business_settings secrets
- external_configurations secrets

## Exact source-to-target baseline

### Vendor / store

`vendors`
- id
- f_name / l_name
- email
- phone
- status
- created_at / updated_at

plus `stores`
- id
- vendor_id
- name
- email
- phone
- address
- latitude / longitude
- status / active
- logo / cover_photo
- slug
- created_at / updated_at

becomes:

- User(role=STORE)
- StoreProfile
- Store
- default pickup Address where source location is valid

No source password is trusted.

### Item / product

`items`
- id
- name
- description
- category_id / category_ids
- price
- tax / tax_type
- discount / discount_type
- store_id
- stock
- unit_id
- image / images
- status
- is_approved
- slug
- created_at / updated_at

becomes:

- CatalogProduct
- CatalogProductVariant
- StoreCatalogOffer
- StoreOfferPriceVersion
- InventoryLocation
- CatalogInventoryItem / CatalogInventoryLevel
- CatalogMediaAsset / CatalogProductMedia

Product publication requires an existing migrated store and accepted source state.

### Customer

`users`
- id
- f_name / l_name
- email
- phone
- status
- created_at / updated_at

plus `customer_addresses`

becomes:

- User(role=CUSTOMER)
- CustomerProfile
- Address

Do not trust legacy password/auth/session fields.

### Courier order

`orders` parcel records contain:
- source user/store/driver references
- order amount
- payment status/method
- order status
- source timestamps
- delivery address snapshot
- receiver details snapshot
- parcel category
- distance
- delivery charge
- cancellation metadata
- guest flag

These become historical Order records with source snapshots and provenance.

## Media

Confirmed filesystem root:

`/home/wwwktcouriers/about.ktcouriers.com/storage/app/public/`

Confirmed example product file:

`product/2025-04-14-67fd05b502040.png`

The full media archive is preserved outside Git. Migration must consume selected files referenced by accepted source rows.

Likely public media families include:

- product
- store
- category
- brand
- parcel-category / parcel_category
- delivery-man / delivery_man where explicitly approved for migration

Do not import private identity/compliance files into public catalogue storage.

## Provenance

Every imported entity should have deterministic provenance, for example:

- sourceSystem: LEGACY_6AMMART
- sourceDatabase: wwwktcouriers_ktcouaielidb
- sourceTable: items
- sourceId: 417

Importer reruns must resolve the same target entity rather than create duplicates.

Implementation may use:
- dedicated migration-map table, or
- deterministic external references plus an import audit table

The migration authority must not depend on mutable names/emails alone.

## Duplicate resolution

Before final cutover, reconcile current live KT Postgres identities against legacy source using normalized:

1. email
2. South African phone number
3. vendor/store ownership links
4. deterministic legacy source IDs
5. product/store fingerprint where no stable external key exists

Current post-OTP-launch accounts must never be lost during clean-database cutover.

## Production demo bootstrap removal

The user explicitly approved demo catalogue cleanup on 6 October 2026. Railway pre-deploy and the checked-in configuration now omit:

- scripts/seed-production-demo-universe.ts
- scripts/sync-production-demo-auth.ts
- scripts/seed-production-showcase-catalog.ts
- scripts/sync-production-showcase-media.ts

The demo seed flags are disabled. The 180 seeded products and their media were removed under an exact identity allowlist after a rolled-back database rehearsal. This approved cleanup precedes the still-blocked legacy staging rehearsal; it does not establish cutover readiness.

## Clean-target cutover

Preferred production strategy:

1. freeze legacy source writes if still possible
2. snapshot current Railway production DB
3. create clean PostgreSQL target using current Prisma migrations
4. initialize only legitimate foundation/system configuration
5. import accepted legacy data
6. reconcile genuine current KT accounts created since OTP launch
7. rebuild catalogue publication/search projections
8. run schema/catalog/storefront invariants
9. disable demo bootstrap
10. switch production DATABASE_URL
11. deploy
12. verify health, readiness, signup, OTP, login, storefront, product pages, search, order creation
13. preserve old Railway DB and legacy cPanel DB for rollback
14. accept migration only after source-target reconciliation passes

## Acceptance gates

Minimum catalogue gates:

- all accepted source stores mapped exactly once
- no published offer references a missing store/product/variant
- no orphan media references
- active offer prices exist and are ZAR
- no invalid inventory relationships
- public storefront documents rebuilt
- search results match publication authority
- media URLs resolve
- test/demo businesses remain excluded or pending
- zero legacy secrets copied into current auth/config authority

Minimum identity gates:

- unique normalized email/phone conflicts explicitly reconciled
- no legacy password/session/OAuth authority activated
- migrated accounts pass current OTP/password policy

Minimum historical-order gates:

- source order counts reconcile by included status/type
- source timestamps preserved
- guest/deleted identities do not create fabricated active users
- legacy financial values are evidence only unless separately reconciled

## Rollback rule

Do not destructively overwrite either source. The source MariaDB dump, source media archive, and pre-cutover Railway PostgreSQL snapshot must remain available until client acceptance and post-cutover reconciliation are complete.

## Verified continuation — 6 October 2026

The regenerated sanitized source package matches the committed encrypted package's plaintext fingerprint (`ea46982342584e05fe48766c55c95841547d3a09ee708409e327f3538675cba0`). The planner reproduces 14 source-enabled stores, 277 initial publication candidates, 117 source-pending items, and 141 orphan items. One pending item belongs to the excluded Test Store: preservation in source evidence does not mean admission into the target catalogue.

Fresh full decoding of recovered media confirms 693 readable images, nine zero-byte files, and three absent filenames. The reviewed 341-asset admission set contains 277 primary product images, 14 store logos, 14 store covers, 30 category images, and six brand images. The reproducible Sharp normalizer keeps this admission set and source composition, removes metadata, and creates new content-addressed WebP objects. Its generated manifest replaces the old byte checksums for this normalization run; use the generated manifest and media package together. Do not mix old and new manifests or treat the new normalized bytes as the old object identities.

The importer now shares product taxonomy with the planner, rejects unclassified targets and production signals without cutover approval, checks exact ownership of nonempty targets, rejects unreconciled email/phone collisions, and preserves existing identity activation and inventory reservations. Core catalogue writes commit in one database transaction; per-asset database evidence and linkage commit together. A disabled, passwordless audit actor replaces the dependency on demo bootstrap accounts/settings/prices/ledger initialization. A completed publication run makes a later core import a no-op. Media synchronization verifies canonical bytes on reruns and publication requires an explicit source fingerprint and zero unresolved candidate blockers.

### Isolated staging rehearsal

A private Railway project named `KT Legacy Migration Staging` was created with environment `migration-staging`. Railway rejected PostgreSQL/service provisioning with `Free plan resource provision limit exceeded`, and object storage provisioning with a bucket-limit error. The project is empty, and a provisioning retry after demo cleanup still failed. The legacy PostgreSQL rehearsal and production cutover have not run.

Cloudinary now contains all 341 admitted legacy assets: 303 previous uploads were preserved and 38 missing assets uploaded. Every versioned URL passed HTTP retrieval, exact byte-size checking, SHA-256 recording, and full Sharp decoding. The previous Cloudinary uploads differ from the old normalization checksums, so use the separately saved Cloudinary verified manifest for those objects.

Production cleanup removed 180 seeded products, 180 variants, 296 offers, 257 publication snapshots/documents, and their dependent catalogue evidence under transactional locks. Account, store, order, checkout, payment, ledger, and driver records retained identical row fingerprints. All 540 detached seeded product images were verified against their original checksums, deleted from S3, and confirmed absent; 42 matching Cloudinary mirrors were also removed. Their 540 database declarations were deleted after object cleanup. The 2,142 byte-identical bundled copies were removed from both branches, reducing future build inputs by 152,589,812 bytes. Four catalogue maintenance guards were restored before commit; the diagnostic service source was restored and temporary credential references cleared.

After staging capacity is available, provision a dedicated database named `kt_legacy_staging`, apply the existing Prisma migration chain with `prisma migrate deploy`, and configure staging S3 catalogue storage. Do not use the production database URL. Set `KT_DATABASE_CLASSIFICATION=staging`.

Use the sanitized `source-package.json`, normalized media manifest, and media directory generated from the recovered sources. The checked-in encrypted source can be opened with its existing authorized key via `KT_LEGACY_SOURCE_KEY` and `source-envelope.mjs decrypt`; this key is never committed. Rebuilding the sanitized package from the preserved SQL/media extraction evidence reproduces the same source bytes without requiring that key.

```bash
node --import tsx scripts/legacy-6ammart/rehearse-staging.ts \
  --source /secure/source-package.json \
  --manifest /secure/KT_LEGACY_VERIFIED_MEDIA_MANIFEST.json \
  --media-dir /secure/media \
  --out /secure/staging-rehearsal-result.json
```

This command requires a fresh migrated staging database. It exercises a persisted identity collision, core import twice, media synchronization twice, publication twice, and a core rerun after publication. It verifies stable target IDs, stable snapshot counts, expected publication/media counts, and absence of imported passwords. It exits with failure if a stage fails. It has been type-checked; real PostgreSQL execution remains blocked by provisioning capacity. Existing `db:verify:catalog` and `db:verify:storefront` checks and Cloudinary/S3 delivery checks remain mandatory after this rehearsal passes and before cutover.

### Approved in-place production import (2026-10-06)

The user explicitly selected **KT Courier Production** for implementation. No additional Railway project or database is required. Use `--preserve-target` with a reviewed manifest bound to the production project, environment, and source fingerprint. Its exact retained Store/Product/Media IDs remain separate from importer-owned IDs; missing identities, unreviewed additions, namespace collisions, and identity collisions fail closed. The core transaction compares complete row hashes for pre-existing users, stores, media, product types, and business/financial records before commit. Existing product type definitions are reused without modification.

Run the same core command with `--rehearse` first: audit actor, migration evidence, and catalogue writes are all inside the transaction and deliberately rolled back. Then run `--apply` against the same production target. This is an additive catalogue import, with no database reset or DATABASE_URL switch. Existing accounts and history remain present.

Use `sync-catalog-media.ts --cloudinary-existing --manifest <verified-cloudinary-manifest> --apply`. This mode requires the separately verified Cloudinary manifest and checks the origin host, account, versioned URL, public ID, storage key, exact bytes/hash, dimensions, full decoding, and delivery round-trip. It creates media declarations and associations without uploading another copy to S3. Set `CATALOG_MEDIA_DELIVERY=cloudinary`, `CLOUDINARY_CLOUD_NAME=q8gbzml2`, and `CLOUDINARY_CATALOG_PREFIX=kt-courier/catalog` on the web service. Existing upload storage configuration is retained.

Publication remains source-qualified: only admitted active legacy products with verified media and eligible ZAR prices publish. Pending records and excluded orphan/Test Store evidence retain their planned disposition. Temporary migration source payloads and runner configuration must be removed after production verification.

The production rollback rehearsal revealed readiness constraints absent from earlier database-free checks. Core products/offers remain DRAFT until verified-media publication; positive initial stock receives append-only movement evidence, and deferred constraints are forced before rollback/commit. Existing source item 448 (`SIDE TABLE`, variant `METAL`) has a zero variant price despite a positive base price. It is retained with `LEGACY_PRICE_REVIEW_REQUIRED`, without fabricating a price; the publication count is 276, with 117 imported drafts out of 393 admitted products. The historical 277-candidate plan remains source evidence, not an assertion that every price was valid.

The forward migration `20261006012000_cloudinary_legacy_catalog_media` preserves the canonical hash-key rule and adds exact purpose-specific legacy Cloudinary key patterns for WebP declarations with `LEG6-MEDIA` references. All ownership, validated READY evidence, declaration/checksum immutability, and media-association guards remain enabled. Upload-intent constraints are unchanged.
