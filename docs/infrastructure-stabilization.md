# KT Couriers Infrastructure Stabilization

This gate documents the local Docker, PostgreSQL, Prisma, and container runtime path between Phase 5 and Phase 6. It does not implement Phase 6 pricing work.

## Current Decision

The migration history was intentionally consolidated before the first real deployment. The former chain began with an incremental migration that assumed base tables already existed, and Git could not prove the missing historical schema. The active path now contains one baseline generated from the complete current Prisma datamodel; the former SQL is retained only in `prisma/migrations-legacy-prebaseline/` with a SHA-256 manifest.

This is a pre-production correction, not a production migration rewrite. See [migration-baseline-consolidation.md](migration-baseline-consolidation.md).

## Docker Engine Versus Docker CLI

`docker --version` only proves the CLI is installed. It does not prove the Linux engine is running. Use:

```bash
npm run docker:doctor
docker version
docker info
docker context show
```

If `docker info` fails on Windows, start Docker Desktop:

```powershell
docker desktop start --timeout 120
```

Then poll:

```powershell
docker info
```

If Docker Desktop cannot start because Windows features require elevation, run the exact elevated command reported by Windows or Docker Desktop. Do not reset Docker Desktop or unregister WSL distributions as a standard fix.

## WSL 2 Checks

Use these read-only checks:

```powershell
wsl --status
wsl --version
wsl -l -v
wsl -e sh -lc "uname -a"
```

KT Couriers expects Docker Desktop to use Linux containers. Confirm with:

```bash
docker desktop engine ls
docker info
```

`docker info` should report `OSType: linux`.

## Docker Context And Env Overrides

Check context and overrides:

```powershell
docker context ls
docker context show
Get-ChildItem Env:DOCKER_HOST -ErrorAction SilentlyContinue
Get-ChildItem Env:DOCKER_CONTEXT -ErrorAction SilentlyContinue
```

If `DOCKER_HOST` points at a stale socket, remove it only from the current shell first:

```powershell
Remove-Item Env:DOCKER_HOST
```

Do not permanently delete user or machine environment variables until the incorrect value is proven.

## Environment Files

Committed templates contain placeholders only:

- `.env.example`
- `.env.docker.example`

Real env files are ignored:

- `.env`
- `.env.local`
- `.env.docker`
- `.env.*`

Host tools on Windows use `localhost:5433`:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5433/kt_courier_dev?schema=public"
SHADOW_DATABASE_URL="postgresql://USER:PASSWORD@localhost:5433/kt_courier_shadow?schema=public"
```

Containers use the Compose service hostname and internal port:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@db:5432/kt_courier_dev?schema=public"
SHADOW_DATABASE_URL="postgresql://USER:PASSWORD@db:5432/kt_courier_shadow?schema=public"
```

Inside a container, `localhost` means that same container. The app and migrator must use `db:5432`.

## Compose Stack

Canonical files:

- `compose.yml`
- `compose.dev.yml`

Legacy compatibility:

- `docker-compose.dev.yml`

Services:

| Service | Purpose | Dependency | Port | Health |
|---|---|---|---|---|
| `db` | PostgreSQL 16 local database | none | `5433:5432` in dev override only | `pg_isready` |
| `migrate` | One-shot Prisma migration deploy | healthy `db` | none | exits 0 on success |
| `seed` | One-shot development seed | successful `migrate` | none | exits 0 on success |
| `app` | Next.js standalone runtime | healthy `db`, successful `migrate` | `${APP_PORT:-3000}:3000` | `/api/health` |

Useful commands:

```bash
npm run docker:config
npm run docker:build
npm run docker:db
npm run docker:migrate
npm run docker:seed
npm run docker:up
npm run docker:ps
npm run docker:logs
npm run docker:down
```

`docker:down` stops containers without deleting the normal development volume. Do not use `down -v` for the normal project unless you have explicit disposable-data approval.

## PostgreSQL And Shadow Database

`db` uses a named volume:

