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

Current Railway pre-deploy executes demo initialization scripts. Before final cutover, production must stop running:

- scripts/seed-production-demo-universe.ts
- scripts/sync-production-demo-auth.ts
- scripts/seed-production-showcase-catalog.ts
- scripts/sync-production-showcase-media.ts

Do not remove them before staging migration verification and rollback preparation are complete.

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
