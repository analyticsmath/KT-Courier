# KT Couriers — Phase 1 CI/CD Closure & Migration-Smoke Isolation

## 1. Root Cause of Historical GitHub Actions Failure

- **Observed Workflow Failure**: GitHub Actions `CI` workflow (`.github/workflows/ci.yml`), run `42746382785`, job `migration-smoke` (`129599390938`).
- **Symptom**:
  ```text
  Error response from daemon: Ports are not available: exposing port TCP 0.0.0.0:55832 -> 0.0.0.0:0: listen tcp4 0.0.0.0:55832: bind: address already in use
  ```
- **Technical Root Cause**:
  1. [`compose.dev.yml`](file:///d:/KT-Courier/compose.dev.yml) defines host port bindings for local developer convenience:
     - `db`: `${POSTGRES_PORT:-5433}:5432`
     - `redis`: `6379:6379`
     - `app`: `${APP_PORT:-3000}:3000`
  2. [`scripts/docker-migration-smoke.mjs`](file:///d:/KT-Courier/scripts/docker-migration-smoke.mjs) runs all migration, schema-diff, psql inspection, and seed verification commands **inside the Compose network** (`docker compose run --rm migrate`, `docker compose exec -T db`, `docker compose run --rm seed`) using `DATABASE_URL=postgresql://...@db:5432/...`. It never connects to PostgreSQL over a host TCP port.
  3. Despite not needing any host port, `scripts/docker-migration-smoke.mjs` previously inherited `compose.dev.yml` host port publishing with a hardcoded `POSTGRES_PORT: "55832"`. Whenever `55832` was already bound on the runner or developer host, `docker compose up -d db` failed immediately.

## 2. Engineering Fix Implemented

1. **Created [`compose.migration-smoke.yml`](file:///d:/KT-Courier/compose.migration-smoke.yml)**:
   ```yaml
   services:
     db:
       ports: !override []
     redis:
       ports: !override []
     app:
       ports: !override []
   ```
   Using Docker Compose v2/v5 `!override []` strips all host port bindings from `compose.dev.yml` for the disposable `kt-couriers-baseline-smoke` project while preserving `compose.dev.yml` port `5433` for normal local development (`npm run docker:up`).
2. **Updated [`scripts/docker-migration-smoke.mjs`](file:///d:/KT-Courier/scripts/docker-migration-smoke.mjs)**:
   - Exported `MIGRATION_SMOKE_COMPOSE_OVERRIDE = "compose.migration-smoke.yml"` and `MIGRATION_SMOKE_EXTRA_COMPOSE_FILES = [MIGRATION_SMOKE_COMPOSE_OVERRIDE]`.
   - Passed `extraComposeFiles: MIGRATION_SMOKE_EXTRA_COMPOSE_FILES` via `smokeComposeOptions` to every `runCompose` and `waitForServiceHealth` invocation.
   - Removed the unused `POSTGRES_PORT: "55832"` host variable from `smokeEnv`.
3. **Hardened Dynamic Port Allocation in [`scripts/docker-smoke.mjs`](file:///d:/KT-Courier/scripts/docker-smoke.mjs) and [`scripts/docker-gate4-integration.mjs`](file:///d:/KT-Courier/scripts/docker-gate4-integration.mjs)**:
   - Replaced static fallback ports (`55432`, `56379`, `55932`, `56479`, `3100`) with OS-assigned ephemeral loopback ports via `findAvailableLoopbackPort()` whenever `KT_SMOKE_*_PORT` or `KT_GATE4_*_PORT` environment variables are not explicitly set.
4. **Added Regression Invariant Test in [`tests/infrastructure/docker-config.test.ts`](file:///d:/KT-Courier/tests/infrastructure/docker-config.test.ts)**:
   - Binds a TCP server on `127.0.0.1:55832`, renders `docker compose -p kt-couriers-baseline-smoke -f compose.yml -f compose.dev.yml -f compose.migration-smoke.yml config`, verifies zero `ports:` blocks exist on `db`, `redis`, and `app`, verifies project-scoped disposable volume naming (`kt-couriers-baseline-smoke_kt_couriers_postgres_baselined_clean`), and verifies `compose.dev.yml` still exposes `5433` for normal local development.

## 3. Verification Proof (With `0.0.0.0:55832` Actively Occupied)

Executed in local shell with a Node TCP listener holding `0.0.0.0:55832`:
- Command:
  ```powershell
  node -e "import('node:net').then(({createServer})=>{const s=createServer();s.listen(55832,'0.0.0.0',async()=>{console.log('Bound 0.0.0.0:55832 deliberately');const {spawnSync}=await import('node:child_process');const r=spawnSync(process.execPath,['scripts/docker-migration-smoke.mjs'],{stdio:'inherit'});s.close(()=>process.exit(r.status??1));});});"
  ```
- Output:
  ```text
  Bound 0.0.0.0:55832 deliberately
  Fresh baseline migration smoke project: kt-couriers-baseline-smoke
  First disposable smoke seed authorization: ENABLED
  Seed target authorization: project=kt-couriers-baseline-smoke database=kt_courier_baseline_smoke host=db authorized=true
  Second disposable smoke seed authorization: ENABLED
  Seed target authorization: project=kt-couriers-baseline-smoke database=kt_courier_baseline_smoke host=db authorized=true
  Fresh migration smoke passed: the complete migration chain, idempotent seed, and schema drift check succeeded from an empty database.
  Fresh baseline migration smoke: removing only the disposable smoke project volume.
  ```
- Exit Code: `0`.

## 4. Phase 3 Live-Launch Veto Preservation (`production-certification.yml`)

- `.github/workflows/production-certification.yml` runs `node scripts/check-closure-engineering-gates.mjs` (`tests/infrastructure/closure-engineering-gates.test.ts`).
- That gate intentionally fails closed (`exit 1`) until external Phase 3 owner/legal/financial live-launch approvals are recorded. It was **not** weakened or bypassed.