```text
kt_couriers_postgres_baselined_clean
```

The former normal development volume, `kt-couriers_kt_couriers_postgres_data`, is intentionally preserved because it contains the pre-consolidation failed migration metadata. No command in this repository removes it automatically.

The first initialization creates the configured shadow database through:

```text
docker/postgres/init/01-create-shadow-database.sh
```

For an already initialized local dev volume:

```bash
npm run db:ensure-shadow
```

The script creates the shadow DB only if absent. It never drops or recreates databases.

If a PostgreSQL volume was initialized with old credentials, update the local env values to match the existing volume or create a new explicitly disposable project name for testing. Do not remove the normal development volume as a generic repair.

## Prisma Workflow

Use:

```bash
npx prisma validate
npx prisma generate
npx prisma migrate status
npm run docker:migrate
npx prisma db seed
npm run db:verify-schema
```

Staging and production must use:

```bash
npx prisma migrate deploy
```

Do not use `migrate reset`, `db push --force-reset`, manual `DROP`, `TRUNCATE`, or `DELETE FROM` as routine fixes.

## Fresh Migration Smoke

Run the clean migration proof with a unique disposable project:

```bash
npm run docker:migration-smoke
```

This uses project name:

```text
kt-couriers-baseline-smoke
```

It applies the active baseline to an empty database, checks migration status and Prisma schema diff, then removes only that smoke project and its volume. `npm run docker:smoke` extends the proof with two seed runs, application startup, liveness/readiness, and non-root verification. The normal development project is not volume-deleted.

## Health And Readiness

Routes:

- `GET /api/health`: process liveness, no database access, returns 200.
- `GET /api/ready`: bounded `SELECT 1`, returns 200 only when PostgreSQL is reachable, otherwise 503.

Responses never include connection strings, passwords, or raw Prisma errors.

## Production Hardening

The Docker runtime:

- uses `node:24-bookworm-slim`;
- builds Next.js with `output: "standalone"`;
- runs `node server.js`;
- runs as non-root user `nextjs`;
- sets `NODE_ENV=production`;
- sets `NEXT_TELEMETRY_DISABLED=1`;
- sets `HOSTNAME=0.0.0.0` and `PORT=3000`;
- uses `init: true`;
- sets `no-new-privileges:true`;
- does not copy `.env`, tests, docs, coverage, Git metadata, or local dependencies into the runtime image.

The base Compose stack does not publish PostgreSQL to the host. The development override publishes `5433:5432` for host Prisma tooling.

## CI Status

CI preserves quality and container-build gates and runs logical isolated gates for migration smoke, pricing integration, dispatch integration, cross-module integration, Docker runtime, and Chromium E2E:

- Docker doctor
- Compose config validation
- Docker image build
- empty PostgreSQL bootstrap and `prisma migrate deploy`
- Prisma migration status and schema diff
- two seed runs with stable contract-record counts
- application liveness/readiness checks and non-root runtime inspection
- sanitized logs and removal of only its `kt-couriers-ci-<run-id>` volume on failure or success

The consolidated local equivalent is `npm run verify:phase7.5`. It also runs the runtime dependency audit and does not remove the normal Compose volume.

## Dependency Audit

The non-forced audit remediation updates the development-only `esbuild` toolchain patch release. The remaining audit finding is a moderate PostCSS advisory nested under the pinned Next.js runtime dependency. npm does not offer a safe forward update for the pinned version; its only proposed result is a breaking downgrade to Next.js 9, so `npm audit fix --force` is intentionally not used.

The affected PostCSS stringifier is used during trusted source builds in this repository, not as a request-time user CSS processing API. Keep the Next.js version pinned, do not pass untrusted CSS into build tooling, and reassess when npm/Next publishes a compatible non-breaking remediation. There are no high or critical runtime audit findings.

## Never Commit

- real `.env` files;
- database passwords;
- Resend keys;
- Google Maps server keys;
- Docker credential files;
- production `DATABASE_URL` values;
- diagnostic archives.
