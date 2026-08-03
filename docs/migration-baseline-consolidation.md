# KT Couriers Migration Baseline Consolidation

## Decision

KT Couriers consolidated its Prisma migration history before the first real deployment. This was necessary because the first committed legacy migration, `20260611000000_phase_2_3_address_book`, expected base tables such as `Address` to exist. The repository had no earlier migration and Git did not contain a provable pre-first-migration `schema.prisma` snapshot.

The project did not attempt to reconstruct that unknowable historical schema. Available repository, Compose, CI, environment-template, and local PostgreSQL evidence showed no deployed or shared database depended on the legacy identifiers. The retained local database had no application tables or business data, only an incomplete migration record. Consolidation was therefore safe as a pre-production migration-history correction.

## Active And Archived History

Prisma deploys only this active baseline:

```text
prisma/migrations/
  migration_lock.toml
  20260710010000_initial_baseline/migration.sql
```

The previous eight timestamped folders are preserved, unchanged, in:

```text
prisma/migrations-legacy-prebaseline/
```

`manifest.json` records each original folder, original ordering, SQL filename, and SHA-256 checksum. `README.md` explains why the archive is inactive. `npm run migrations:check` validates that every archived checksum still matches and that no archived migration can return to the active Prisma path.

Never pass the archive directory to Prisma Migrate.

## Baseline Generation

The baseline was generated from empty PostgreSQL schema to the current complete Prisma datamodel, not from a retained development database or the archive:

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output prisma/migrations/20260710010000_initial_baseline/migration.sql
```

The resulting SQL creates all current enums, tables, keys, indexes, foreign keys, decimal declarations, nullability, and referential actions. It contains no seed data, credentials, database names, destructive statements, or manual `_prisma_migrations` manipulation.

## Bootstrap And Drift Proof

`npm run docker:migration-smoke` creates an empty database under the disposable `kt-couriers-baseline-smoke` project, runs `prisma migrate deploy`, confirms `prisma migrate status`, checks that only the new baseline is recorded, and compares the resulting database to `prisma/schema.prisma` with `prisma migrate diff --exit-code`.

`npm run docker:smoke` repeats that migration proof, runs the seed twice, verifies stable permission/admin-grant/subscription-plan/ad-placement/platform-wallet counts, starts the full application stack, verifies `/api/health` and `/api/ready`, and confirms the app runs as the non-root `nextjs` user. The scripts redact connection values and remove only their isolated project volume.

For the canonical local database, use:

```bash
npm run docker:db
npm run docker:migrate
npm run docker:seed
npm run docker:seed
npm run db:verify-schema
```

## Local Volume Cutover

The canonical Compose database now uses `kt_couriers_postgres_baselined_clean`. The former `kt-couriers_kt_couriers_postgres_data` volume is preserved untouched because it contains the old failed migration record. A first replacement volume, `kt-couriers_kt_couriers_postgres_baselined`, is also retained after a stale local migrator image attempted the archived chain; it is not canonical and is not removed automatically. Do not run `migrate resolve`, `migrate reset`, `db push --force-reset`, or `docker compose down -v` against either retained volume.

Stopping the normal Compose project without `-v` is safe. Manual removal of the old volume is a separate, future decision after it is no longer needed for audit or recovery.

## Deployment Rules

Future schema work must create migrations after the active baseline, review the generated SQL, pass `npm run migrations:check`, and pass the disposable Docker smoke. Staging and production run `prisma migrate deploy`; they must not use `migrate dev`, `migrate resolve` as a history shortcut, or a chain that starts with an incremental alteration.

The CI `runtime-smoke` job uses a unique `kt-couriers-ci-<run-id>` project with CI-only local credentials. It builds, bootstraps, migrates, seeds twice, checks health/readiness, migration status, schema drift, and non-root execution, then removes only that ephemeral project and its volumes.
