# Railway configuration evidence — 7 October 2026

**DO NOT APPLY staged patch `9a3370a3-8d07-4ef9-9e8d-a57ff488fccb`. It deletes the live operations processor.**

Read-only environment and live service configuration captured before mutations:

- Project: `e9554aaa-1b53-4595-8731-e8c2885ac594`.
- Production environment: `2226be2a-86f7-4590-a7b4-72aa54dccf52`.
- Web: `55254aaf-3719-4da9-a5b6-9214417101c6`, Dockerfile, `node server.js`, `/api/ready`.
- Operations: `fdd13e91-dffa-400e-9a44-ae2d1f891ff0`, existing name `query-storefront-categories`, Dockerfile.operations, repository `analyticsmath/KT-Courier`, branch `main`, health check `/health`.
- Operations runs the read-only audit followed by `scripts/production-processors.ts`; reviewed scope remains Paystack inbox processing, verified payment consumption, and notifications.
- Both live services have SUCCESS deployments and one running replica. PostgreSQL and Redis are online.
- Live source configuration has `checkSuites: false`; merging main triggers deployments, so main must remain untouched while certification is incomplete.
- Staged patch creates obsolete `paystack-credential-test` and deletes the repository-backed operations service. It is unrelated to the current live configuration and is not needed.
- Available Railway connector exposes inspection and accept-deploy, but no discard/cancel patch operation. No accept-deploy or other Railway mutation was called.

Containment state: **isolated and untouched, removal requires supported Railway dashboard discard workflow**. Before any future Railway mutation, an operator must discard this exact patch and re-inspect the staged changes. Never accept it to clear the dashboard.

Credentials were neither retrieved nor recorded. OAuth variable listing exposes names only. Tracing is currently disabled; enabling it is deferred while the destructive patch remains staged.

Read-only refresh at 2026-10-07 01:12 UTC confirmed patch status STAGED and `destructive: true`, with the same create/delete actions. All four live deployment IDs remained SUCCESS. No Railway mutation was performed.
