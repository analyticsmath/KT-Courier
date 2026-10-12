# Overnight engineering baseline — 12 October 2026

Observation window: 2026-10-11 20:10–20:14 UTC. Repository: analyticsmath/KT-Courier. Worktree: D:/KT-Courier-integration.

## Decision

Publication remains blocked. The linked Vercel project did not expose a readable preview-disable setting, and the authenticated Vercel REST CLI request returned 403. The candidate's branch suppression rule is defense in depth, not independent platform readback. Since existing previews can route through a catch-all to the production Railway web service, do not push, open or update a PR, trigger hosted certification, merge main, or retire branches.

## Repository identity

- Candidate: 4b57c36cda111673bad1ea3689a8aafa66a01b03.
- Tree: 9497eba3a65fd68bfe842eaf3593fd70ac26f61d.
- Migration tree: 1d0f1c9e100d2aace8fba5062ea5c0462ab62096.
- origin/main is 83a4d63078efa20d4e234fe081c10e15746387d1 and is an ancestor; the candidate is 94 commits ahead, zero behind.
- Parent evidence commit 39419f6b3330f48ce96c831a8d2a657b30876b89 descends from tested source aa0a3af7a80855161c8b8c0a065106abf019e7f5.
- Phase 1 implementation 3655a53e8a595c4c89dbf9891578961dec195292 and Phase 2 source 3c79fce207800264b78e59a60bfcc4240ede6cc4 are ancestors.
- The four diagnostic .tmp-driver files on Phase 1 branch tip 9612d8366e54e3492a80c53d63753b0af01a6c47 are excluded.
- The legacy migration branch has five unique commits and is 35 commits behind main; preserve it.
- The Phase 1 and Phase 2 worktrees were read-only checked and clean. A missing prunable control-desk worktree path was left untouched.
- PR 17 remains open and draft at 9612d8366e54e3492a80c53d63753b0af01a6c47. No branch was pushed or deleted.

## Engineering repair and verification

Regular CI previously used checkout's default pull-request merge ref, which could test a synthetic merge instead of the submitted PR head. The candidate binds all 28 checkout steps to the pull-request head SHA, with the event SHA as fallback. It requests contents-only permissions, excludes repository secrets, sets offline test mode and console email, and disables Paystack activation. A regression test covers these controls and the local Vercel branch rule.

The change commit modifies only .github/workflows/ci.yml, scripts/production-certification-workflow.test.mjs, and vercel.json. No application route, schema, migration, financial logic, or client policy changed.

On candidate contents: npm run lint passed; the focused workflow suite passed 6/6; YAML parsing and exact checkout inspection passed 28/28; vercel.json parsed and passed Vercel JSON schema validation; git diff --check passed. Receipts are stored in test-receipts/overnight-4b57c36/.

Existing browser and database receipts are bound to aa0a3af7, not relabeled as a full-tree run of this candidate. That source's local report records 42/42 directed Chromium, 139/139 full Chromium, 41/41 canonical PostgreSQL, 178/178 closure PostgreSQL, and 3748/3748 coverage. Production-only dependency audit was clean; full development audit retains five high reports from the transitive braces 3.0.3 developer-tool chain.

## Hosting observations

Vercel project kt-courier, ID prj_PoKqf1EUWkvl7Y3nxaTtoYSjQm7r, has recent previews from Phase 1 and Phase 2 branches and production on main 83a4d63078efa20d4e234fe081c10e15746387d1. Its source contains a catch-all rewrite to the live Railway origin. SSO is enabled except for custom domains and does not prove origin isolation.

Vercel project metadata omitted previewDeploymentsDisabled and Git branch rules. The local config sets deploymentEnabled false only for integration/codex-phase1-phase2-2026-10-11; main is unmatched. No project setting was changed, no deployed readback was obtained, and no preview route was requested.

Railway production web 55254aaf-3719-4da9-a5b6-9214417101c6 and operations processor fdd13e91-dffa-400e-9a44-ae2d1f891ff0 are online and track main. The web pre-deploy includes prisma migrate deploy and reviewed-client initialization/audit. PostgreSQL and Redis are online with persistent volumes.

Destructive patch 9a3370a3-8d07-4ef9-9e8d-a57ff488fccb remains STAGED with five changes. It creates a credential-bearing Paystack diagnostic and deletes the live operations processor. It was not applied, accepted, or discarded; secret values were not read.

## Authority and residue

The October extracted client corpus exists, but this checkout lacks the two October DOCX binaries. The architect audit says the uploaded copies were reviewed independently; this runtime relies on the extracted corpus and records that claim as secondhand. The corpus leaves coverage zones and other commercial rules pending. A conflicting historical note means activation of parcel fees remains blocked pending authoritative signed resolution.

Read-only Docker inventory found an old isolated E2E app/PostgreSQL/Redis project still running; its ingress exited 255. Separate shared local Postgres and Redis services are also running. No containers, volumes, images, or services were stopped or removed.

Codex performed no production database access, migration, provider transaction, deployment, customer contact, preview route request, or service mutation.
