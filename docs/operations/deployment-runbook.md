# KT-Courier — Production Deployment Runbook

## 1. Release Order & Pipeline

Every production release must execute in this exact sequence:

1. **Commit Freeze**: Freeze approved release candidate commit (e.g. SHA `ea16c8bb...` + Phase 2 closure).
2. **Assign Release Identifier**: Set immutable semantic tag `vMAJOR.MINOR.PATCH` and inject `DEPLOYMENT_VERSION`.
3. **Build Immutable Image**:
   - `docker build --target runner -t kt-couriers-app:<tag> .`
   - `docker build --target migrator -t kt-couriers-migrate:<tag> .`
   - `docker build --target worker -t kt-couriers-worker:<tag> .`
   - `docker build --target scheduler -t kt-couriers-scheduler:<tag> .`
4. **Record Provenance / Digest**: Verify artifact hashes before deployment.
5. **Inject Production Secrets**: Supply production credentials via secure secret store / environment variables.
6. **Establish Recovery Point**: Take a full pre-deployment database backup (`pg_dump`).
7. **Apply Database Migrations**:
   - Run `npx prisma migrate deploy` via the dedicated migrator container.
   - Never run `prisma migrate dev` or automated seeds in production.
8. **Deploy Infrastructure & Services**:
   - Start PostgreSQL and Redis instances.
   - Start Worker service (`kt-couriers-worker`).
   - Start Scheduler service (`kt-couriers-scheduler`).
   - Start Web application (`kt-couriers-app`).
9. **Readiness Evaluation**:
   - Probe liveness: `GET /api/health` -> HTTP 200 `{ status: "ok" }`.
   - Probe readiness: `GET /api/ready` -> verify DB, Redis, and configuration.
10. **Canary / Rollout Expansion**: Route initial 5-10% traffic to canary, observe error logs, then expand to 100%.
11. **Post-Deployment Observation**: Monitor Sentry error streams, processor lease heartbeats, and PayFast ITN logs.

---

## 2. Next.js Security Patch Protocol (August 26 Advisory Gate)

Current baseline uses `next@16.2.12`. Prior to live public release:

1. Inspect official Next.js August 26 security advisory notes.
2. Update `package.json` to the specific patched stable version (e.g. `16.2.13` / `16.3.x`).
3. Align `eslint-config-next` to match.
4. Re-run local build and qualify.
