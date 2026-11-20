# KT Couriers — Chief Architect engineering report

Prepared 20 November 2026. This report distinguishes verified engineering evidence from live operational acceptance. The production source assessed here is `b1b15b19f5b1709da898d8685c193f0aac2b2d20`; its parents are local implementation `c496ce6bd549089195f0d22e8b4bb8170522483c` and the owner's `8c1bdd3b90d89c8a7d259b87412ce030dc930adf`. The original audit baseline was `d16ea2cc2bb009e78c70069bdbd58dbf819289e9`. The owner merged the two histories; the resulting tree is the previously inspected conflict-free merge preview. No history was rewritten.

## Findings and changes

| Finding | Change and evidence | Disposition |
| --- | --- | --- |
| Administrative COD delivery could close an order without matching collected cash. | `lib/services/delivery-execution.service.ts`, `lib/services/cash-on-delivery.service.ts` and the admin proof route enforce collected, non-reversed journal evidence and the correct assigned driver within the delivery transaction. `tests/integration/audit-remediation-closure.integration.test.ts` exercises the financial guard and races. | Fixed and PostgreSQL tested. |
| Generic admin status update could bypass the manual-delivery guard. | The generic status path refuses direct `DELIVERED`; the admin flow directs the operator to proof-backed completion. See `lib/services/order-status.service.ts` and the same integration suite. | Fixed and PostgreSQL tested. |
| Physical delivery reported with cash outstanding needed an independent review without false payment. | `lib/services/cod-physical-delivery-exception.service.ts`, `app/api/admin/orders/[id]/cod-delivery-exception/route.ts` and `components/admin/CodDeliveryExceptionAction.tsx` require authorized operators, private order-owned evidence, a different reviewer, durable receipts and an alert. Pending review blocks completion and cash reconciliation. The record does not fabricate collection, delivery, earnings or settlement. | Review and preservation of the outstanding COD obligation tested. A separate journaled receivable or suspense treatment for an **uncollected** shortage is not established by this implementation; existing shortage suspense handles a short remittance after collected driver custody. The required accounting treatment remains to be resolved under an approved policy. |
| Resend stale-worker lease could allow an old worker to affect recovered work. | `lib/notifications/resend-webhook.service.ts` fences writes with current lease ownership and a row lock; recovery scans avoid starvation. `tests/integration/audit-remediation-closure.integration.test.ts` and `tests/phase27/resend-webhook-inbox.test.ts` cover the claim/recovery boundary. | Fixed and tested in disposable PostgreSQL and unit runs; real provider delivery still requires actual receipts. |
| Concurrent identical driver delivery commands could reject a valid replay after the first request completed. | `lib/services/delivery-execution.service.ts` rechecks the exact immutable receipt and actor authority after a racing eligibility change. `tests/unit/delivery-completion-replay-race.test.ts` covers accepted replay, wrong actor, changed payload and driver-check race. | Fixed; both canonical browser driver journeys and the five-product vendor delivery passed on `c496ce6b`. |
| A serializable store preparation conflict surfaced as a server error. | `lib/store-orders/store-order.service.ts` retries the idempotent start-preparation transaction for bounded serialization conflicts. `tests/unit/store-order-preparation-retry.test.ts` tests retry and unrelated error handling. | Fixed; both merchant browser journeys passed on `c496ce6b`. |

The isolated browser fixture certificate originally expired after one hour during a longer run; the storefront correctly became unavailable. `scripts/e2e-checkout-authorities.ts` now gives only the guarded synthetic certificate four hours, longer than the bounded two-hour browser stage. The vendor delivery fixture allows 30 seconds for an observed committed state instead of five. `scripts/build-e2e-host-standalone.mjs` uses a 2.5 GB heap for the supported host fallback. None of these changes extend production certificate validity or authorize live finance.

## Verification

The following local results are for `c496ce6bd549089195f0d22e8b4bb8170522483c`, before the owner's merge. Logs and harness receipts are in the local ignored `output/production-closure/` directory. They must not be represented as local runs against the later merge commit.

