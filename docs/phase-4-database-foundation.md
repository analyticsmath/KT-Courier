# KT Couriers Phase 4 Database Foundation

Phase 4 expands the Prisma/PostgreSQL foundation for future product domains. It adds schema representation, indexes, constraints, static seed records, and DB-free guardrail tests only.

## Added Foundations

- Payments: payments, attempts, provider webhook events, refunds, provider/purpose/status enums, and idempotency fields.
- Wallets and ledger: wallet owner records, balance snapshots, immutable wallet transaction records, and withdrawal requests.
- Commissions: commission rules and commission transaction records with polymorphic owner references.
- Subscriptions: subscription plans, store subscriptions, and subscription invoices.
- Marketplace catalog: categories, products, images, inventory items, inventory movements, carts, cart items, and order items.
- Promotions and advertising: promotions, coupons, redemptions, ad placements, and ad campaigns.
- Referrals and promoters: promoter profiles, referral codes, and referral events.
- Public API and webhooks: API clients, API keys, request logs, webhook endpoints, and webhook deliveries.
- Recruitment: vacancies, applications, application documents, and application status history.
- Notifications: generic notification records for email, SMS, WhatsApp, push, and in-app tracking.
- Reporting and exports: report job records and export format/status enums.

## Not Implemented

Phase 4 does not implement payment provider integrations, wallet credit/debit services, withdrawal review workflows, commission calculations, subscription billing, product CRUD APIs, marketplace browsing, cart or checkout APIs, referral payouts, promoter dashboards, public API authentication, webhook delivery runtime, recruitment workflows, dashboards, export generation, or frontend redesign.

## Money And Currency Rules

Money fields use Prisma `Decimal` with PostgreSQL precision:

- Standard money amounts use `Decimal @db.Decimal(12, 2)`.
- Percentage/rate-style commission values use `Decimal @db.Decimal(12, 4)`.
- Foundation currency fields use `String @default("ZAR")`.

No Phase 4 money field uses `Float`.

## Wallet Ledger Design

Wallets include available, pending, and locked balance fields for future read performance, but balance mutation must be represented by wallet transactions. Runtime mutation logic is intentionally deferred. `Wallet.ownerType` and `Wallet.ownerId` are polymorphic by design:

- customer, driver, and promoter owners normally reference `User.id`;
- store owners normally reference `Store.id`;
- the platform owner uses a stable system identifier such as `platform`.

Prisma does not enforce those polymorphic owner references in Phase 4.

## Payment Foundation

Payment tables can represent provider, purpose, status, attempts, webhook payloads, refund records, provider references, checkout URLs, and idempotency keys. The payment webhook unique constraint on `(provider, providerEventId)` follows PostgreSQL behavior: multiple rows with a nullable `providerEventId` can exist because `NULL` values are not considered equal.

No PayFast, Ozow, Yoco, Peach, Stripe, or manual payment runtime integration was added.

## Marketplace And Related Foundations

The catalog foundation can represent products, categories, images, inventory state, inventory movements, carts, order line snapshots, promotions, coupons, advertising placements, and campaigns. These records are intentionally schema-only; browsing, checkout, inventory reservation, campaign purchase, and coupon application behavior belongs to later phases.

## Static Seed Records

The seed script upserts:

- subscription plans: `STARTER`, `GROWTH`, `FEATURED`, `PREMIUM`;
- ad placements: `HOMEPAGE_BANNER`, `FEATURED_STORE`, `FEATURED_PRODUCT`, `SEARCH_PLACEMENT`, `CATEGORY_PLACEMENT`;
- a platform wallet with owner type `PLATFORM`, owner id `platform`, and currency `ZAR`.

The seed script does not create fake payments, fake withdrawals, fake marketplace products, or user wallets for real users.

## Safe Migration Workflow

Use the Phase 3 database tooling before applying migrations:

```bash
npm run db:preflight
npm run db:start
npm run db:preflight
```

If PostgreSQL is reachable and confirmed to be a safe local development database:

```bash
npx prisma db pull --print
npx prisma migrate status
npx prisma migrate dev --skip-seed
npx prisma migrate status
npx prisma db seed
```

If PostgreSQL is not reachable, generate the migration artifact from Prisma datamodel diff only:

```bash
npx prisma migrate diff --from-schema-datamodel .tmp-prisma-schema-before-phase4.prisma --to-schema-datamodel prisma/schema.prisma --script
npm run migrations:check
```

Never run `npx prisma migrate reset`, `npx prisma db push --force-reset`, `DROP DATABASE`, `DROP SCHEMA`, `TRUNCATE`, `DELETE FROM`, or destructive `ALTER TABLE ... DROP` commands without explicit disposable-database confirmation.

## Local DB Caveat

During Phase 4 implementation, the incremental migration history could not bootstrap an empty database because its first committed SQL assumed pre-existing tables. The infrastructure stabilization gate corrected this before production by generating a single active initial baseline from the complete current schema and preserving the former SQL in a checksummed archive. Docker smoke now proves migration deployment, two idempotent seed runs, application readiness, and schema equality from an empty database.

This does not add Phase 4 runtime behavior. It only makes the existing schema foundation safely deployable from empty PostgreSQL.

## Next Dependencies

- Phase 5 will harden the order state machine.
- Phase 6 will harden the pricing engine.
- Phase 9 and later phases will implement wallet, payment, marketplace, subscription, referral, webhook, recruitment, and reporting behavior on top of this database foundation.
