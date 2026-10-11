# Phase 1B storefront validation — 8 October 2026

Final source classification: **PHASE_1_PARTIAL; OVERALL_NOT_READY**. The scoped
storefront fix passes, but the single full Chromium run fails a different finance
locator. No second implementation cycle or Phase 2 work was started.

## Baseline and bounded work

- Branch `production-closure-2026-10-07`, clean starting checkout
  `e4acdf9fb8bc18143d2f314dc8cb6462dfc70ede`.
- Fetch confirms identical local/remote head and upstream on that feature branch.
  Main remains `83a4d63078efa20d4e234fe081c10e15746387d1`.
- PR #17 is OPEN DRAFT, targets main, unmerged. No merge/rebase/force push.
- Active time box: 2026-10-07 22:57 UTC to approximately 00:27 UTC (90 minutes).
- Existing Phase 1 report is preserved. Source checkpoint identity and new CI
  evidence will be appended after the normal push; this file cannot embed its
  own commit hash. Final source SHA is distinguished from any later report-only tip.
- Final source SHA: `2be819b3464f11213eeab24a2312caac17f5f0c1`, normally pushed
  and verified equal to remote HEAD. Source checkpoint diff: 7 files,
  173 insertions / 25 deletions, including the initial evidence report.

[Starting-head certification 37698348502](https://github.com/analyticsmath/KT-Courier/actions/runs/37698348502)
was allowed to finish and was never cancelled. Its browser job passed 88/88,
zero skipped/flaky/retried, full selection 253.758 s. Catalog 1440/both passed 2/4;
employee 1440/both passed 1/2. All 24 component jobs succeeded; the final `certified`
manifest gate FAILED because nine later-phase requirements remain open. Overall
run conclusion is FAILURE. Those results belong to starting SHA e4acdf9f, not this
new source. The older 22611f01 run's 87/88 is retained as earlier-source evidence.

## Root cause proven from real DOM

Classification A: separate active presentation and a hidden streamed staging copy,
not two active choosers or duplicated canonical variants. The older failure trace
from [37696998677](https://github.com/analyticsmath/KT-Courier/actions/runs/37696998677)
contains snapshot `after@call@6635` with the two matching anchors:

| Anchor | Relevant recorded ancestry |
|---|---|
| Active Silver / 128GB link | `BODY > DIV > MAIN#main-content > … > MAIN#storefront-content > … > SECTION[aria-label="Purchase product"]` |
| Hidden staging copy of the same link | `BODY > DIV#S:1[hidden=""] > MAIN#storefront-content > … > SECTION[aria-label="Purchase product"]` |

Both hrefs are `/shop/products/e2e-smartphone-CP-E2ESMARTPHONE/CV-E2E128GB`.
The accessibility snapshot and screenshot show one actionable option. Earlier
snapshots show the staging anchor before it is presented and then the active
anchor. A global CSS href locator searches hidden DOM too and races streaming.
The component already deduplicates offers with `Map(variantReference, offer)` and
renders the variant chooser once. No projection or canonical duplicate fix is
warranted. The passing unchanged starting-head run supports the timing diagnosis,
but does not substitute for new-SHA validation.

The chooser now has `role="group" aria-label="Available product variants"`.
Tests scope through the accessible Purchase product region into that named group
and require exactly one accessible Silver / 128GB link, its exact canonical href,
visibility and an ordinary click/keyboard Enter. Hidden staging copies are outside
the actionable accessibility tree. No `.first()`, `.last()`, `.nth()`, forced click,
sleep, skipped case, retry inflation, response mock or positional CSS is added.

## Minimal changed paths

| Path | Change |
|---|---|
| `components/public-v2/commerce/ProductDetailExperience.tsx` | Name the existing variant group; no prices, selected-state, seller, visibility or layout changes. |
| `tests/e2e/storefront-browsing.spec.ts` | Exact named group/link scope; execute same case at 1440x900 and 390x900; verify initial checked seller/price, canonical URL/title/updated price, overflow, explicit unavailable-item handling and clean console. |
| `tests/e2e/storefront-product-detail.spec.ts` | Preserve keyboard Enter, canonical price, reload and unchanged-cart proof; scope through the same unique semantic chooser. |
| `tests/ui/storefront-variant-group.test.ts` | Server-render the real component, parse actual HTML and prove one named chooser / one link per canonical variant despite multiple seller offers. |
| `scripts/phase1-browser-plan.mjs` | Prepend the single storefront variant target (1 case) and existing product-detail/keyboard spec (4 cases), before existing catalog/employee stages and one full 88-case selection. Existing zero-retry/skip/flaky/count/SHA guards stay intact. |
| `scripts/phase1-browser-plan.test.mjs` | Update required order/count contract and missing-case rejection for the new first stage. |
| This report | Evidence, baseline, restricted-scope boundary and final checkpoint results. |

Browser discovery remains 88 cases in 25 files; viewport checks loop within the
existing variant case and do not inflate discovery. No Prisma schema/migrations,
permission bootstrap, catalog commands, finance locks, production workflow trigger,
or engineering-gate statuses are changed.

## Local observations and exact-source CI

| Command / observation | Actual result |
|---|---|
| `npm run typecheck` | PASS before local target; rechecked after HTML-parser test harness change. |
| ESLint on all changed TS/TSX paths, explicit `--no-ignore` on both changed runner modules; `git diff --check` | PASS. |
| `node --test scripts/phase1-browser-plan.test.mjs scripts/production-certification-workflow.test.mjs scripts/certification-output.test.mjs` | 13 passed / 0 skipped / 0 todo / 0 failed, 0.139 s, exit 0. |
| Bounded `docker version --format '{{.Server.Version}}'` | Server 29.4.2 available, exit 0. |
| `node scripts/e2e-test.mjs tests/e2e/storefront-browsing.spec.ts --grep='product detail page displays store' --project=chromium --retries=0 --workers=1` | Infrastructure FAIL, exit 1: Docker Next application build could not allocate memory. Playwright never started; zero browser cases executed. Existing disposable-runner cleanup ran. No Docker reset/shared-volume cleanup or retry attempted; acceptance moves to isolated CI. |
| Initial scoped unit command | 63 existing assertions passed; new JSDOM test suite setup failed because browser GSAP imports require matchMedia. Test harness changed to Node server rendering / typed HTML parsing; runtime source was unaffected. |
| Corrected scoped Vitest command | 64 passed / 10 files / 0 skipped / 0 failed, 2.37 s, exit 0. |

Scoped command:
`node node_modules/vitest/vitest.mjs run tests/ui/storefront-variant-group.test.ts tests/public-v2/pdp-three-column-layout.test.ts tests/ui/store-catalog-wizard-label.test.ts tests/security/store-catalog-authority.test.ts tests/auth/permission-bootstrap.test.ts tests/auth/permissions.test.ts tests/api/catalog-store-api.test.ts tests/api/catalog-media-store-api.test.ts tests/client-platform/employees.test.ts tests/infrastructure/seed-idempotency-contract.test.ts --reporter=default`.

The first local results concern working source based on e4acdf9f. The committed
rechecks and CI evidence below explicitly identify the new source SHA. Earlier
source results are not claimed as new-head acceptance.

The scoped Vitest command was rerun at committed source `2be819b3`: **64 passed,
10 files, zero skipped/failed**, 2.22 s. The three Node runner/workflow contract
files were also rerun at that commit: **13 passed, zero skipped/todo/failed**,
0.116 s. These are local execution results at the exact source commit.

New exact-source runs:
[CI 37700812272](https://github.com/analyticsmath/KT-Courier/actions/runs/37700812272)
and [Production Certification 37700812430](https://github.com/analyticsmath/KT-Courier/actions/runs/37700812430).
Both declare head SHA `2be819b3464f11213eeab24a2312caac17f5f0c1`.

### Exact-source component evidence

Artifact counts below all record the exact source SHA above. Selections overlap
the complete coverage run and are not added together as unique test totals.

| Selection | Passed / failed / skipped / flaky | Wrapper duration |
|---|---|---|
| `test:coverage` | 3497 / 0 / 0 / 0 | 101.475 s |
| `test:payments` | 333 / 0 / 0 / 0 | 6.028 s |
| `test:refunds` | 101 / 0 / 0 / 0 | 2.859 s |
| `test:security:bola` | 23 / 0 / 0 / 0 | 1.618 s |
| `test:processors` | 22 / 0 / 0 / 0 | 1.508 s |
| `test:integration:closure` | 160 / 0 / 0 / 0 | 109.595 s |
| `test:integration:redis-rate-limit` | 7 / 0 / 0 / 0 | 5.280 s |
| `test:integration:bola-authority` | 10 / 0 / 0 / 0 | 72.046 s |

Quality job `113063550445` is SUCCESS, including configured lint, Next build,
typecheck, Prisma generation/validation, migration check, production dependency
audit, runner contract tests and all five quality test selections. All twenty
PostgreSQL command jobs are SUCCESS. Redis/security job `113063550281` and
recovery job `113063550517` are SUCCESS. Recovery used disposable fixtures;
production protected rows were not touched. Browser job `113063550544` FAILED;
the final `certified` job `113067341175` was SKIPPED because browser failed.

### Browser stages and precise remaining blocker

The CI command was
`node scripts/certification-command.mjs test:e2e -- --project=chromium --phase1-catalog`.
Each stage executes `node node_modules/playwright/cli.js test` with its selection,
`--project=chromium --retries=0 --workers=1 --reporter=list,json` and separate
failure-artifact directories. The target uses `tests/e2e/storefront-browsing.spec.ts`
with `--grep=product detail page displays store`; product detail selects the
existing `tests/e2e/storefront-product-detail.spec.ts`. Catalog selects
`store-product-catalog.spec.ts` and `catalog-administration.spec.ts`; employee
selects `business-employee-access.spec.ts`. Desktop stages add `--grep=1440px`.
Full Chromium has no filename/grep restriction. All stage records contain source
SHA `2be819b3464f11213eeab24a2312caac17f5f0c1`.

| Ordered stage | Passed / failed / skipped / flaky | Duration | Result |
|---|---|---|---|
| Storefront variant target, 1440 and 390 within one case | 1 / 0 / 0 / 0 | 7.460 s | PASS |
| Existing product-detail spec, including keyboard Enter | 4 / 0 / 0 / 0 | 9.275 s | PASS |
| Catalog 1440 | 2 / 0 / 0 / 0 | 25.171 s | PASS |
| Catalog both 1440/390 | 4 / 0 / 0 / 0 | 41.383 s | PASS |
| Employee 1440 | 1 / 0 / 0 / 0 | 12.871 s | PASS |
| Employee both 1440/390 | 2 / 0 / 0 / 0 | 19.430 s | PASS |
| Full Chromium, 88 discovered cases | 87 / 1 / 0 / 0 | 251.897 s | FAIL |

All executions used zero retries. The target verified initial checked seller and
R1500 price, exactly one actionable Silver/128GB link, ordinary click, canonical
URL/title and R2000 price, invalid-variant safe handling, no overflow and clean
console at both widths. The keyboard case verified Enter, reload persistence,
canonical price and unchanged cart. Native catalog and employee journeys passed
at both widths without modifying their implementation.

The remaining full-suite failure is
`tests/e2e/withdrawal-finance-admin.spec.ts:101`, test
"finance reviews, rejects with released capacity and investigates an uncertain
payout at 1440px" (declared at line 32). Its global
`page.getByText(second.destination.maskedLabel, { exact: true })` matches six
`td[data-label="Masked destination"]` cells bearing the same disposable masked
label. `toBeVisible()` fails strict uniqueness. This is a separate finance-table
locator ambiguity; the actual DOM root cause and appropriate operation/row scope
remain uninvestigated. Do not infer a payout/provider defect or production risk
from this assertion alone. No finance test/source correction, retry or repeated
manual full-suite run was attempted. The original storefront test also passed
within the full suite. Failure-only trace/screenshot/video and sanitized reports
are retained in restricted GitHub artifacts and ignored local output; none is
committed or claimed as human visual approval.

### Final manifest and checkpoint handoff

Source CI `37700812272` completed SUCCESS. Source Production Certification
`37700812430` completed FAILURE: 23 component jobs SUCCESS, browser FAILURE,
and `certified` SKIPPED. At this source the final manifest was **not executed**;
its absence cannot be described as an open-gates-only failure. Starting-head run
`37698348502` did execute it and FAILED on the nine genuine later-phase gates.
Those same unchanged manifest keys remain blocking:
`marketplace_parcel_classification`, `notification_required_domains`,
`commercial_financial_certification`,
`customer_vendor_driver_full_functional_acceptance`, `visual_acceptance`,
`media_full_functional_acceptance`, `critical_skip_closure`,
`fresh_production_protected_row_audit`, and `github_certification_and_deployment`.

This final evidence update is a legitimate report-only checkpoint on top of the
frozen source. Its automatic PR runs, if still pending at handoff, are PENDING for
that new tip; the source results above must not be relabeled as report-tip proof.
No workflow dispatch/rerun was requested to chase a green result. Remote equality,
draft PR status and unchanged main are rechecked after the report push. Stop for
architect review; approve a separate bounded investigation of the finance-table
ambiguity before considering complete Phase 1 acceptance.

## Preserved boundaries and later work

Nine existing `prisma/seed.ts` explicit `--no-ignore` any findings remain advisory
debt; seed is unchanged and excluded from configured lint. Default lint is not
described as failing. Any new configured-lint/typecheck regression blocks acceptance.

The nine browser placeholders remain unchanged: customer-wallet-refunds,
marketplace-checkout-payment, refund-finance-admin, store-order-accessibility,
store-order-admin, store-order-customer, store-order-handoff, store-order-merchant,
store-order-substitution (`tests/e2e/*.spec.ts`). Their gates remain open.

No deployment, merge, Vercel/Railway change, production data/configuration read or
mutation, Paystack/Cloudinary live operation, financial activation, secret/trace
commit, false human approval or actual-device claim occurred. Railway staged patch
`9a3370a3-8d07-4ef9-9e8d-a57ff488fccb` is untouched; its last known status remains
STAGED / NOT APPLIED. Server origin configuration, protected-row audit, commercial
inputs, real provider/device/backup acceptance and human approvals remain later work.

Next recommended batch is the financial and store-order browser placeholders,
subject to senior architect authorization. Nothing in Phase 2 is implemented here.

## Complete source-run job inventory

Run 37700812430; SHA 2be819b3464f11213eeab24a2312caac17f5f0c1; conclusion FAILURE.

| Job | ID | Conclusion |
|---|---|---|
| redis-and-recovery | 113063550281 | SUCCESS |
| postgres (test:integration:permissions) | 113063550424 | SUCCESS |
| quality | 113063550445 | SUCCESS |
| postgres (test:integration:payment-foundation) | 113063550456 | SUCCESS |
| postgres (test:integration:cross-module) | 113063550459 | SUCCESS |
| postgres (test:integration:driver-operations) | 113063550483 | SUCCESS |
| postgres (test:integration:dispatch) | 113063550484 | SUCCESS |
| postgres (test:integration:store-earnings) | 113063550486 | SUCCESS |
| postgres (test:integration:pricing) | 113063550491 | SUCCESS |
| recovery | 113063550517 | SUCCESS |
| postgres (test:integration:auth) | 113063550523 | SUCCESS |
| postgres (test:integration:withdrawals) | 113063550524 | SUCCESS |
| postgres (test:integration:orders) | 113063550532 | SUCCESS |
| postgres (test:integration:driver-earnings) | 113063550535 | SUCCESS |
| browser | 113063550544 | FAILURE |
| postgres (test:integration:ledger) | 113063550547 | SUCCESS |
| postgres (test:integration:marketplace-checkout) | 113063550558 | SUCCESS |
| postgres (test:integration:store-orders) | 113063550628 | SUCCESS |
| postgres (test:integration:refunds) | 113063550639 | SUCCESS |
| postgres (test:integration:catalog) | 113063550656 | SUCCESS |
| postgres (docker:migration-smoke) | 113063550671 | SUCCESS |
| postgres (test:integration:closure) | 113063550703 | SUCCESS |
| postgres (test:integration:storefront) | 113063550707 | SUCCESS |
| postgres (docker:gate4) | 113063550738 | SUCCESS |
| certified | 113067341175 | SKIPPED |

Run 37700812272; SHA 2be819b3464f11213eeab24a2312caac17f5f0c1; conclusion SUCCESS.

| Job | ID | Conclusion |
|---|---|---|
| container-build | 113063549832 | SUCCESS |
| pricing-integration | 113063549955 | SUCCESS |
| Phase 1 Release-Critical Verification (Paystack, Invariants, Security, Processors, Refunds) | 113063549978 | SUCCESS |
| Phase 1 PostgreSQL Webhook Concurrency Integration | 113063550115 | SUCCESS |
| migration-smoke | 113063550131 | SUCCESS |
| docker-runtime | 113063550157 | SUCCESS |
| cross-module-integration | 113063550174 | SUCCESS |
| ledger-integration | 113063550189 | SUCCESS |
| quality | 113063550193 | SUCCESS |
| dispatch-integration | 113063550363 | SUCCESS |
| store-earning-e2e | 113063550908 | SKIPPED |
| store-earning-integration | 113063550988 | SKIPPED |
| withdrawal-e2e | 113063550995 | SKIPPED |
| Legacy PayFast Confirmation E2E (Compatibility) | 113063551024 | SKIPPED |
| payment-foundation-integration | 113063551071 | SKIPPED |
| driver-earning-e2e | 113063551227 | SKIPPED |
| withdrawal-integration | 113063551264 | SKIPPED |
| Legacy PayFast Compatibility Integration | 113063551275 | SKIPPED |
| storefront-accessibility | 113063551466 | SKIPPED |
| Legacy PayFast Checkout E2E (Compatibility) | 113063551534 | SKIPPED |
| driver-earning-integration | 113063551609 | SKIPPED |
| Legacy PayFast Confirmation Integration (Compatibility) | 113063551677 | SKIPPED |
| storefront-e2e | 113063551772 | SKIPPED |
| refund-e2e | 113063551784 | SKIPPED |
| refund-integration | 113063552092 | SKIPPED |
| payment-foundation-e2e | 113063552129 | SKIPPED |
| e2e-chromium | 113063552156 | SKIPPED |
| storefront-integration | 113063552361 | SKIPPED |