| Check | Result |
| --- | --- |
| Sanitized production build and TypeScript phase | PASS, `e2e-host-c496.log`. |
| Full Chromium, isolated PostgreSQL/Redis, internal-only application network and synthetic provider | PASS, 167/167, `e2e-full-c496.log`; no live payment or outbound email. |
| Full unit suite and coverage | PASS, 1,163 files and 5,797 tests; statement coverage 55.19%, `unit-c496.log`, `coverage-c496.log`. |
| Full lint | PASS, zero errors and two warnings, `lint-c496.log`. |
| PostgreSQL closure | PASS, 59 files, 321 tests, zero skipped, `postgres-c496.log`. |
| Strict Redis / PostgreSQL BOLA | PASS, 7 / 10 tests respectively. |
| Recovery and historical upgrade | PASS: disposable dump/restore, row hashes and ledger invariants; historical migration upgrade passed. |
| Migrations and schema | PASS: Prisma validation, migration safety check, one active baseline and 128 incremental migrations; no migration added by the listed local commits. |
| Named payment, Paystack contract/invariants, BOLA, refund and processor unit suites | PASS: 508, 24, 23, 23, 115 and 90 tests respectively. |
| Named integration runners | PASS: ledger, dispatch, driver operations, marketplace checkout, store order, refund, withdrawal, store earnings and driver earnings. Marketplace and store-order runners used the repository-recognized disposable loopback database; refund and earnings runners used their own disposable projects. |
| Dependency install | `npm ci` PASS; Prisma client subsequently generated. |

Two earlier full browser runs failed and are retained in `e2e-full-2c81.log` and `e2e-full-659b.log`. The former exposed a serialization conflict and duplicate-completion race; the latter exposed expiry of the synthetic certificate and a slow observed transition. They are not passing evidence.

For merged SHA `b1b15b19f5b1709da898d8685c193f0aac2b2d20`, local verification also passed: full Chromium 167/167 (`e2e-full-b1.log`), unit 1,165 files / 5,816 tests (`unit-b1.log`), PostgreSQL closure 59 files / 321 tests / zero skips (`postgres-b1.log`), and lint with zero errors / two warnings (`lint-b1.log`). A clean-source standalone production build passed at a 4.6 GB heap (`e2e-host-b1-4600.log`); preceding 2.5 GB and 3.2 GB attempts exhausted their heaps and are recorded separately. The 4.6 GB run used an ignored local copy of the fallback runner; it did not change tracked source.

