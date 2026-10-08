# Phase 2.1 — canonical offline Paystack checkpoint

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
