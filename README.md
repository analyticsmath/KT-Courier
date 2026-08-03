# KT Couriers

Next.js 16 App Router application with Prisma/PostgreSQL. Local infrastructure uses Docker Desktop, PostgreSQL 16, Prisma migrations, and a standalone Next.js production image.

## Getting Started

Install dependencies and validate the app:

```bash
npm ci
npx prisma generate
npm run lint
npm run typecheck
npm test
npm run build
```

Start the local development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Docker And PostgreSQL

Run diagnostics before blaming Compose or Prisma:

```bash
npm run docker:doctor
```

Start Docker PostgreSQL and wait for health:

```bash
npm run docker:db
npm run db:preflight
```

Run the container path:

```bash
npm run docker:config
npm run docker:build
npm run docker:migrate
npm run docker:seed
npm run docker:up
npm run db:verify-schema
```

Health endpoints:

- [http://localhost:3000/api/health](http://localhost:3000/api/health)
- [http://localhost:3000/api/ready](http://localhost:3000/api/ready)

Docker documentation: [docs/infrastructure-stabilization.md](docs/infrastructure-stabilization.md)

## Phase 7.5 Closure

Phase 6 pricing and Phase 7 dispatch are closed through the Phase 7.5 verification gate. The supported one-command local proof is:

```bash
npm run verify:phase7.5
```

It installs locked dependencies, validates Prisma and migration safety, runs unit/API coverage, disposable live integration suites, the canonical Docker path, Chromium E2E, and the runtime dependency audit. The normal Compose stack is never volume-deleted; disposable smoke, integration, and E2E projects clean up only their own uniquely named volumes.

See [Phase 7.5 closure](docs/phase-7.5-phase6-phase7-closure.md), the [closure matrix](docs/phase-7.5-closure-matrix.md), and the [E2E guide](docs/testing/e2e.md).

## Environment

Use placeholder templates only:

- `.env.example`
- `.env.docker.example`

Real `.env*` files are ignored and must not be committed.

Host Prisma commands use `localhost:5433`; containers use `db:5432`.

## Migration Baseline

The pre-production migration history was consolidated into one active initial baseline:

```text
prisma/migrations/20260710010000_initial_baseline/
```

The former incremental SQL is retained outside Prisma's active path in `prisma/migrations-legacy-prebaseline/`, with SHA-256 checksums in its manifest. Verify clean bootstrap and the full disposable runtime with:

```bash
npm run docker:migration-smoke
npm run docker:smoke
```

The normal Compose stack uses the new `kt_couriers_postgres_baselined_clean` volume. The old `kt-couriers_kt_couriers_postgres_data` volume is deliberately preserved and is never removed by package scripts.

## Phase 9 Ledger Foundation

Phase 9 adds an internal immutable double-entry ZAR ledger with exact Decimal money, journal idempotency, sorted account locking, atomic account projections, non-negative enforcement, reversal journals, invariant tooling, and permission-gated read-only administration at `/admin/ledger`.

It does not activate payments, refunds, earnings, commissions, withdrawals, settlements, or delivery/order financial posting. There is no public ledger write API.

After implementation review, the dedicated validation entry points are:

```bash
npm run db:preflight:ledger
npm run test:integration:ledger
npm run db:verify:ledger
```

See [Phase 9 wallet ledger system](docs/phase-9-wallet-ledger-system.md), the [accounting model](docs/finance/ledger-accounting-model.md), and the [ledger integration guide](docs/testing/ledger-integration.md).
