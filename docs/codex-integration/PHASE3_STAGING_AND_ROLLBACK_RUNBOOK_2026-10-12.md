# Phase 3 staging and rollback runbook — 12 October 2026

This is a preparation document. It does not authorize production deployment, production migration, provider traffic, or changes to the current Vercel or Railway projects.

## Environment boundary

Create a dedicated staging Vercel project and Railway environment only after the infrastructure owner confirms project ownership and isolation. The staging frontend must use a staging-only Railway origin. Remove the production catch-all rewrite from staging configuration. Keep production cookies, domains, credentials, databases, Redis, volumes, object storage, and webhook endpoints out of staging.

Use disposable PostgreSQL and Redis with unique project/service names, credentials, and volumes. Seed only synthetic records. Configure payment, email, SMS, maps, and media through deterministic fakes or provider sandbox accounts with no production keys. Block outbound connections to production origins and real financial endpoints at the environment/network policy layer; application flags alone do not prove network isolation.

Do not reuse the current Railway production project or its persistent database/Redis volumes as staging. Do not use a Vercel preview that rewrites to the live Railway web service.

## Staging promotion sequence

1. Record the candidate branch, commit, tree, migration tree, manifest state, and the image digests produced from that exact source.
2. Verify the staging Vercel project ID, Git connection, preview URL, environment variables by name, protected domains, and rewrite targets. Verify staging Railway project/environment/service IDs, origin, database and Redis volumes, worker commands, health checks, and outbound restrictions.
3. Run CI against the pull request head SHA. Save job URLs and machine-readable receipts. Stop on any ref mismatch, unexpected secret, skipped critical suite, real provider endpoint, or non-disposable database classification.
4. Deploy to staging only. Review generated SQL and migration ordering; capture a staging backup, apply migrations to the disposable database, run schema/health checks, then run the canonical financial, ownership/BOLA, webhook, processor, notification, media, and full browser suites.
5. Test worker recovery, idempotent replay, duplicate delivery, rollback/forward-repair, and alert delivery using synthetic events. Confirm web and processor are independently observable and can be paused in staging without stopping shared data services.
6. Record product, visual/accessibility, client commercial, finance, legal/privacy, and operations decisions in the approval register. Keep manifest gates OPEN or VALIDATION_BLOCKED until the owner-supplied proof is reviewed.
7. Before a production release is considered, a release owner must separately verify current production SHA, fresh protected-row audit, backups/restore, approved release window, runbook staffing, monitoring, and exact rollback targets. Main integration is code-only only if both Vercel and Railway production deployment mechanisms are durably quarantined and read back. A production release needs separate authorization and is outside this runbook.

## Stop and incident procedure

Stop staging promotion if a deployment points at a production origin, production variable name/value is present in staging, a preview is reachable without intended protection, a migration differs from reviewed SQL, or a financial/provider route attempts live traffic. Preserve job logs, exact SHAs, deployment IDs, timestamps, and redacted configuration. Do not send production cookies or test against a real order.

For a staging incident, stop only the staging worker and isolate the staging app. Keep the evidence and database snapshot. Restore the prior immutable staging application image, then re-run health, schema, and financial invariants. If a schema change is incompatible, use an owner-reviewed forward repair or restore the staging snapshot; do not improvise a destructive rollback.

For any separately approved production incident, the operator follows the production platform's rollback controls using the last known healthy immutable deployment and the approved database recovery plan. Pause stateful workers only under incident command, preserve the ledger and audit history, and verify web/processor source parity and readiness before resuming. Prisma migration rollback must not be assumed: use a reviewed forward fix or the approved tested restore plan. Record who authorized each action and the actual outcome.

## Current readiness

No isolated staging project, staging database, backup, restore rehearsal, production quarantine, promotion, or incident drill was created or performed by this task. The existing Railway production web and processor remain online on main. The destructive staged Railway patch remains untouched.
