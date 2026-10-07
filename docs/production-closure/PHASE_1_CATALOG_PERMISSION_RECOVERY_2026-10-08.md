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
- Stage B: pending. Stage C: pending.

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
authenticated unauthorized callers 403; existing cross-tenant media/service
concealment retains 404.

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
