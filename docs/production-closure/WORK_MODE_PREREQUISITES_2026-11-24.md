# Work-Mode Non-Coding Launch Closeout Prerequisites

**Date:** 2026-11-24  
**Scope:** Strictly external credentials, hosting configuration, human dual-control reviews, physical field acceptance, and bounded financial acceptance. **Zero coding changes required when configured.**

Engineering completion does **not** certify unrestricted real-money operations or close GitHub Issue `#36`. Only genuine non-fabricated external actions below clear the corresponding live gates.

## 1. Infrastructure & Configuration Prerequisites (Zero-Code)

1. **Production Environment Secrets (Railway `web`, `operations`, `query-storefront-categories`, & Vercel Edge):**
   - Confirm all variables in `PRODUCTION_CONFIGURATION_CONTRACT_2026-11-24.json` are set with non-placeholder production values and run `npm run env:verify` safely in the target runtime (`REPORT_ARTIFACT_STORAGE=s3` or `cloudinary` prior to enabling Reporting; `DEVELOPER_API_*` keys + `PRODUCTION` environment prior to enabling Developer APIs).
   - Set read-only `GITHUB_RELEASE_READ_TOKEN`, `VERCEL_TOKEN`, and `RAILWAY_API_TOKEN` (or configure `KT_PARITY_VERIFIER_URL` + `KT_PARITY_VERIFIER_TOKEN`) so `/admin/production-readiness` performs `SERVER_VERIFIED` CI (26 certification + 10 primary CI jobs) and 4-service deployment SHA parity checks directly.
2. **Deploy Standalone `services/release-authority/`:**
   - Provision a dedicated container/service from `services/release-authority/Dockerfile` with an isolated PostgreSQL database initialized using `services/release-authority/schema.sql`.
   - Set `RELEASE_AUTHORITY_DATABASE_URL`, `RELEASE_AUTHORITY_BEARER_TOKEN`, separate `RELEASE_AUTHORITY_ADMIN_TOKEN`, `GITHUB_RELEASE_READ_TOKEN`, `VERCEL_TOKEN`, `RAILWAY_API_TOKEN`, and `KT_PRODUCTION_ORIGIN`.
   - Provision offline Ed25519 role keypairs (`operator`, `finance`, `database`, `security`) via `services/release-authority/src/cli.mjs init-keypair` held separately by human approvers (zero private keys on any server) and set `RELEASE_AUTHORITY_ORIGIN`, `RELEASE_AUTHORITY_ALLOWED_ORIGIN`, `RELEASE_AUTHORITY_TRUST_SHA256`, and `RELEASE_AUTHORITY_TOKEN` in the protected GitHub `production-release` environment.
3. **Least-Privilege Read-Only Database Audit Role:**
   - Run `scripts/audit-reviewed-production.ts` under an approved read-only PostgreSQL role against exact deployment SHA and compare protected-table row counts/hashes before any live acceptance mutation.

## 2. Commercial, Finance & Compliance Prerequisites (`/admin/*`)

1. **`approved_commission_plan`:** Finance reviews genuine negotiated store/courier terms (default courier 70% driver / 30% KT; store 8% on `ORDER_SUBTOTAL` unless negotiated) with non-retroactive effective dates; a distinct Finance approver activates them (`/admin/commission-plans`).
2. **`cod_remittance` & `cod_policy`:** Finance enters verified remittance/bank instructions privately (`/admin/cash-deposits`) and creates + independently approves a scoped Gauteng active-service `DEPOSIT_PLUS_COD` (exact `50%` deposit, positive `maximumCodAmount`) policy matching the current remittance version (`/admin/payment-policies`).
3. **`privacy_retention`:** Legal + distinct Admin draft, legal-review, and activate `RetentionPolicyVersion` (`PRIVATE_MEDIA`, `DELETE`, finite non-negative days) via `/admin/retention`.
4. **Optional Modules (`REPORTING`, `DEVELOPER_API`):** Only if launch-enabled, distinct Admin actors request and approve dual-control activation on `/admin/reports` and `/admin/developers` after storage/HMAC env vars are verified.

## 3. Genuine Field, Provider, & Financial Acceptance (`/admin/production-readiness`)

For the exact deployed `main` SHA:
1. **`current_ci_certification`:** Submit GitHub CI & 26-job Certification URLs on `/admin/production-readiness`; server verifies `SERVER_VERIFIED` provenance; a distinct Admin approves.
2. **`production_deployment_sha_parity`:** Record exact Vercel + Railway `web`, `operations`, `query-storefront-categories` deployment SHAs/IDs + protected-row audit digest; server verifies `SERVER_VERIFIED` parity; distinct Admin approves.
3. **`payment_integration_acceptance`:** Execute an isolated sandbox verification against current release SHA (`SERVER_VERIFIED`), or authorized `LIVE` attestation with `financialAuthorizationReference`.
4. **Operations & Live Finance (`vendor_onboarding_acceptance`, `driver_onboarding_acceptance`, `driver_gps_acceptance`, `pod_otp_acceptance`, `settlement_acceptance`, `refund_acceptance`, `payout_acceptance`):** Complete genuine device/onboarding/OTP/POD and bounded real-money exercises per `REAL_MONEY_ACCEPTANCE_RUNBOOK.md`, record `HUMAN_ATTESTED` drafts with non-secret audit & `financialAuthorizationReference` identifiers, and obtain independent Admin review.
5. **Independent 4-Role Production Release Authorization Workflow:** Collect offline Ed25519 signatures from the 4 human role keys over the collector-verified context (`services/release-authority/src/cli.mjs`), upload envelope to `/v1/release-authority/admin/envelopes`, and dispatch `.github/workflows/production-release-authorization.yml` on `main`.
