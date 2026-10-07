# Phase 1 catalog permission recovery — 8 October 2026

Status: **PHASE_1_PARTIAL**. Overall project: **NOT_READY**.

This bounded batch follows the architect's Phase 1 directive. Payments/refunds,
the nine unrelated browser placeholders, broad role journeys, production changes
and Railway patch actions are outside scope. The original handoff is preserved.

## Baseline and stage checkpoints

- Started at `fc76784a94eb5b536104a11e062f6c17407ca580`, clean worktree,
  branch `production-closure-2026-10-07`.
- `origin/main` remains `83a4d63078efa20d4e234fe081c10e15746387d1` after fetch.
- PR #17 is OPEN DRAFT, targets main, unmerged.
- Active-work budget starts 2026-10-07 22:11 UTC (8 October Asia/Karachi);
  stop by approximately 00:11 UTC if acceptance is incomplete.
- Stage A candidate uses commit subject
  `fix: align disposable store catalog role grants and fail-closed authority`.
  Its SHA and actual CI evidence will be appended after the push. This report
  cannot contain its own commit hash; final tip is resolved from the remote ref.
- Stage B candidate and acceptance results are recorded below. Stage C: pending.

## Stage A root cause and authority changes

The older run `37681988666` tested
`909f5f1400a46c963f4cd23e07c0efbab4dfcb3c`, not the checkpoint. It passed
148 closure PostgreSQL assertions and 23 non-browser certification jobs, but
browser returned 82 passed / 4 failed and final certification was skipped.
Both moderation viewports received normalized-upload 403 with the exact body
`Catalog permission is required.` The other two cases could not locate the
VAT-inclusive price label. This phase does not attribute those older results
to its new source.

Foundation seed created permission definitions and only ADMIN/SUPER_ADMIN
grants. Catalog authority requires an enabled STORE role grant unless an explicit
user override applies. The existing canonical `ROLE_DEFAULT_PERMISSION_KEYS`
already includes STORE catalog read/manage/submit, pricing, inventory and imports
defaults, so seeded store owners were incorrectly refused.

The shared canonical installer now uses that registry. Foundation initialization
creates only missing defaults and preserves disabled role rows and all explicit
user ALLOW/DENY overrides. The existing authorized administrator sync reuses this
installer with its prior explicit re-enable policy. SUPER_ADMIN defaults reflect
the grants already issued by foundation seed; no new administrative grant is
added to STORE or CUSTOMER. No production seed, sync or grant mutation is run.
Shared seed source changes affect a future explicitly authorized initialization;
they do not retroactively grant any live account access.

Catalog's permission-table-empty success shortcut is removed. Missing definition
or enabled grant fails closed. Canonical active user, store and products-module
membership is checked before overrides. Anonymous callers retain 401;
authenticated unauthorized callers 403; foreign media retains the existing generic
403 ownership refusal, while foreign product/offer lookup retains 404 concealment.

Products-only employees remain CUSTOMER identities. Module delegation grants only
catalog read/manage/submit, using a central product permission subset. Pricing,
inventory and imports require a separate explicit user grant; finance/admin keys
are not catalog permissions and cannot be granted through this evaluator. DENY
still defeats role defaults. Even explicit ALLOW cannot admit an unrelated,
disabled/removed or wrong-module employee. Both normalized upload's business API
check and catalog permission check remain composed; no anti-CSRF bypass changes.

## Exact Stage A file changes

| File | Change |
|---|---|
| `lib/auth/permission-bootstrap.ts` | Extract canonical installer with additive defaults and an explicit admin-sync re-enable option; no user override writer. |
| `lib/auth/permission-keys.ts` | Central product-delegation subset; STORE defaults reuse it; SUPER_ADMIN registry reflects existing seed authority. |
| `lib/auth/permissions.ts` | Existing explicit sync delegates to the same installer; other general permission evaluation remains unchanged. |
| `prisma/seed.ts` | Replace ADMIN-only initialization loops with additive canonical installer; no production invocation. |
| `lib/catalog/catalog-auth.ts` | Remove empty-table allowance, resolve canonical tenant before grants, restrict implicit employee delegation to product work. |
| `tests/security/store-catalog-authority.test.ts` | Fourteen executable HTTP/authority cases covering normalized-route composition, missing/disabled grants, DENY, employee scope, tenant/status and anonymous refusal. |
| `tests/auth/permission-bootstrap.test.ts` | Repeated canonical installation preserves disabled rows and never writes user overrides. |
| `tests/integration/catalog-permission-bootstrap-postgres.integration.test.ts` | Three guarded real-DB cases for idempotent grants/override preservation, employee revocation and safe foreign-media concealment. |
| `scripts/disposable-closure-tests.mjs` | Include the new guarded authority suite in the existing disposable runner. |
| `tests/api/catalog-store-api.test.ts` | Update existing source-contract assertion for centralized canonical tenant resolution. |
| `tests/infrastructure/seed-idempotency-contract.test.ts` | Existing contract checks follow the shared installer instead of the removed duplicate seed loops. |

