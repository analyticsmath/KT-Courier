# Railway configuration evidence — historical snapshots and 16 October refresh

**Do not deploy staged patch `9a3370a3-8d07-4ef9-9e8d-a57ff488fccb` until its exact current diff is reviewed. The 16 October status shows a staged update targeting `admin-replacement-inspection`; older receipts conflict about the patch contents. The current operations worker is a separate service.**

Read-only environment and live service configuration captured before mutations:

- Project: `e9554aaa-1b53-4595-8731-e8c2885ac594`.
- Production environment: `2226be2a-86f7-4590-a7b4-72aa54dccf52`.
- Web: `55254aaf-3719-4da9-a5b6-9214417101c6`, Dockerfile, `node server.js`, `/api/ready`.
- Operations: `fdd13e91-dffa-400e-9a44-ae2d1f891ff0`, existing name `query-storefront-categories`, Dockerfile.operations, repository `analyticsmath/KT-Courier`, branch `main`, liveness health check `/health`; processor readiness is `/ready`.
- Operations runs the read-only audit followed by `scripts/production-processors.ts`; reviewed scope remains Paystack inbox processing, verified payment consumption, and notifications.
- Both live services have SUCCESS deployments and one running replica. PostgreSQL and Redis are online.
- Live source configuration at this historical snapshot had `checkSuites: false`; main pushes can trigger deployments, so code changes should be tested before they land.
- One historical description of the staged patch said it created obsolete `paystack-credential-test` and deleted the repository-backed operations service. The 16 October environment refresh describes a single resource update to `admin-replacement-inspection`; do not use the historical description as current patch scope.
- Available Railway connector exposes inspection and accept-deploy, but no discard/cancel patch operation. No accept-deploy or other Railway mutation was called.

Containment state: **isolated and untouched, removal requires supported Railway dashboard discard workflow**. Before any future Railway mutation, an operator must discard this exact patch and re-inspect the staged changes. Never accept it to clear the dashboard.

Credentials were neither retrieved nor recorded. OAuth variable listing exposes names only. Tracing is currently disabled; enabling it is deferred while the destructive patch remains staged.

Read-only refresh at 2026-10-07 01:12 UTC confirmed patch status STAGED and `destructive: true`, with the same create/delete actions. All four live deployment IDs remained SUCCESS. No Railway mutation was performed.

Read-only refresh at 2026-10-07 09:56 UTC again confirmed the same patch is STAGED, destructive and contains five changes. All four live services were online with SUCCESS deployments, one running replica each and no current issues. The redacted provider artifact records only service/deployment health and patch action identities. The operations service was neither deleted nor redeployed.

Read-only refresh at 2026-10-07 11:52 UTC confirmed the same four SUCCESS deployment IDs, one running replica each, zero crashed replicas and no current issues/failures. The destructive patch remained STAGED with five changes. The redacted artifact is `output/production-closure/provider-round18.json`; it contains no variable values, service source configuration or credentials. No provider mutation was performed.

Read-only refresh at 2026-10-07 19:39 UTC (8 October in Asia/Karachi) confirmed all four live services online with SUCCESS deployments, one running replica each and zero issues or recent failures. The same destructive five-change patch remains STAGED; its operations-service deletion was not applied. Redacted health and action identities are in `output/production-closure/provider-round32.json`. Public `/api/health` and `/api/ready` both returned HTTP 200 with `no-store`, respectively `ok` and `ready`. These checks establish live infrastructure health, not candidate SHA parity or protected-row integrity. No provider mutation was performed.

## Read-only production refresh — 16 October 2026

The Railway environment status and deployment list were refreshed without mutation. Production web deployment `1e03cac7-5a13-4a64-bb3c-094a466c0cee` and operations deployment `de73d598-a5fb-42db-9f44-fd8d13c9d64e` are both `SUCCESS` on branch `main`, exact SHA `a91de94741dcef0724eb3a91d812d707ad05dbd5`, one replica running each. PostgreSQL and Redis each report one running replica and no active notifications. The operations service has two recent failed deployments in the preceding 24 hours, but its current deployment is successful and has no active provider warning. Its processor readiness is separately **blocked**: the latest cycles report 25 marketplace store-order initialization retries because there is no active bounded operational policy. Do not describe overall delivery operations as ready.

`admin-replacement-inspection` still exists; its latest deployment is `SUCCESS`, but it has zero of one replicas running. The staged patch `9a3370a3-8d07-4ef9-9e8d-a57ff488fccb` remains pending and the current environment status reports a staged resource update to that service. Older receipts conflict about the exact patch contents. No accept, deploy, discard, service deletion or configuration mutation was performed; inspect the current provider diff before any later decision.

The operations process emitted `kt_reviewed_production_evidence` at `2026-10-16T00:08:51.874Z` from this exact deployment. The audit set the PostgreSQL transaction read-only, verified `transaction_read_only=on`, and aggregated counts/full-row hashes for 17 protected tables without exporting their rows. The database role was `postgres`, so this is transaction-level read-only evidence, not proof of a least-privilege database login. The audit also found 25 driver profiles, zero dispatch-ready, 30 notification templates under review, six recipient policies in draft and no event routes. Sensitive row hashes and private records are intentionally not copied into this file.

Vercel production deployment `dpl_Gw7GFzmbVyb1mxkFMb3uZMY2CNq5` was independently confirmed `READY` on the same main SHA. This parity is deployment evidence, not operator acceptance or a launch certificate.
