# Phase 1C finance browser gate — 8 October 2026

Classification: **PHASE_1_BROWSER_ENGINEERING_PASS; OVERALL_NOT_READY**.
All 88 browser cases and all 24 component jobs passed at the final source SHA.
The final manifest failed only on the nine genuine unchanged later-phase gates.
No Phase 2 work, production mutation or deployment.

## Checkpoint identities and boundaries

- Starting SHA: `83d04dca73e692fb19b356a95ae21086a327d2b7`.
- Initial candidate SHA: `494365d0335178dde03d1d1b90b484516697dd78`.
- Final source SHA: `1a7a7d0cd1612d0f031ec8e0682da83569df2646`.
- Branch: `production-closure-2026-10-07`; fetched/pruned, initially clean,
  local/upstream/remote identical. No concurrent branch advance was found.
- Main remains `83a4d63078efa20d4e234fe081c10e15746387d1`.
- PR #17 is OPEN DRAFT, unmerged. Source push was normal, without force.
- This report is committed separately after source validation. Its report-tip
  SHA is recorded independently in the final checkpoint response; source evidence
  is never attributed to that later documentation tip. The commit adding this
  file cannot embed its own Git hash.
- Active work started 2026-10-07 23:48:47 UTC; 75-minute stop approximately
  2026-10-08 01:03:47 UTC.

