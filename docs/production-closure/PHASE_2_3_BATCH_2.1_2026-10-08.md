# Phase 2.1 — current canonical offline Paystack checkpoint

**PARTIAL; production NOT_READY.** Latest source: `95dbab4a904a0971983857399f0dddc1384f8358`. Required core acceptance: **PASS**. PostgreSQL 2/2; focused Chromium 9/9; full Chromium 97/97; all counts below distinguish failures and unexecuted tiers. Residual multi-store/modifier, cent/large-value, stale-evidence and operation-hash proofs remain **OPEN**. Latest detailed session and exact workflow URLs follow the preserved original receipt. Batch 2.2 and Phase 3 were not started.

## Original checkpoint — 09:50:03 UTC session, preserved history

**PARTIAL; production NOT_READY.** All legitimate implementation is preserved on `production-closure-2026-10-07`. Corrected source: `58f33038fad91278affaa0cf89e07d7ab30843a1`. Starting checkpoint: `1091cbec70320099fe0e71c7622f2f108f2aa314`. This receipt is a separate documentation commit; its final tip is returned after normal push. [Machine receipt](PHASE_2_3_BATCH_2.1_2026-10-08.json).

Session start 09:50:03 UTC; practical stop 10:50:03; absolute stop 11:05:03, including push/report. Report prepared 2026-10-08T10:49:52.127Z. PR [#17](https://github.com/analyticsmath/KT-Courier/pull/17) remains OPEN/draft/unmerged into main. Phase 1 source `1a7a7d0cd1612d0f031ec8e0682da83569df2646` is preserved.

## Implemented authority and isolation

- Paystack client uses a guarded offline seam only with explicit opt-in, test/e2e identity, disabled network, internal application network, exact named local database/user, fixed synthetic test credential, local callback origin, demo full-flow false and namespace-owned synthetic payer. Supported operations are initialize and Verify; refunds/transfers and every other operation reject before network. Independent provider facts persist separately from webhook facts; the seam never updates successful payment, ledger, stock or order rows.
- Actual canonical services perform signed HTTP ingress, durable inbox leasing with SKIP LOCKED, independent Verify, amount/currency/reference matching, exact ZAR receipt journal, immutable verified intent/consumer receipt, frozen order creation and stock consumption. No success-setting endpoint or production activation flag was introduced.
- Fixed stored fingerprint reuse, independent Verify reference binding, wrong-owner prepare-payment denial and default guest capability propagation. Owned completed guest checkout reads deliver the bound HttpOnly order capability; tokens/hashes are not projected into public DTOs. Synthetic guest verification exercises the existing encrypted challenge/outbox and canonical verification, with no external email.
- Two real PostgreSQL integration cases replace the payment anchor's `expect(true)`. They use canonical HTTP composition and services, actual migrations and namespace accounts, changed-amount rollback, concurrency/replay and UNKNOWN locking. They execute in the named disposable E2E project before the focused browser selection; the generic PG selector no longer treats this file as a trivial test.
- Nine executable payment browser cases replace the obsolete PayFast placeholder and are explicitly selected for Chromium. Customer and verified guest run at 1440/390. Cases assert protected before/after journals, stock, one order and frozen source/consumer evidence; negative cases cover forged/changed signatures, foreign owner, spoofed return, amount/currency/reference mismatch and UNKNOWN. Full expected count comes from actual discovery. Focused and full selections have separate disposable databases.

## Exact-source local checks

| Check | Result | Counts | Duration |
|---|---|---|---|
| unit | PASS | 39 passed / 0 failed / 0 skipped | 8.626s |
| payments | PASS | 333 passed / 0 failed / 0 skipped | 8.621s |
| types | PASS | exit 0 | 24.498s |
| lint | PASS | exit 0 | 13.649s |
| selection | PASS | exit 0 | 0.925s |
| prisma | PASS | exit 0 | 3.019s |
| migrations | PASS | exit 0 | 0.413s |
| discovery | PASS | exit 0 | 2.002s |

Chromium discovery: **97 cases in 26 files**, including all nine new payment cases, with no skip declarations in that file. Discovery executes **zero** browsers and proves **no** financial transition. Unit/payment tests use existing mocks/pure policies where applicable and are supporting T1 evidence, never PostgreSQL financial acceptance. Counts overlap and must not be added as unique tests.

The initial default-heap typecheck failed at 2 GB; using the repository's 8 GB command exposed and corrected actual type errors before the source checkpoint. A broad payment check initially ran with e2e runtime and failed two legacy PayFast HTTP-origin expectations (331 pass / 2 fail); rerunning with the normal test runtime passed 333/333. No production source was weakened for those harness settings. Final source typecheck/lint/Prisma/migration checks passed. Local Docker/build/PG/browser execution was avoided because the previously observed local build was memory-limited; isolated CI performs those tiers.

## Source workflow evidence

First source `ee39716459db3c27c7f6f8c874d5ded91a2ad52d`: [CI 37762143765](https://github.com/analyticsmath/KT-Courier/actions/runs/37762143765) SUCCESS. [Certification 37762143742](https://github.com/analyticsmath/KT-Courier/actions/runs/37762143742) had **23 successful non-browser components** and failed focused Paystack acceptance: **0 passed / 9 failed / 0 skipped**, retries zero. All nine failed on host-side Prisma connectivity to the disposable DB. Pre-payment HTTP preparation worked; the failed cases are not financial acceptance. The corrected Compose boundary gives PostgreSQL a dedicated **loopback-bound** ingress; the application/provider network stays internal and its outbound probe remains mandatory. A real server database/user preflight precedes financial tests.

Attempted source `de38d735e5d1804758a23c5a5f6a696f02aabde5`: [CI 37764169949](https://github.com/analyticsmath/KT-Courier/actions/runs/37764169949) **success**; [certification 37764169990](https://github.com/analyticsmath/KT-Courier/actions/runs/37764169990) **failure**, 23 successful components observed. Browser job: **failure**. New PG receipt: **FAIL**; focused nine-case selection: **NOT_STARTED**; expanded full selection: **NOT_STARTED**. Exact artifact receipts are recorded in the JSON. No pending/missing tier is relabelled PASS. Automatic report-tip workflows may supersede source runs; record cancellation and report-tip SHA separately. No workflow was manually dispatched, rerun or cancelled.

Final source correction `58f33038fad91278affaa0cf89e07d7ab30843a1` changes the application lookup to the actual unique merchant reference and adds a query-identity regression assertion. It passed local supporting checks, but has **not yet passed real PostgreSQL or browser acceptance**. At `de38d735e5d1804758a23c5a5f6a696f02aabde5`, the named PostgreSQL database/role preflight passed, and both actual PG cases failed (0 passed / 2 failed / 0 skipped, 9.764 seconds). Success remained REQUIRES_ACTION; UNKNOWN had zero independent Verify calls. Source inspection found the incorrect publicReference lookup. The focused nine browser cases and expanded full selection were **not started** after the PG gate failed; that is zero executed, not nine skipped or passed. This failure and final unverified correction are preserved without another manual CI attempt.

## Outstanding work and next action

- Verify/download corrected-source PostgreSQL, nine focused Paystack browser and expanded full Chromium execution evidence; discovery or unit mocks cannot close financial acceptance.
- Any failure in corrected-source CI is an open defect, not an accepted pass.
- Complete matrix follow-ups not covered by this bounded single-store basket: multi-store/modifier and cent/large-value cases, stale quote/legal/contact negatives, changed-operation request-hash proof. The previously inventoried Number/toFixed and reserve/prepare requestHash forwarding risks remain unverified.
- Other marketplace order/settlement integration anchors and eight other financial/store browser placeholders remain open; do not count their trivial/scaffold assertions as acceptance.
- Paystack sandbox/live/operator acceptance, real fees/stock/approvals and production rollout remain separate and unauthorized.

**Next action:** Resume only Batch 2.1 verification/defect closure from the latest preserved report tip. Do not start Batch 2.2 or Phase 3. No production/provider/deployment authorization is implied.

No source payment/refund/settlement locks, manifest gates, main/protected branch, production data/configuration, provider credentials, optional activation or Railway staged patch were changed. No external Paystack API, money, deploy, merge/reset/clean/discard/force push or production operation occurred. Local check children completed under deliberate timeouts; no local test/build was left running. Git checkpoint and final report-tip remote equality are verified in the final handoff.


## Resumed Batch 2.1 — 2026-10-08T12:00:33.518Z

Started 11:12:38 UTC; target 12:12:38 UTC; absolute stop 12:27:38 UTC. Clean local/remote starting tip `e292715a4bf9f04f98d541f1f087cef1402e762d`; PR #17 OPEN/draft/unmerged. Latest source: `95dbab4a904a0971983857399f0dddc1384f8358`. Classification **PARTIAL**; core acceptance **PASS**. Historical failed evidence above and in JSON is preserved.

Starting-head [CI 37766153091](https://github.com/analyticsmath/KT-Courier/actions/runs/37766153091) passed. [Certification 37766153075](https://github.com/analyticsmath/KT-Courier/actions/runs/37766153075) passed the database identity preflight but failed both actual PG cases (0 passed, 2 failed, 0 skipped, 4.358 seconds). The merchant-reference lookup correction reached Verify, exposing protected-write defects: success tried to replace an established provider reference with the numeric transaction ID; UNKNOWN tried to rewrite immutable signed intake normalization. Neither focused nor full browser selection started.

Preserve established provider reference and signed intake normalization. A new incremental migration permits only the first coherent post-success order association, matching actual order/payment/checkout/owner/ZAR total; it rejects unlinking/rebinding and still protects all financial and success evidence. Duplicate intake races acknowledge only a committed durable receipt. Production activation locks are unchanged. Real PG assertions now also check preserved provider reference and immutable COMPLETE intake normalization. Local supporting checks on the working tree committed as `a28f3285e20b9e41f4027ee1716be071c344c212` passed: 39 scoped policy/payment tests, 333 payment tests, lint and 8 GB typecheck. They are not financial acceptance; their precommit runner recorded the then-current baseline SHA.

Exact latest-source [CI 37771823380](https://github.com/analyticsmath/KT-Courier/actions/runs/37771823380) is **success**. [Certification 37771823257](https://github.com/analyticsmath/KT-Courier/actions/runs/37771823257) is **failure**. PostgreSQL: **PASS**, 2 passed / 0 failed / 0 skipped. Focused Paystack Chromium: **PASS**, 9 passed / 0 failed / 0 skipped / 0 flaky. Full Chromium: **PASS**, 97/97 passed, 0 skipped, 0 flaky, 0 retries. Missing evidence is unverified, never PASS. The JSON retains exact workflow/job URLs and stage receipts.

Residual 2.1 items remain **OPEN**: multi-store/modifier allocations, cent/large-value arithmetic, stale quote/legal/contact rejection, and operation-ID/request-hash conflicts. Source inspection confirms reserve/prepare handlers still omit requestHash forwarding; no runtime passing proof is claimed. No Batch 2.2 or Phase 3 work occurred.

**Next authorized work:** Batch 2.1 only: resolve any acceptance failure and execute remaining matrix invariants. Batch 2.2 and Phase 3 were not started. No main merge, deployment, production access/mutation, real Paystack operation, financial lock removal, Railway patch change, force push or destructive reset. Final report tip and remote equality are returned after normal push; the report cannot embed its own commit SHA.

Intermediate source a28f3285e20b9e41f4027ee1716be071c344c212: CI 37768916403 SUCCESS, certification 37768916516 failed its browser job after 23 successful non-browser components. Both actual PostgreSQL cases failed (0 passed / 2 failed / 0 skipped, 4.368 seconds). Payment and receipt journal assertions passed before the missing-order assertion; database log proved the reverse order-association write rolled back under the succeeded-payment immutability guard. UNKNOWN failed at concurrent intake (P2002 / HTTP 503). Focused/full browsers were not started. These failed cases remain failed acceptance.

The working tree committed as 2228f8d570495241fe7a4d65b82f62d820fe949f passed 335 payment tests, lint, 8 GB typecheck and incremental migration safety. An intermediate check failed one test because its synchronous mock did not provide Promise.catch; ordinary try/await/catch corrected that handling. Actual PG acceptance at that exact source passed 2/2 with zero failed/skipped/todo in 3.876 seconds, including paid amount and order-link immutability. Focused Chromium executed all nine: 8 passed / 1 failed / 0 skipped / 0 flaky / retries 0. The final signed incorrect amount/currency case encountered P2034 when concurrent events opened the same reconciliation case. Full Chromium stayed blocked. CI 37770411829 SUCCESS; certification 37770411791 had 23 successful non-browser components and failed its browser job.

Final retry correction 95dbab4a904a0971983857399f0dddc1384f8358 reuses the existing bounded database retry helper only around mismatch reconciliation. Independent Verify remains outside that retry; a fault-injected contract assertion proves one Verify call across two local transaction attempts. Supporting 335 payment tests, lint and typecheck passed; the updated 24-case contract file and lint then passed. They are T1 evidence, not real PostgreSQL/browser acceptance.

## Accepted core evidence and remaining gates

At source `95dbab4a904a0971983857399f0dddc1384f8358`, all 24 certification component jobs passed. The final certified job failed only on the nine unchanged release gates; production remains **NOT_READY**. Exact PG acceptance took 4.700 seconds. The focused invocation took 135.032 seconds including provisioning and the PG gate; full Chromium took 333.347 seconds. Focused and full runs used zero retries, skips or flaky cases.

Inspected all nine actual full-suite financial attachments. Four customer/verified-guest paths at 1440/390 each show one R1526.97 ZAR debit/credit-balanced journal with two entries, one consumed reservation and one canonical order; each initialized and independently verified once. Guest capabilities are bound without publishing a hash/token. The five negative paths show no success journal/order and preserve inventory; the concurrent signed amount/currency case verifies twice, once per event, then reconciles both with no financial mutation. JSON proof summaries retain case names, exact journal totals, provider call counts and before/after inventory projections. This ordinary cent-valued basket does not certify cent-allocation corner cases or large-value arithmetic.

The final corrected source has no unexplained failure in the required PG/focused/full acceptance tiers. Batch 2.1 remains **PARTIAL** solely because its explicitly listed residual proofs are OPEN. Architect review and separately authorized remaining 2.1 proofs are next. No Batch 2.2 or Phase 3, production deployment or Railway patch work was started.
