# Legacy Prisma Migrations: Pre-Baseline Archive

## Why This Exists

These migration folders are preserved as an audit record of KT Couriers work completed before the project had a valid initial Prisma migration. The first legacy migration, `20260611000000_phase_2_3_address_book`, assumes base tables such as `Address` already exist, so the chain could not bootstrap an empty PostgreSQL database.

Git history did not contain a provable historical pre-first-migration schema. Rather than inventing that unknown history, the project consolidated its current Prisma datamodel into one new initial baseline before its first real deployment.

## Important Rules

- This directory is historical material only and is outside Prisma's active `prisma/migrations/` path.
- Do not pass this directory to `prisma migrate deploy` or `prisma migrate dev`.
- Do not edit archived SQL. Validate the immutable content with `node scripts/check-migrations-safety.mjs`.
- `manifest.json` records the original chronological order and SHA-256 digest of each `migration.sql` file.
