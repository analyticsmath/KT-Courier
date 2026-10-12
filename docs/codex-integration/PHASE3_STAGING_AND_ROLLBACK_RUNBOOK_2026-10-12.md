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

## Current readiness and temporary production deployment quarantine (12 October 2026)

No isolated staging project, staging database, production backup, production protected-row audit, promotion, or incident drill was created or performed by this task. The existing Railway production web and operations processor remain online on their prior deployed builds, tracking the `main` source branch. The destructive staged Railway patch `9a3370a3-8d07-4ef9-9e8d-a57ff488fccb` remains untouched and must not be accepted.

The release owner explicitly requested GitHub `main` code consolidation without premature production activation. To quarantine Railway's automatic Git deployments, the production `web` (service `55254aaf-3719-4da9-a5b6-9214417101c6`) and `query-storefront-categories` operations processor (service `fdd13e91-dffa-400e-9a44-ae2d1f891ff0`) were individually configured using the Railway service API with **live** `build.watchPatterns` equal to `["/.release-control/approved-production-deploy-only-2026-10-12"]`. That path does not exist in the repository. Railway documents that commits with no changes matching a configured watch pattern do not trigger a deployment. Both values were independently read back; all four live Railway service deployment IDs were unchanged, and the pre-existing staged destructive patch remained in place and uncommitted. **This is a temporary auto-deployment safeguard, not a production release or a prevention of manual deployment.** No one should add a matching source file before independently authorizing production release.

For Vercel, `vercel.json` on the integration candidate contains `git.deploymentEnabled` rules setting both `integration/codex-phase1-phase2-2026-10-11` and `main` to `false`. Vercel documents that matching false branch rules suppress Git-triggered deployments. The repository owner previously confirmed that project-level preview deployments were disabled, but the available Vercel API/CLI does not independently expose a successful effective setting readback. Therefore confirm actual production/preview deployment history after Git actions, and do **not** claim complete platform isolation solely from source configuration. Until Phase 3 separately approves release, preserve both Railway watch-pattern freezes and Vercel `main: false`.

**Phase 3 unfreeze:** The authorized operator must inspect and safely resolve the separate Railway staged destructive patch without losing the production operations processor, review the exact `main` SHA and all forward migrations, confirm approved backups and human/provider gates, then restore reviewed watch patterns or disable the freeze only in a controlled release window. Remove the Vercel `main: false` rule only when approved, and verify actual production Git/deploy behavior by observation. Never accept the current Railway staged patch as a shortcut to unfreeze.