Starting-head [CI 37702257674](https://github.com/analyticsmath/KT-Courier/actions/runs/37702257674)
completed SUCCESS. Starting-head
[certification 37702257705](https://github.com/analyticsmath/KT-Courier/actions/runs/37702257705)
was IN_PROGRESS before edits, with its browser job `113068241002` already SUCCESS.
Its exact-83d04dca browser artifact proves full 88/88, zero skipped/flaky/retried,
257.032 s; focused storefront 1/1, product detail 4/4, catalog both 4/4 and employee
both 2/2. This corroborates timing sensitivity, not new-source acceptance.
The certification run ultimately concluded CANCELLED when the normal source push
triggered the unchanged workflow's `cancel-in-progress: true` concurrency policy.
The unfinished refund job `113068240927` had remained in `npm ci`; it and the final
`certified` job were cancelled. No manual cancellation was requested. Do not claim
the starting certification passed in full.

## Root cause reconstructed from the actual failure trace

Evidence is the failure-only browser artifact from source `2be819b3`, certification
[37700812430](https://github.com/analyticsmath/KT-Courier/actions/runs/37700812430),
job `113063550544`. Only synthetic values, safe counts and route structure are
reported. Raw trace/network contents remain ignored locally/restricted in CI.

| Trace event | Observed DOM/navigation evidence |
|---|---|
| `after@call@7087` | URL `/admin/payout-destinations`; six visible list cells with the same synthetic masked label, no hidden ancestry on those six cells; exactly one link bearing the selected public reference, with the correct encoded detail href. |
| `call@7089` | Ordinary click on that public-reference link, starting from the list route. |
| `call@7091` | API read of the selected destination; this request is independent of completing page navigation. |
| `before@call@7094` | Browser URL still the list route when the global masked-label visibility assertion starts. Snapshot nodes use trace reference compression; zero raw-node counts here are not interpreted as absence. |
| Assertion error | Global exact-text locator resolves to six `td[data-label="Masked destination"]` list cells, so strict uniqueness fails immediately. |
| `after@call@7094` | URL reaches the selected detail route; header description equals the selected public reference, and actual detail DOM has one `Masked label` term and one corresponding masked definition. |

The page click initiates client navigation, while the following API read supplies
no navigation barrier. Repeated masked metadata is legitimate across different
destinations and cannot identify an entity. The assertion races the old list DOM;
it must first wait for the exact destination route and then assert the selected
record's definition. Unlike the prior storefront incident, the six observed
matches here are actual distinct list rows, not hidden streamed copies. No hidden
duplicate is needed to explain this failure. Accessible role locators also exclude
hidden streamed markup if present later.

Source inspection confirms the list maps each destination's public reference to
one row/link; `EditorialTable` renders one masked cell per row. The detail route
loads by unique public reference through `getFinancePayoutDestination`, renders
that reference in the page header, and renders `dt`/`dd` pairs inside a `dl`.
The finance query selects masked metadata and does not expose wallet or external
destination references. No runtime navigation, finance or projection defect was
demonstrated. The local installed Next Link guide was read before the correction.

## Minimal source changes

Final test/orchestration-only source diff from starting head: **3 files,
37 insertions / 2 deletions**. Two legitimate source commits: initial locator fix
and the directive's one allowed concrete isolation revision.
No runtime application source or fixture changes.

| Path | Purpose |
|---|---|
| `tests/e2e/withdrawal-finance-admin.spec.ts` | Require one reference link with the correct encoded href; wait for exact detail URL; assert unique header description equals the selected public reference; require a unique visible `Masked label` term and paired definition within `main` / `dl > div`, with exact expected value. |
| `.github/workflows/production-certification.yml` | Execute the complete three-case finance spec in its own disposable invocation before the unchanged fixed Phase 1 browser invocation; enforce exactly 3 passes, zero failed/skipped/flaky and exact head identity; retain the focused report separately. |
| `scripts/production-certification-workflow.test.mjs` | Require isolated finance invocation before the full plan, exact count/SHA/status guards and separate evidence; prevent finance preflight being added to the full plan's shared fixture database. |
| This report, separate commit | Actual evidence and readiness boundary. |

The structural `dl > div` locator pairs the actual term and definition; it is not a
positional selector. The `has` term locator is relative to each candidate field.
No `.first()`, `.last()`, `.nth()`, sleep, forced click, broad global label locator,
retry increase, mock response, artificial fixture uniqueness or skipped case was
added. All business assertions remain: review/reject/released capacity, canonical
uncertain-payout transition, operation-id retry semantics, history/journals,
API omission of `externalReference` and `walletId`, no editing textboxes, overflow,
both widths and wrong-role / explicit-DENY / anonymous rejection. The existing
disposable fixture intentionally repeats masked labels and last-four metadata.

## Bounded static audit

All 25 selected Chromium files were scanned; only ten suspect assertions were
reviewed in context, within ten minutes. No other assertion was changed without
real reproduction evidence. These observations are advisory, not new blockers:

| Reviewed assertion | Static assessment |
|---|---|
| Finance destination masked label, original line 101 | Proven list-to-detail race; corrected above. |
| Owner destination masked label | Owner endpoint narrows to that owner and page heading is awaited; no duplicate failure demonstrated. |
| Finance reconciliation `UNKNOWN_PAYOUT_OUTCOME` | Generic label could be ambiguous; no failing DOM evidence here. |
| Driver reconciliation safe summary | Exact route is awaited first; repeated-text possibility unproven. |
| Store reconciliation safe summary | Exact route is awaited first; repeated-text possibility unproven. |
| Driver earning accrual journal reference | Exact route barrier exists; general-text scope remains advisory. |
| Store earning accrual journal reference | Exact route barrier exists; general-text scope remains advisory. |
| Ledger `Balanced journal` | Page loaded with goto and heading; no reproduced duplicate. |
| Ledger `Total debits` | Same loaded detail context; no reproduced duplicate. |
| Ledger `Total credits` | Same loaded detail context; no reproduced duplicate. |

Pre-existing positional selectors elsewhere remain unchanged; this audit does not
certify them or authorize a broad rewrite.

## Local checks and disposable execution

- `git diff --check`: PASS.
- `npm run typecheck`: PASS, exit 0.
- Changed-file ESLint for the finance spec and explicit `--no-ignore` runner files:
  PASS, exit 0; spec rechecked after the final relative-locator correction.
- `node --test scripts/phase1-browser-plan.test.mjs scripts/production-certification-workflow.test.mjs scripts/certification-output.test.mjs`:
  initial candidate 13 passed, zero failed/skipped/todo, exit 0 (0.730 s at
  committed 494365d0). After the permitted revision: 14 passed, zero
  failed/skipped/todo, exit 0 (0.106 s at committed 1a7a7d0c). Changed-file lint
  and diff check also pass after the revision; the TS spec did not change further.
- Discovery: 88 Chromium cases in 25 files, unchanged.
- Local `docker version` probe returned server 29.4.2. One native command was
  attempted: `node scripts/e2e-test.mjs tests/e2e/withdrawal-finance-admin.spec.ts --project=chromium --retries=0 --workers=1`.
  It stalled in the pre-database image-build phase. Host inspection showed about
  729 MB free memory; no actual resource-exhaustion error was emitted in this
  attempt. The build client and then the stalled runner were interrupted only
  after verifying their owned process identity. Approximate attempt duration:
  7.5 minutes (23:51:19 to 23:58:49 UTC). Zero browser cases executed; cleanup
  completion is unverified. No database service startup, seeding or application
  startup had been reached. No Docker reset/repair/shared-volume deletion occurred.
  No local test result is called PASS. Focused acceptance moves to isolated CI.

The existing runner sets its nonce disposable project/database, localhost browser
origins, `KT_RUNTIME_ENV=e2e`, `KT_NETWORK_DISABLED=true` and internal provider
network. Guards were inspected before the attempted execution; test environments
are not production/staging. The CI plan proves outbound application isolation
before executing any browser commands, uses zero retries/one worker and stops
before the full suite if a focused stage fails.

## Initial-candidate CI and permitted isolation correction

The first source runs declare SHA `494365d0335178dde03d1d1b90b484516697dd78`:

- [CI 37705220483](https://github.com/analyticsmath/KT-Courier/actions/runs/37705220483).
- [Production Certification 37705220513](https://github.com/analyticsmath/KT-Courier/actions/runs/37705220513).

Normal CI completed SUCCESS. Strict certification completed FAILURE: quality,
all twenty PostgreSQL commands, Redis/security and recovery SUCCESS; browser
FAILURE, final `certified` SKIPPED. Every test-command artifact in this initial
table declares **494365d0**, not final source 1a7a7d0c. Selections overlap coverage
and are not summed as unique tests.

| Executed selection | Passed / failed / skipped / flaky | Wrapper duration |
|---|---|---|
| Coverage, 770 files | 3497 / 0 / 0 / 0 | 101.860 s |
| Payments | 333 / 0 / 0 / 0 | 6.048 s |
| Refunds | 101 / 0 / 0 / 0 | 2.952 s |
| BOLA/security | 23 / 0 / 0 / 0 | 1.625 s |
| Processors | 22 / 0 / 0 / 0 | 1.536 s |
| PostgreSQL closure | 160 / 0 / 0 / 0 | 97.708 s |
| Redis rate limit | 7 / 0 / 0 / 0 | 4.719 s |
| Tenant-authority/BOLA integration | 10 / 0 / 0 / 0 | 61.050 s |

Quality includes configured lint, Next build, typecheck, Prisma generation and
validation, migration checks, production dependency audit and strict runner
contract tests. Recovery artifact states DISPOSABLE_FIXTURES, dump/restore PASS,
historical upgrade PASS, fixture counts/hashes MATCH and ledger invariants PASS;
protectedProductionDataTouched is false.

Initial focused/native stage results at 494365d0:

| Stage | Passed / failed / skipped / flaky | Duration |
|---|---|---|
| Finance 1440 | 1 / 0 / 0 / 0 | 12.811 s |
| Finance 390 | 1 / 0 / 0 / 0 | 10.147 s |
| Finance wrong-role / DENY / anonymous | 1 / 0 / 0 / 0 | 9.471 s |
| Storefront variant, both widths | 1 / 0 / 0 / 0 | 7.579 s |
| Product-detail / keyboard | 4 / 0 / 0 / 0 | 9.519 s |
| Catalog 1440 / both | 2 / 0 / 0 / 0; 4 / 0 / 0 / 0 | 23.486 / 42.619 s |
| Employee 1440 / both | 1 / 0 / 0 / 0; 2 / 0 / 0 / 0 | 12.899 / 19.601 s |
| Full Chromium | 86 / 2 / 0 / 0 | 249.774 s |

All retries were zero. The exact-source full run exposed a concrete orchestration
defect introduced by the initial preflight: focused finance and full execution
reused the same disposable database. The successful focused cases intentionally
leave UNKNOWN payout attempts and OPEN reconciliation cases. When the full suite
repeats each owner's journey, its first request at spec line 18 receives 422,
before navigation/detail assertions. Restricted trace response contains only the
public generic unavailable-withdrawal message. Source inspection of
`withdrawal-request.service.ts` shows its unresolved-reconciliation guard correctly
denies new withdrawals for that wallet. The fixture starts with 25.40; the prior
unknown request holds 5.10, so adding funds or making labels unique would not
address the reconciliation restriction. Both focused cases already proved that
the original locator fix works. No financial/security service regression was
demonstrated; the guard was doing its job.

The one allowed scoped revision changes orchestration only. It runs
`node scripts/certification-command.mjs test:e2e -- tests/e2e/withdrawal-finance-admin.spec.ts --project=chromium --retries=0 --workers=1 --output=test-results/withdrawal-finance-focused`
first. That existing runner owns a unique nonce project/database, proves outbound
isolation and cleans up its disposable project. The workflow enforces 3/0/0/0
and exact SHA, then preserves `test-e2e-finance-focused.json`. Only after success
does a second invocation execute
`node scripts/certification-command.mjs test:e2e -- --project=chromium --phase1-catalog`.
It creates a different nonce project/database and retains the existing seven-stage
storefront/catalog/employee/full plan unchanged. Initial finance additions to that
shared plan were reverted. No fixture labels, reconciliation records, balances,
policies, financial locks or guards are altered to force success.

## Final exact-source CI — completed

Final runs declare `1a7a7d0cd1612d0f031ec8e0682da83569df2646`:

- [CI 37706879793](https://github.com/analyticsmath/KT-Courier/actions/runs/37706879793).
- [Production Certification 37706879867](https://github.com/analyticsmath/KT-Courier/actions/runs/37706879867).

No manual workflow rerun/dispatch occurred. This is the
single permitted source revision for a demonstrated same-scope defect, not a
retry of unchanged source to obtain a lucky green. No further revision is allowed
in this run. Post-report automatic runs will be explicitly PENDING if unfinished.

Final-source normal CI completed SUCCESS. Strict certification completed FAILURE
overall: **all 24 components SUCCESS**, final `certified` FAILURE. Quality, all
twenty PostgreSQL jobs, Redis/security, recovery and browser are SUCCESS. The
isolated finance step also completed SUCCESS, enforcing 3 passes / 0 failures /
0 skips / 0 flaky at the exact final SHA. Full browser passed 88/88; the manifest
executed and failed on unchanged later-phase open gates, not a browser failure.

These final-source artifacts explicitly record **1a7a7d0c**, independently of the
initial-candidate table above:

| Final-source selection | Passed / failed / skipped / flaky | Wrapper duration |
|---|---|---|
| Coverage, 770 files | 3497 / 0 / 0 / 0 | 102.996 s |
| Payments | 333 / 0 / 0 / 0 | 6.109 s |
| Refunds | 101 / 0 / 0 / 0 | 2.950 s |
| BOLA/security | 23 / 0 / 0 / 0 | 1.672 s |
| Processors | 22 / 0 / 0 / 0 | 1.573 s |
| PostgreSQL closure | 160 / 0 / 0 / 0 | 104.709 s |
| Redis rate limit | 7 / 0 / 0 / 0 | 4.154 s |
| Tenant-authority/BOLA integration | 10 / 0 / 0 / 0 | 69.040 s |

Final-source recovery also records disposable fixtures, dump/restore and
historical upgrade PASS, matching fixture counts/hashes and ledger invariants
PASS, with protectedProductionDataTouched=false. No earlier-SHA result is
substituted for these final-source executions.

### Final native/browser execution

All final execution records declare
`1a7a7d0cd1612d0f031ec8e0682da83569df2646`. Focused CLI evidence identifies
1440, 390 and negative-role cases individually. All tests execute once in each
intended selection, zero Playwright retries; repeats in the later full suite use
the separate fresh disposable database.

| Final selection | Passed / failed / skipped / flaky | Duration |
|---|---|---|
| Isolated finance 1440 | 1 / 0 / 0 / 0 | CLI 8.6 s |
| Isolated finance 390 | 1 / 0 / 0 / 0 | CLI 6.3 s |
| Isolated finance negative-role / DENY / anonymous | 1 / 0 / 0 / 0 | CLI 4.7 s |
| Focused finance spec combined | 3 / 0 / 0 / 0 | Playwright 26.4 s; disposable wrapper 244.551 s |
| Storefront variant, both 1440/390 | 1 / 0 / 0 / 0 | 7.443 s |
| Existing product-detail / keyboard | 4 / 0 / 0 / 0 | 9.251 s |
| Catalog 1440 | 2 / 0 / 0 / 0 | 24.565 s |
| Catalog both 1440/390 | 4 / 0 / 0 / 0 | 43.082 s |
| Employee 1440 | 1 / 0 / 0 / 0 | 12.683 s |
| Employee both 1440/390 | 2 / 0 / 0 / 0 | 19.608 s |
| Unrestricted full Chromium | 88 / 0 / 0 / 0 | Stage 257.363 s; Playwright JSON 256.834 s |
| Full-plan disposable wrapper | Final executed selection 88 / 0 / 0 / 0 | 414.560 s |

The full Playwright JSON was checked independently: **88 result entries, all
passed, each retry=0, no extra attempts**. Its finance 1440/390/negative cases
passed in 6.364 / 5.157 / 4.050 s. Its owner suite passed 5/5: store 1440/390,
driver 1440/390 and foreign/ineligible/anonymous concealment, all first attempts.
Storefront URL/price/invalid-variant behavior, keyboard navigation/cart invariance,
catalog raster/draft/replay/moderation and employee access restrictions passed.
No successful failure-only screenshots/traces are invented as visual acceptance.

### Final manifest reason and handoff

`certified` job `113086772404` ran at the exact final source and returned FAILURE:

> NOT_READY: unresolved engineering gates

The log then lists exactly the same nine keys preserved below. No component
failed or was skipped at this final source; the final gate was executed, not
skipped. Phase 1 browser engineering acceptance passes; production release does
not. Source acceptance completed by 00:28:45 UTC, within the 75-minute budget.

Source checks are complete; this report is the separate final documentation
checkpoint. Its automatic PR CI/certification runs may remain PENDING at handoff,
and are reported separately under the report-tip SHA. No further source change,
workflow rerun, merge, deployment or Phase 2 work is performed. Architect review
is the next step. Local native execution remains unverified/interrupted; only
isolated GitHub execution supplies the passing browser acceptance evidence.

## Preserved readiness gates and recommended next acceptance

All nine critical placeholder specs are unchanged: customer-wallet-refunds,
marketplace-checkout-payment, refund-finance-admin, store-order-accessibility,
store-order-admin, store-order-customer, store-order-handoff, store-order-merchant
and store-order-substitution. The nine separate readiness gates remain unchanged:
marketplace_parcel_classification, notification_required_domains,
commercial_financial_certification, customer_vendor_driver_full_functional_acceptance,
visual_acceptance, media_full_functional_acceptance, critical_skip_closure,
fresh_production_protected_row_audit and github_certification_and_deployment.

Financial source locks remain unmodified. No production/staging protected-record
read, customer data mutation, provider state change, Paystack charge/transfer/refund,
Cloudinary write, schema/migration, source-lock activation, main change, merge,
preview/production deployment, Vercel variable change or Railway patch application
occurred. Patch `9a3370a3-8d07-4ef9-9e8d-a57ff488fccb` is untouched. No secret or raw
trace is staged/committed. Seed is unchanged; its older nine explicit-no-ignore
any findings remain advisory debt outside configured lint.

Recommended Phase 2A is bounded financial/store-order acceptance of the nine
placeholder journeys, with tenant isolation, explicit DENY, concurrency,
idempotency and masked-data contracts retained. External prerequisites include
architect-approved financial/commercial inputs, an approved protected-row audit
path, real provider acceptance, human visual/device review and operator decisions
on production origin/configuration and staged infrastructure. These are not
implemented, activated or fabricated in Phase 1C. Stop for architect review.

## Complete final-source job inventory

Run 37706879867; SHA 1a7a7d0cd1612d0f031ec8e0682da83569df2646; overall FAILURE.

| Job | ID | Conclusion |
|---|---|---|
| recovery | 113083227026 | SUCCESS |
| quality | 113083227265 | SUCCESS |
| browser | 113083227295 | SUCCESS |
| redis-and-recovery | 113083227343 | SUCCESS |
| postgres (test:integration:auth) | 113083227394 | SUCCESS |
| postgres (test:integration:cross-module) | 113083227455 | SUCCESS |
| postgres (test:integration:payment-foundation) | 113083227506 | SUCCESS |
| postgres (test:integration:marketplace-checkout) | 113083227509 | SUCCESS |
| postgres (docker:gate4) | 113083227559 | SUCCESS |
| postgres (test:integration:dispatch) | 113083227572 | SUCCESS |
| postgres (test:integration:withdrawals) | 113083227574 | SUCCESS |
| postgres (test:integration:store-orders) | 113083227591 | SUCCESS |
| postgres (docker:migration-smoke) | 113083227605 | SUCCESS |
| postgres (test:integration:store-earnings) | 113083227634 | SUCCESS |
| postgres (test:integration:refunds) | 113083227643 | SUCCESS |
| postgres (test:integration:driver-operations) | 113083227645 | SUCCESS |
| postgres (test:integration:pricing) | 113083227648 | SUCCESS |
| postgres (test:integration:driver-earnings) | 113083227667 | SUCCESS |
| postgres (test:integration:catalog) | 113083227678 | SUCCESS |
| postgres (test:integration:ledger) | 113083227686 | SUCCESS |
| postgres (test:integration:orders) | 113083227724 | SUCCESS |
| postgres (test:integration:permissions) | 113083227772 | SUCCESS |
| postgres (test:integration:closure) | 113083228115 | SUCCESS |
| postgres (test:integration:storefront) | 113083228161 | SUCCESS |
| certified | 113086772404 | FAILURE |

Run 37706879793; SHA 1a7a7d0cd1612d0f031ec8e0682da83569df2646; overall SUCCESS.

| Job | ID | Conclusion |
|---|---|---|
| cross-module-integration | 113083226670 | SUCCESS |
| Phase 1 PostgreSQL Webhook Concurrency Integration | 113083226864 | SUCCESS |
| dispatch-integration | 113083226939 | SUCCESS |
| container-build | 113083226940 | SUCCESS |
| quality | 113083226955 | SUCCESS |
| pricing-integration | 113083227036 | SUCCESS |
| migration-smoke | 113083227037 | SUCCESS |
| Phase 1 Release-Critical Verification (Paystack, Invariants, Security, Processors, Refunds) | 113083227330 | SUCCESS |
| docker-runtime | 113083227397 | SUCCESS |
| withdrawal-integration | 113083227999 | SKIPPED |
| refund-e2e | 113083228047 | SKIPPED |
| payment-foundation-e2e | 113083228056 | SKIPPED |
| driver-earning-e2e | 113083228086 | SKIPPED |
| storefront-e2e | 113083228125 | SKIPPED |
| ledger-integration | 113083228134 | SUCCESS |
| store-earning-integration | 113083228180 | SKIPPED |
| withdrawal-e2e | 113083228239 | SKIPPED |
| payment-foundation-integration | 113083228279 | SKIPPED |
| Legacy PayFast Checkout E2E (Compatibility) | 113083228317 | SKIPPED |
| Legacy PayFast Compatibility Integration | 113083228481 | SKIPPED |
| store-earning-e2e | 113083228489 | SKIPPED |
| e2e-chromium | 113083228528 | SKIPPED |
| Legacy PayFast Confirmation Integration (Compatibility) | 113083228544 | SKIPPED |
| refund-integration | 113083228628 | SKIPPED |
| storefront-accessibility | 113083228830 | SKIPPED |
| Legacy PayFast Confirmation E2E (Compatibility) | 113083229098 | SKIPPED |
| driver-earning-integration | 113083229103 | SKIPPED |
| storefront-integration | 113083229200 | SKIPPED |
