# KT Couriers Phase 3 QA / Testing Foundation

Phase 3 adds the local database preflight path, Vitest unit/service tests, a migration safety guardrail, and CI quality checks. It does not add product features.

## Local PostgreSQL

The project reads PostgreSQL configuration from `DATABASE_URL`. Use the preflight command before running migrations or seed:

```bash
npm run db:preflight
```

The preflight script:

- Reads `.env` and `DATABASE_URL`.
- Prints host, port, database name, and redacted credential status.
- Reports whether the host is local.
- Tests TCP connectivity.
- Never prints the full database URL or password.

If `DATABASE_URL` points to `localhost`, `127.0.0.1`, or `::1`, local Docker PostgreSQL can be started with:

```bash
npm run db:start
npm run db:preflight
```

`scripts/start-local-postgres.mjs` runs Docker doctor, attempts supported Docker Desktop startup on Windows, starts the canonical Compose `db` service, waits for the PostgreSQL healthcheck, and ensures the local shadow database. It does not print database passwords.

Canonical Compose files are `compose.yml` and `compose.dev.yml`. `docker-compose.dev.yml` is retained as a compatibility wrapper.

## Migration Verification

When the local database is reachable and confirmed as disposable development data, use this order:

```bash
npx prisma validate
npx prisma format
npx prisma generate
npx prisma db pull --print
npx prisma migrate status
npx prisma migrate dev --skip-seed
npx prisma migrate status
npx prisma db seed
```

Do not run `npx prisma migrate reset`, `npx prisma db push --force-reset`, `DROP`, `TRUNCATE`, or manual destructive SQL unless the user explicitly confirms a disposable database.

## Migration Safety Check

Run:

```bash
npm run migrations:check
```

`scripts/check-migrations-safety.mjs` scans `prisma/migrations/**/migration.sql` and fails on dangerous tokens such as `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, `DELETE FROM`, and `ALTER TABLE ... DROP`. This is a lightweight guardrail, not a replacement for review.

## Test Framework

Vitest is the Phase 3 test framework.

- Config: `vitest.config.ts`
- Setup: `tests/setup.ts`
- Test command: `npm test`
- Watch mode: `npm run test:watch`
- Coverage: `npm run test:coverage`

The current tests are unit and service-level tests with Prisma, cookies, and service dependencies mocked. They do not require a live database.

## Covered Areas

- Request origin validation and generic origin failure response.
- Request metadata extraction from forwarded IP and user-agent headers.
- Permission registry integrity and default ADMIN grant safety.
- Permission evaluation, including `SUPER_ADMIN`, legacy ADMIN fallback, grants, user overrides, DENY precedence, unknown permissions, and effective permissions.
- Session query safety for revoked/expired sessions.
- Current-user handling for missing, invalid, non-active, and active sessions.
- Admin employee service protections.
- Admin permission service protections and audit logging attempts.
- Migration safety scanning.
- Phase 4 database foundation schema guardrails, including required model/enums, Decimal money fields, ZAR defaults, seed registry coverage, and migration safety fixtures.

## Intentionally Not Covered Yet

- Full browser E2E tests.
- Browser-based login and logout flows.
- Visual regression testing.
- Accessibility testing.
- Payment and webhook tests.
- Wallet ledger integration tests.
- Marketplace checkout tests.
- Performance and load testing.

These belong to later product or production-readiness phases.

## CI

`.github/workflows/ci.yml` runs on `push` and `pull_request`.

CI steps:

```bash
npm ci
npx prisma generate
npm run lint
npm run typecheck
npm test
npm run migrations:check
npm run build
npm run docker:doctor
npm run docker:config
npm run docker:build
```

CI uses safe dummy values for database and application settings. Full migration smoke is not enforced in CI until the missing migration baseline is resolved.
