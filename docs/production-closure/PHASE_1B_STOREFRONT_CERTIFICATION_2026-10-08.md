# Phase 1B storefront validation — 8 October 2026

Classification at source checkpoint: **PHASE_1_PARTIAL; OVERALL_NOT_READY** until
new exact-SHA acceptance completes. No Phase 2 implementation is authorized here.

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

## Local observations and CI pending

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

These local results concern working source based on e4acdf9f; they are not yet
new-commit CI proof. Exact-head quality, 20 PostgreSQL commands, Redis/security,
recovery and browser results will be recorded after execution. The final manifest
gate is expected to remain FAIL on genuine later-phase open requirements.

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
