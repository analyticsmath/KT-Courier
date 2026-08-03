# Prisma Migration Troubleshooting

## Current Setup

KT Couriers uses Prisma `5.22.0` and PostgreSQL. Host tools connect to `localhost:5433`; Compose services connect to `db:5432`. Real connection strings are never committed.

The active migration directory contains exactly one migration:

```text
prisma/migrations/20260710010000_initial_baseline/migration.sql
```

The former incremental migration folders are preserved in `prisma/migrations-legacy-prebaseline/`. They are audit material, not a Prisma deployment path.

## Safe Workflow

For the canonical local Docker database:

```bash
npm run docker:db
npm run docker:migrate
npm run docker:seed
npx prisma migrate status
npm run db:verify-schema
```

For a fully disposable clean-bootstrap proof:

```bash
npm run docker:migration-smoke
npm run docker:smoke
```

Both smoke scripts use the isolated `kt-couriers-baseline-smoke` Compose project and remove only its own volume. They never target the normal development volume.

## Schema Drift

`npm run db:verify-schema` runs Prisma's supported equivalent of:

```bash
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
```

Exit code `0` means no difference. Exit code `2` means database-to-schema drift and must be investigated; do not silence it with hand-edited migration history.

## Safety Rules

Do not use any of the following against a production, shared, unknown, or retained legacy database:

```bash
npx prisma migrate reset
npx prisma db push --force-reset
npx prisma migrate resolve --applied
npx prisma migrate resolve --rolled-back
```

Do not run destructive SQL, `docker compose down -v`, or volume deletion against the canonical project. In particular, the old `kt-couriers_kt_couriers_postgres_data` volume remains preserved until an explicit future data-retention decision.

## Future Migrations

After a Prisma schema change, create a new migration after the baseline using a confirmed disposable local database, inspect the SQL, run `npm run migrations:check`, and prove it through `npm run docker:smoke` before deployment. Staging and production must run `prisma migrate deploy`; they must never start with an incremental migration that assumes an untracked base schema.