No schema or migration changes. Both previously reviewed migrations remain intact.
No unrelated `engineering-gates.json` entry is changed or upgraded.

Stage A pushed candidate: `fb60594a1f0d88769c1226a08454601f4910d147`.
PR-triggered [run 37695527118](https://github.com/analyticsmath/KT-Courier/actions/runs/37695527118)
executed closure PostgreSQL: 158 passed / 2 failed / 0 skipped, 20 files,
32.59 s, exit 1 (`node scripts/certification-command.mjs test:integration:closure`).
Both actual grant/override and products-only employee authority cases passed.
One new foreign-media expectation incorrectly asserted 404 rather than the existing
403 + `CATALOG_OWNERSHIP_DENIED` contract; corrected without changing policy.
An existing checkpoint product test created two distinct listings with the same
unique store modifier name; the second fixture now uses a distinct name. Catalog
integration independently reproduced those same two failures (63 passed / 2 failed,
12 files, 8.70 s, exit 1). These failures remain recorded; corrected fixtures await CI.

At follow-up `c8f5e51d9437a1c07236212a76c0a5221484cd72`,
[run 37696115895](https://github.com/analyticsmath/KT-Courier/actions/runs/37696115895)
passed all three actual PostgreSQL authority cases. Catalog integration returned
64 passed / 1 failed / 0 skipped, 12 files, 11.27 s, exit 1. The remaining checkpoint
fixture set GLOBAL_CANONICAL but retained sourceStoreId, violating the existing
scope check constraint. It now clears sourceStoreId for a valid synthetic negative
source; no migration, runtime policy or constraint is changed.

## Stage B native acceptance candidate

The existing wizard label normalizer already trims the punctuation-derived trailing
hyphen so its `htmlFor` matches `vat-inclusive-price-zar`. A new DOM unit test mounts
the real wizard, navigates to Price, resolves `label.control`, verifies one unique
control/label and keyboard focus. It passes. Native acceptance additionally uses
the exact label, checks visibility/uniqueness, and enters 19.25 by keyboard.

| File | Bounded Stage B change |
|---|---|
| `tests/ui/store-catalog-wizard-label.test.ts` | One actual rendered DOM regression; no selector bypass or duplicated label implementation. |
| `tests/e2e/store-product-catalog.spec.ts` | Unique modifier names allow repeated acceptance on the same disposable store; assert safe normalized DTO fields; real price-label keyboard entry; restrict lost-response interception to PATCH. |
| `tests/e2e/business-employee-access.spec.ts` | Assert granular inventory/import/pricing API denial and inventory/import page denial for products-only employees. |
| `tests/integration/catalog-listing-draft-postgres.integration.test.ts` | Correct distinct-subject modifier and valid GLOBAL_CANONICAL negative fixtures, preserving existing constraints. |
| `scripts/phase1-browser-plan.mjs` | Fixed catalog 1440 (2), catalog both (4), employee 1440 (1), employee both (2), then full Chromium (88), only advancing on exact passing counts with zero failures/skips/flaky and retries 0; records SHA/command/exit/duration per stage. |
| `scripts/phase1-browser-plan.test.mjs` | Test ordered required selections and refusal of missing/count-mismatched/skipped/flaky/failed evidence. |
| `scripts/e2e-test.mjs` | Optional Phase 1 sequence reuses the existing isolated database, built application, safety gates and cleanup. |
| `.github/workflows/production-certification.yml` | Browser job invokes the bounded sequence and retains structured reports separately from failure-only media; unit job includes runner regression. Trigger changes remain Stage C. |

Before Stage B checkpoint: scoped unit/API/DOM command (the Stage A seven files plus
`tests/ui/store-catalog-wizard-label.test.ts`) passed 56 tests / 8 files / 0 skips,
2.82 s, exit 0. `node --test scripts/phase1-browser-plan.test.mjs` passed 2 / 0 skips,
0.158 s, exit 0. Changed-file explicit ESLint and diff whitespace checks passed.
`node node_modules/playwright/cli.js test --project=chromium --list` discovered exactly
88 cases in 25 files. Discovery is not execution proof. Native execution is pending
the Stage B exact commit CI; no browser flow is declared complete yet.

Stage B checkpoint: `ca0eddbe75a0cbce840fde84e3ed13f4701ca188`.
PR-triggered [run 37696603531](https://github.com/analyticsmath/KT-Courier/actions/runs/37696603531)
completed `node scripts/certification-command.mjs test:integration:catalog` with
65 passed / 12 files / 0 skips, 12.63 s, exit 0, including all 17 listing/product/
moderation transaction tests and all 3 authority tests. Closure and native browser
were still running when Stage C was prepared. Pushing Stage C may cancel the older
run through the existing concurrency policy; its incomplete jobs are not passes.

## Stage C trigger and exact-head reporting

| File | Change |
|---|---|
| `.github/workflows/production-certification.yml` | Remove PR paths filter; all main PR updates eligible; preserve dispatch/release tags; every job explicitly checks out PR head SHA or dispatch/tag SHA; preserve all isolated jobs, strict wrappers and final engineering manifest gate. |
| `scripts/certification-command.mjs` | Verify actual checkout against requested head before execution, print SHA/command and record arguments, duration, exit and parsed execution counts. |
| `scripts/certification-output.mjs` | Parse failure-first Vitest and multi-stage Playwright summaries; retain every execution; reject mismatched/invalid SHA identities. Skip/flaky policy remains intact. |
| `scripts/certification-output.test.mjs` | Regression checks for failure counts, ordered browser summaries and exact SHA mismatch rejection. |
| `scripts/production-certification-workflow.test.mjs` | Parse actual workflow YAML; assert all-main-PR eligibility, dispatch/tags, all exact-head checkouts, 20 disposable PG selections, isolated provider config and final manifest gates. |

`node --test scripts/certification-output.test.mjs scripts/production-certification-workflow.test.mjs scripts/phase1-browser-plan.test.mjs scripts/e2e-ingress.test.mjs scripts/release-test-deferrals.test.mjs scripts/e2e-standalone-app.test.mjs`
passed 27 tests / 0 skips / 0 todo, 1.107 s, exit 0 on the Stage C working source.
Explicit changed-file ESLint and `git diff --check` passed. Workflow static tests
prove eligibility; the new PR-triggered run and exact candidate acceptance results
will be recorded after push. No subscription/promoter/recruitment feature activation
or production job is added. Stage C does not turn any unresolved gate green.

## Completed and pending commands

Stage A working source is the candidate committed under the subject above.
These local results are pre-push observations, not completed exact-SHA CI proof.

| Command | Files / tests | Skips | Duration | Exit / result |
|---|---|---|---|---|
| `node node_modules/vitest/vitest.mjs run tests/security/store-catalog-authority.test.ts tests/auth/permission-bootstrap.test.ts tests/auth/permissions.test.ts tests/api/catalog-store-api.test.ts tests/api/catalog-media-store-api.test.ts tests/client-platform/employees.test.ts tests/infrastructure/seed-idempotency-contract.test.ts --reporter=default` | 7 / 55 | 0 | 1.91 s | 0 / PASS |
| `npm run typecheck` | TypeScript source, no assertion count | N/A | Not separately timed | 0 / PASS |
| Changed-file ESLint, excluding normally ignored seed | Source checks | N/A | Not separately timed | 0 / PASS |
| `node node_modules/eslint/bin/eslint.js --no-ignore prisma/seed.ts scripts/disposable-closure-tests.mjs` | Seed / runner | N/A | Not separately timed | 1 / FAIL: nine existing seed `any` casts, unchanged by this phase |
| Explicit `--no-ignore` lint of the closure runner | Runner | N/A | Not separately timed | 0 / PASS |
| Bounded `docker version` availability read | Infrastructure | N/A | Immediate refusal | 1 / FAIL: Docker Linux engine pipe missing; no reset/repair attempted |
| `git diff --check` | Changed files | N/A | Fast | 0 / PASS |
| Actual PostgreSQL authority and prior product/employee cases | Pending isolated CI | Unknown until execution | Pending | NOT RUN locally |
| Native catalog / employee E2E, 1440 / 390 | Pending | Unknown until execution | Pending | NOT RUN in Phase 1 yet |

The 201 normalized-route unit case mocks image storage and is authorization proof,
not physical upload proof. Actual normalized raster upload must pass in the native
disposable browser before Phase 1 can pass. Local logs stay in ignored
`output/production-closure/phase1-*`; credential-bearing traces are not committed.

## Preserved later-phase blockers and production boundary

The following nine critical placeholders remain unchanged:

- `tests/e2e/customer-wallet-refunds.spec.ts`
- `tests/e2e/marketplace-checkout-payment.spec.ts`
- `tests/e2e/refund-finance-admin.spec.ts`
- `tests/e2e/store-order-accessibility.spec.ts`
- `tests/e2e/store-order-admin.spec.ts`
- `tests/e2e/store-order-customer.spec.ts`
- `tests/e2e/store-order-handoff.spec.ts`
- `tests/e2e/store-order-merchant.spec.ts`
- `tests/e2e/store-order-substitution.spec.ts`

No merge, deployment, production data/configuration/grant changes, money operation,
Cloudinary production write, notification/COD/commission activation or client
configuration invention occurred. Proxy source is unchanged; verified Vercel
`RAILWAY_PRODUCTION_ORIGIN` remains a later release blocker. Railway patch
`9a3370a3-8d07-4ef9-9e8d-a57ff488fccb` is **STILL STAGED — NOT APPLIED**
at the last prior-session observation (19:39 UTC); this phase neither queries nor
applies/discards it. Current full certification remains blocked by later phases.
