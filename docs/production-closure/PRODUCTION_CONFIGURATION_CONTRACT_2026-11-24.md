# Production Configuration Contract (Non-Secret)

**Date:** 2026-11-24  
**Repository:** `analyticsmath/KT-Courier` (`main`)  
**Machine-readable companion:** [`PRODUCTION_CONFIGURATION_CONTRACT_2026-11-24.json`](PRODUCTION_CONFIGURATION_CONTRACT_2026-11-24.json)

This contract documents every non-secret environment variable, classification rule, deployment target, and health endpoint across:

- Vercel edge (`vercel-edge`)
- Railway `web` (`railway-web`)
- Railway `operations` (`railway-operations`)
- Railway `query-storefront-categories` (`railway-query-storefront-categories`)
- Standalone `services/release-authority/` (`standalone-release-authority`)
- GitHub protected `production-release` environment (`github-production-release-env`)

No credential values, passwords, API keys, bank details, or private keys are included. All rules are enforced by `lib/runtime/env-schema-verifier.ts` (`npm run env:verify`) and `lib/config/production-validation.ts`.

## Health & Diagnostic Endpoints

| Endpoint | Purpose | Authority boundary |
|---|---|---|
| `GET /api/health` | Process liveness & runtime telemetry (`lib/health/checks.ts`) | Never authorizes commerce or release |
| `GET /api/infrastructure/ready` | Database + Redis readiness (`lib/health/infrastructure-readiness.ts`) | Deployment probe only; never authorizes checkout/payouts |
| `GET /admin/production-readiness` | Authenticated readiness matrix, module activations, env schema, and acceptance provenance UI | Requires `system_readiness.read` / `system_readiness.manage`; secrets redacted |
| `GET /healthz` (`services/release-authority`) | Release authority container liveness | Public minimal JSON `{ ok: true }` |

## Variable Summary by Subsystem

- **Core Runtime & DB/Redis:** `DATABASE_URL`, `KT_DATABASE_CLASSIFICATION`, `REDIS_URL`, `NEXT_PUBLIC_APP_URL`, `PAYMENT_APP_ORIGIN`, `KT_EDGE_ROLE`. All local/demo flags (`KT_ALLOW_DEMO_SEED`, `KT_LOCAL_FULL_FLOW`, `KT_LOCAL_CHECKOUT_VALIDATION`, `KT_E2E_*`) are forbidden in production.
- **Public Commerce & Paystack:** `KT_COMMERCE_ENABLED` (authoritative global switch; conflicting `CHECKOUT_PUBLIC_ENABLED` rejected), `PAYSTACK_MODE` (`live` | `test` | `disabled`), `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`. When `KT_COMMERCE_ENABLED=true`, accidental `PAYSTACK_TEMPORARY_SANDBOX_ENABLED=true` is rejected.
- **Auth, OTP, Notifications & Media:** `AUTH_OTP_HMAC_KEY`, `NOTIFICATION_SECURITY_PAYLOAD_ENCRYPTION_KEY`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `CRON_SECRET`, `INTERNAL_JOB_SECRET`, `EMAIL_PROVIDER`, `RESEND_API_KEY`, `PRIVATE_MEDIA_STORAGE=s3` (+ `PRIVATE_MEDIA_S3_*`), `CLOUDINARY_*`.
- **Governed Optional Modules (Reporting & Developer API):**
  - **Reporting (`REPORTING`):** Requires dual-control admin approval in `SystemSetting` (`reporting.production_activation_approval`) via `/admin/reports` (`POST`/`PATCH /api/admin/production-readiness/activation`) AND durable storage (`REPORT_ARTIFACT_STORAGE=s3` with `REPORT_ARTIFACT_S3_*` or `REPORT_ARTIFACT_STORAGE=cloudinary` with `CLOUDINARY_*`). `REPORT_ARTIFACT_STORAGE=local` fails production readiness and `env:verify`.
  - **Developer API & Webhooks (`DEVELOPER_API`):** Requires dual-control admin approval (`developer_api.production_activation_approval`) via `/admin/developers` (`POST`/`PATCH /api/admin/production-readiness/activation`) AND `DEVELOPER_API_ENDPOINT_ENVIRONMENT=PRODUCTION` alongside `DEVELOPER_API_CREDENTIAL_HMAC_KEY`, `DEVELOPER_API_CURSOR_HMAC_KEY`, and `DEVELOPER_WEBHOOK_ENCRYPTION_KEY`.
- **Independent Release & Parity Verification:**
  - App server parity/CI adapters (`lib/production-readiness/verification-adapters.server.ts` & `evidence.ts`): `GITHUB_RELEASE_READ_TOKEN`, `KT_PARITY_VERIFIER_URL` (required for `/admin/production-readiness` `production_deployment_sha_parity`; local app-DB parity fallback is disabled), `KT_PARITY_VERIFIER_ALLOWED_HOSTS`, `KT_PARITY_VERIFIER_TOKEN`, `KT_EXPECTED_AUDIT_CLASSIFICATION=production`, and optional `KT_EXPECTED_AUDIT_DATABASE`.
  - Operator least-privilege read-only audit runner (`scripts/audit-reviewed-production.ts --capture-receipt`): `KT_AUDIT_READONLY_DATABASE_URL` (dedicated SELECT-only, non-superuser, non-bypassrls PostgreSQL credential scoped exclusively to audit execution — never reused as `DATABASE_URL` and never placed on the public app service if writable runtime DB access is separate).
  - Standalone `services/release-authority/`: `RELEASE_AUTHORITY_DATABASE_URL` (initialized from `services/release-authority/schema.sql`, including `ra_audit_receipts` and `audit_receipt` revocations) or `RELEASE_AUTHORITY_DATA_DIR`, `RELEASE_AUTHORITY_BEARER_TOKEN`, `RELEASE_AUTHORITY_ADMIN_TOKEN`, `GITHUB_RELEASE_READ_TOKEN`, `VERCEL_TOKEN`, `RAILWAY_API_TOKEN`, `KT_PRODUCTION_ORIGIN`, `KT_EXPECTED_AUDIT_CLASSIFICATION=production`, and optional `KT_EXPECTED_AUDIT_DATABASE`.
  - GitHub `.github/workflows/production-release-authorization.yml`: `RELEASE_AUTHORITY_ORIGIN`, `RELEASE_AUTHORITY_ALLOWED_ORIGIN`, `RELEASE_AUTHORITY_TRUST_SHA256`, `RELEASE_AUTHORITY_TOKEN`, optional `RELEASE_AUTHORITY_TRUST_ANCHORS`.
