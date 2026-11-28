# KT Couriers — Independent Release Authority Service

Standalone deployable HTTP release authority service and offline 4-role Ed25519 signing CLI for `analyticsmath/KT-Courier`.

## Architecture & Security Separation

1. **Zero private keys on the server**:
   - The HTTP server (`src/server.mjs`) never generates or stores human approver private keys.
   - Four independent role authorities (`operator`, `finance`, `database`, `security`) hold their own offline Ed25519 keys via `src/cli.mjs` and sign distinct `{ payload, claim }` artifacts separately from the release maker (`principal !== maker`).
2. **Independent evidence & context collection (`src/collectors.mjs`)**:
   - Queries GitHub REST API (`CI` 10-job workflow, `Engineering Certification` 26-job workflow on `main`, and commit `treeSha`), Vercel deployment state (`READY`, `production`), Railway GraphQL (`web`, `operations`, and `query-storefront-categories` all `SUCCESS`), and `/api/infrastructure/ready`.
3. **Atomic single-use issuance claims (`src/store.mjs`, `schema.sql`)**:
   - Production multi-instance mode uses PostgreSQL (`RELEASE_AUTHORITY_DATABASE_URL`) with `INSERT ... ON CONFLICT (issuance_id) DO NOTHING RETURNING *` and revocation checks inside a single transaction.
   - Single-host / containerized volume mode uses `RELEASE_AUTHORITY_DATA_DIR` with atomic `O_EXCL` lockfiles and fsynced claim receipts.
4. **Protocol routes**:
   - `GET /healthz`
   - `GET /v1/release-authority/trust`
   - `GET /v1/release-authority/releases/:sha/context?treeSha=...&evidenceReference=...`
   - `GET /v1/release-authority/releases/:sha/evidence/:ref`
   - `GET /v1/release-authority/audits/:ref`
   - `GET /v1/release-authority/revocations`
   - `POST /v1/release-authority/issuances/claim`
   - `POST /v1/release-authority/parity/verify`
   - `POST /v1/release-authority/ci/verify`
   - Admin ingestion/collector routes (`/v1/release-authority/admin/trust`, `/admin/audits`, `/admin/collect`, `/admin/envelopes`, `/admin/revocations`, guarded by separate `RELEASE_AUTHORITY_ADMIN_TOKEN`)

5. **Verified Protected-Row Database Audit Flow**:
   - Capture an immutable pre-deployment baseline and post-deployment candidate `ProtectedAuditReceipt` using a dedicated least-privilege PostgreSQL read-only role (`KT_AUDIT_READONLY_DATABASE_URL`, never writable `DATABASE_URL`):
     - Baseline capture: `npx tsx scripts/audit-reviewed-production.ts --capture-receipt --release-sha <prevSha> --ref audit-base-01 --vercel-id ... --web-id ... --operations-id ... --query-id ... --auditor <operatorId> --out baseline-receipt.json`
     - Candidate comparison capture: `npx tsx scripts/audit-reviewed-production.ts --capture-receipt --release-sha <candidateSha> --ref audit-cand-01 --baseline baseline-receipt.json --vercel-id ... --web-id ... --operations-id ... --query-id ... --auditor <operatorId> --out candidate-receipt.json`
     - If active operational commerce tables changed legitimately during the deployment window, supply `--documented-changes Order,Payment,... --documented-ref <chgRef> --documented-reason "<reason>" --reviewer <distinctReviewerId>`.
   - Ingest the candidate receipt into the release authority (`PUT /v1/release-authority/admin/audits` via `node services/release-authority/src/cli.mjs ingest-audit --receipt candidate-receipt.json`). Both `POST /v1/release-authority/parity/verify` and `POST /v1/release-authority/admin/collect` enforce `verifyAuditReceipt`, revocation lookup, database identity, least-privilege role verification, complete 37-table inventory, freshness window, and before/after baseline comparison.

## Environment Contract (Non-Secret Names Only)

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | Optional (`8080`) | Listener port |
| `HOST` | Optional (`0.0.0.0`) | Listener bind address |
| `RELEASE_AUTHORITY_BEARER_TOKEN` | Yes (>= 16 chars) | Read & claim token granted to GitHub `production-release` environment |
| `RELEASE_AUTHORITY_ADMIN_TOKEN` | Yes (>= 16 chars) | Separate operator admin token for publishing trust/audits/contexts/envelopes/revocations |
| `RELEASE_AUTHORITY_DATABASE_URL` | Recommended for HA | Separate dedicated PostgreSQL connection string initialized from `schema.sql` |
| `RELEASE_AUTHORITY_DATA_DIR` | Fallback if no DB URL | Persistent volume path for atomic file lock/claim store |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_INSTALLATION_ID` | Recommended read-only App | Short-lived RS256 GitHub App installation tokens (`actions:read`, `contents:read`, `metadata:read`) for CI & artifact ZIP verification without a fine-grained PAT (public `analyticsmath/KT-Courier` workflow runs also verify without tokens) |
| `GITHUB_RELEASE_READ_TOKEN` | Optional fallback | Legacy/CI test token if configured; never required for public workflow verification |
| `VERCEL_TOKEN` (+ optional `VERCEL_TEAM_ID`) | Collector/Parity | Read-only Vercel token to verify production deployment SHA parity |
| `RAILWAY_API_TOKEN` | Collector/Parity | Read-only Railway API token to verify `web`, `operations`, `query-storefront-categories` |
| `KT_PRODUCTION_ORIGIN` | Collector/Parity | Public HTTPS origin of KT Couriers app for `/api/infrastructure/ready` health verification |
| `KT_EXPECTED_AUDIT_CLASSIFICATION` | Collector/Parity | Expected DB classification (`production`, default) enforced on verified audit receipts |
| `KT_EXPECTED_AUDIT_DATABASE` | Optional hardening | Expected production PostgreSQL database name enforced on verified audit receipts |
