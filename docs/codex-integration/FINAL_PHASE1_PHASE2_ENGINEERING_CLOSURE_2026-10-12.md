# Phase 1 and Phase 2 engineering closure — 12 October 2026

## Verdict

**PHASE2_INCOMPLETE.** The latest local engineering candidate is 2cd712bbe1aa27717dc78ff732f87b9e8360cafe, tree fceeb7d0df67f07af4ff41874fbff76b1553aae2. Its focused exact-source workflow checks and lint pass. Broader application receipts remain bound to aa0a3af7a80855161c8b8c0a065106abf019e7f5. No hosted certification exists for the new candidate.

**PUBLISH_BLOCKED_PREVIEW_ISOLATION. HOSTED_EVIDENCE_BLOCKED. MAIN_MERGE_BLOCKED_PRODUCTION_DEPLOYMENT_RISK. PRODUCTION_NOT_READY.** The linked Vercel project has recent previews and a catch-all rewrite to live Railway. The project API readback did not provide a verifiable preview-disable setting, and no independent branch exclusion was observed. A Vercel source rule was added for this branch, but source-only configuration does not meet the mandatory pre-publication readback gate. Railway still deploys web and the operations worker from main; web pre-deploy applies Prisma migrations. No push, PR update/create, hosted run, main push, deployment, or branch deletion was performed.

## Engineering work completed locally

Regular CI previously used actions/checkout's default pull-request ref. That can test GitHub's synthetic merge commit instead of the submitted head. All 28 CI checkout steps now use the pull-request head SHA, with the event SHA as fallback for non-PR runs. A regression test counts all checkout actions and validates every ref, plus contents-only token permissions, absence of repository secret references, disabled Paystack activation, console email, offline test mode, and the Vercel branch setting. [GitHub's workflow event reference](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows) documents the pull-request merge ref and event head SHA.

The source-level Vercel rule suppresses automatic Git deployment for integration/codex-phase1-phase2-2026-10-11 and leaves main unmatched. Existing rewrites, headers, and aliases were preserved. The rule passed JSON and official schema validation. [Vercel's Git configuration reference](https://vercel.com/docs/project-configuration/git-configuration) says a matching false disables deployments and unlisted branches default to enabled. This local edit is defense in depth; the connected project has not read it back, and existing previews were not isolated by this change.

Validation against candidate commit 2cd712bbe1aa27717dc78ff732f87b9e8360cafe:

- npm run lint: PASS.
- node --test scripts/production-certification-workflow.test.mjs: 6 passed, 0 failed, 0 skipped.
- CI YAML parse and exact-ref inspection: PASS, 28 of 28 checkout steps.
- vercel.json parse and Vercel schema check: PASS.
- Release-test inventory: 65 files with skip/deferred markers; zero open release-critical placeholders. The gate remains OPEN until the required selections are reconciled and executed against the final candidate SHA.
- git diff --check: PASS.

The prior local application run remains separately attributed to aa0a3af7a80855161c8b8c0a065106abf019e7f5 and tree 9567d168a78b75b89299784c3b13b82aa27ba522: directed Chromium 42/42, full Chromium 139/139, canonical PostgreSQL 41/41, closure PostgreSQL 178/178, strict PostgreSQL BOLA 10/10, Redis 7/7, and coverage 3748/3748. Application files and migration tree are unchanged in the new candidate, but those historical receipts do not become a full-tree 2cd712bb run. Production-only dependency audit passed; full development audit still has five high reports in the transitive braces 3.0.3 chain.

## Candidate and ancestry

The local candidate descends from the tested source and evidence commit. origin/main remains 83a4d63078efa20d4e234fe081c10e15746387d1 and is an ancestor. The candidate contains the approved Phase 1 implementation and Phase 2 branch merge, but excludes the four diagnostic .tmp-driver files added by the latest Phase 1 report-branch tip 9612d8366e54e3492a80c53d63753b0af01a6c47. The legacy migration branch still has five unique commits and must remain preserved.

## Acceptance boundary

The release manifest remains NOT_READY with six OPEN gates and three VALIDATION_BLOCKED gates. External tariff and coverage decisions, live communications and media acceptance, complete cross-role functional acceptance, visual/device acceptance, production protected-row review, release approval, and safe deployment automation remain unproven. The October extracted authority corpus is present, but this checkout does not contain its two newest DOCX binaries. Commercial values and activation remain pending where the authoritative record is unresolved.

This closure does not certify a production release, hosted source, client sign-off, finance or bank approval, legal approval, provider acceptance, or production data review.