For the **merged** SHA `b1b15b19f5b1709da898d8685c193f0aac2b2d20`, [Engineering Certification](https://github.com/analyticsmath/KT-Courier/actions/runs/44697174871) completed with 26 successful jobs, including browser, quality, PostgreSQL, Redis and recovery. [CI](https://github.com/analyticsmath/KT-Courier/actions/runs/44697174745) completed with 10 successful and 18 skipped jobs. Skipped CI jobs are not counted as passes. Both the local full Chromium rerun and certification browser job cover the merged SHA.

The 18 skipped CI jobs are conditional on repository variables in `.github/workflows/ci.yml`: payment foundation (two jobs), legacy PayFast (four), withdrawal (two), refund (two), store earnings (two), driver earnings (two), and storefront/Chromium (four). Their corresponding `ENABLE_DEFERRED_*_VALIDATION` conditions were not met in that run. The separately successful certification jobs and local tests do not turn those skipped CI jobs into executions.

## Production observation

Railway reported `web`, `operations` and `query-storefront-categories` successful at merged SHA `b1b15b19f5b1709da898d8685c193f0aac2b2d20`; Vercel reported its production deployment READY at the same SHA. Read-only `https://www.ktcouriers.com/api/health` and `/api/ready` returned HTTP 200. Deployment health does not prove a live charge, bank settlement, message delivery or physical delivery.

Actual Paystack mode and approved policy scope, COD corridor and bank-remittance approval, configured recipients, real Resend delivery receipts, active vendor certification, and physical driver operations were not independently established by this report. Obtain those facts through the existing authorized admin diagnostics and operator evidence; do not infer their state from the synthetic tests or create approvals.

## Requirements and workflow crosswalk

The earlier detailed source-to-code register is `docs/production-closure/CHIEF_ARCHITECT_9SOURCE_CROSSWALK_2026-11-16.md` and `lib/governance/directive-code-coverage-register.ts`. Its historical dates and commit references are not upgraded into fresh proof by this report. The nine supplied sources are the Website Developer Brief; Delivery and Access; Website & System Changes; About Us; Privacy Policy; Refund & Cancellation; Shipping & Delivery; Terms and Conditions; and Updated Details. The table below records the scope of current evidence, not an assertion that every clause or live configuration has been independently revalidated.

| Source and principal scope | Current evidence and status |
| --- | --- |
| Website Developer Brief — customer, vendor, driver, admin and commerce | Automated role and workflow regression passes as above; complete individual clause-to-live-operation acceptance remains unverified. |
| Delivery and Access — dispatch, pickup, proof and access | Canonical driver and handoff browser tests and PostgreSQL closure pass on `c496ce6b`; physical delivery remains operator evidence. |
| Website & System Changes — checkout, COD, configuration and notifications | COD guard, exception and notification recovery changes are described above; uncollected-shortage accounting and actual configuration remain open. |
| About Us — public content | Public/browser regression is included; this report makes no fresh legal or editorial approval claim. |
| Privacy Policy — access, retention and deletion | Security and PostgreSQL closure suites pass; current live retention settings and legal acceptance are not established here. |
| Refund & Cancellation — refunds and cancellation | Refund unit, dedicated integration and synthetic browser cases pass; actual provider and statutory disposition require real evidence. |
| Shipping & Delivery — quote, serviceability and delivery | Quote, packaging, handoff and driver scenarios pass in disposable browser tests; actual coverage and physical operations remain operator evidence. |
| Terms and Conditions — commercial and financial rules | Automated checkout and policy regressions pass; actual current approved commercial and legal terms are not verified here. |
| Updated Details — programmes, rewards and commercial configuration | Promotion, processor and policy tests execute; current approved programme terms and external activation remain operator evidence. |

The latest customer, vendor, driver, superadmin and full-workflow acceptance directive is covered in part by the listed role, checkout, wallet, refund, COD, dispatch, pickup, proof, notifications, earnings and security suites. Reporting, promotion and processor code has tests in the full unit and PostgreSQL suites; this report does not claim that every required case, live configuration, or all individual acceptance IDs has been independently witnessed. The original detailed requirement matrix should be reconciled case by case before declaring unrestricted operational acceptance.

## Local implementation commits

`3184abc7` COD guard and webhook fencing; `28860043` generic admin delivery bypass; `cf33cf74` scoped COD readiness; `e12e38d1` independently reviewed physical-delivery exception; `0e2dbce8`, `047c87b0`, `56cdf389`, `29e165df` and `2c8138a8` acceptance environment and test isolation; `946d8f32` transaction retry and delivery replay race; `659bacba` host build memory; `c496ce6b` isolated certificate lifetime and observed-state timing. Merge `b1b15b19` also contains the owner's ten intervening storefront, pickup and vendor commits.

## Verdict

**CODE_VERIFIED:** the specific changes and test scopes listed above. **LIVE_OBSERVED:** hosting deployment status and public health responses only. **OPERATOR_EVIDENCE_PENDING:** actual provider, banking, physical delivery and approved operational configuration. **ENGINEERING GAP:** the separately requested accounting treatment of a verified physical delivery with uncollected COD has not been demonstrated as a posted receivable or suspense journal. Do not describe the entire directive as complete until that treatment and the remaining case-level acceptance are resolved.
