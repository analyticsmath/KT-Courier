# Remaining Defects & Blocker Inventory

**Project:** KT Couriers — Full Functional Phase 2 Scope  
**Author:** Anti-Gravity Coding Agent (Senior Full-Stack Engineer & Independent Phase 2 Delivery Owner)  
**Branch:** `phase2/antigravity-functional-completion-2026-10-11`  
**Base Commit SHA:** `b31ede4a900b0778e15dce0a3ef78e6d2613b350`  
**Last Updated:** 11 October 2026  
**Status:** `AUDITED_AND_CLASSIFIED`

---

## 1. Defect Classification Taxonomy

All known defects, architectural constraints, and operational blockers are classified strictly by ownership domain:

- **`PHASE2`**: Local Phase 2 functional, testing, compilation, or environment defects within the independent Phase 2 delivery scope.
- **`PHASE1`**: Active financial correctness, settlement, ledger integrity, webhook consumer concurrency, or checkout finalization defects owned exclusively by GPT-6.1 Solo on `production-closure-2026-10-07`.
- **`EXTERNAL`**: Business policy decisions, legal compliance, pricing confirmations, or operational credentials requiring human client/operator action prior to commercial deployment.

---

## 2. Master Blocker & Defect Matrix

| ID | Title / Symptom | Impacted Files / Modules | Owner | Severity | Current Status | Resolution / Action Required |
|---|---|---|---|---|---|---|
| **DEF-P2-01** | Full `npm test` Windows worker timeout on parallel runs | `vitest.config.ts`, `tests/unit/legacy-6ammart-cli.test.ts` | `PHASE2` | Medium | `RESOLVED_IN_PHASE2` | Increased Vitest testTimeout to 45s and spawnSync timeout to 30s. Full suite runs cleanly in 117s. |
| **DEF-P2-02** | CRLF vs LF line-ending mismatches on Windows in migration/audit tests | `tests/scripts/residual-index-alignment-migration.test.ts`, `tests/subscriptions/phase-22-correction-source-audit.test.ts` | `PHASE2` | Low | `RESOLVED_IN_PHASE2` | Normalized file read contents with `.replace(/\r\n/g, "\n")`. Tests pass with 0 errors. |
| **DEF-P2-03** | Inaccurate file and test paths in traceability matrix | `docs/phase2-parallel/REQUIREMENTS_TRACEABILITY.md` | `PHASE2` | Low | `RESOLVED_IN_PHASE2` | Reconciled all 14 path discrepancies to exact filesystem locations. |
| **DEF-P1-01** | Verified-Payment Event Consumer Receipt Contention (`P2034` write conflict) | `lib/payments/verified-payment-event-processor.service.ts` | `PHASE1` | Critical | `BLOCKED_PHASE1` | Active investigation and fix by GPT-6.1 Solo on Phase 1 branch. Cross-stream re-test required upon merge. |
| **DEF-P1-02** | 41-case canonical PostgreSQL financial acceptance execution | `lib/services/ledger-posting.service.ts`, `lib/marketplace-checkout/*` | `PHASE1` | High | `BLOCKED_PHASE1` | Requires Phase 1 financial correctness fixes before full green execution without contention. |
| **DEF-P1-03** | Paystack webhook concurrency and real settlement idempotency | `lib/services/paystack-webhook-application.service.ts` | `PHASE1` | High | `BLOCKED_PHASE1` | Owned by Phase 1 financial stream. Maintained zero-edit boundary in Phase 2. |
| **DEF-EXT-01** | Express parcel size base tariffs lack confirmed human approval | `scripts/initialize-reviewed-client-launch.ts`, `lib/client-platform/delivery.service.ts` | `EXTERNAL` | High | `INHERITED_IMPLEMENTED_UNVERIFIED` | Client document *Delivery and Access* establishes R5.50/km and parcel size component. Base fees (Small R5.50, Medium R8.50, Large R13.00) originate from inherited initialization code and require explicit client sign-off. |
| **DEF-EXT-02** | Registered Physical Business Address required under Companies Act | `lib/services/company-profile.service.ts`, `components/public-v2/legal/PublishedPolicyPage.tsx` | `EXTERNAL` | Medium | `BLOCKED_EXTERNAL` | Client mandated no walk-in office (`info@ktcouriers.com`), but Companies Act requires registered office address on official tax invoices. Awaiting client formal registered address. |
| **DEF-EXT-03** | Cash on Delivery (COD) 50/50 store eligibility & order value cap | `lib/client-platform/driver-cash.service.ts` | `EXTERNAL` | Medium | `BLOCKED_EXTERNAL` | Awaiting client confirmation of store whitelist criteria and maximum cash order ceiling (e.g. R1,000.00 ZAR). |
| **DEF-EXT-04** | Platform commission and driver remittance schedules | `lib/pricing/*`, `app/(admin)/admin/commissions/page.tsx` | `EXTERNAL` | High | `BLOCKED_EXTERNAL` | Client document examples (70/30 split, 8-10% vendor fee) were illustrative. Awaiting final operational commission schedule. |
| **DEF-EXT-05** | Managed social marketing package pricing & SLA definitions | `app/(store)/store/advertising/page.tsx`, `lib/advertising/managed-marketing.service.ts` | `EXTERNAL` | Medium | `BLOCKED_EXTERNAL` | Campaign authoring for TikTok, Facebook, Instagram, Google implemented. Awaiting client package pricing tiers and fulfillment SLAs. |
| **DEF-EXT-06** | Legal counsel formal review of published POPIA / CPA policies | `components/public-v2/legal/PublishedPolicyPage.tsx` | `EXTERNAL` | Medium | `BLOCKED_EXTERNAL` | Core policies published as version `2026-10-06-client-v1`. Awaiting final legal counsel sign-off. |
| **DEF-EXT-07** | Open engineering readiness gates in `engineering-gates.json` | `docs/production-closure/engineering-gates.json` | `EXTERNAL` | High | `BLOCKED_EXTERNAL` | Production readiness gates (live deployment, production DB, production Paystack keys) intentionally preserved open/fail-closed under Phase 2. |

---

## 3. Phase 2 Scope Defect Detail & Resolution

### DEF-P2-01: Vitest Full Suite Windows Parallel I/O Timeout
- **Problem:** Executing `npm test` across all 790 test files concurrently on Windows resulted in 3 parallel worker timeouts (`signature-media.test.ts`, `distributed-rate-limit-audit.test.ts`, `final-schema-alignment-migration.test.ts`) and 1 process spawn timeout (`legacy-6ammart-cli.test.ts`).
- **Root Cause:** Default 10,000ms Vitest test timeout and 10,000ms `spawnSync` timeout were insufficient under heavy concurrent disk I/O when 790 test files compete for file handles and Node.js child processes on Windows.
- **Resolution Applied:**
  1. Updated `vitest.config.ts` to set `testTimeout: 45000` (45 seconds), providing adequate headroom for parallel I/O.
  2. Updated `tests/unit/legacy-6ammart-cli.test.ts` to set `spawnSync` timeout to `30000` (30 seconds).
- **Verification Evidence:** Executed single unified `npm test > output/phase2-parallel/vitest-full-run.log 2>&1`. Result: **790/790 test files passed, 3,712/3,712 tests passed, 0 failures, 0 skips, duration 117.07s, exit code 0.**

### DEF-P2-02: Windows CRLF vs LF Line-Ending Assertion Mismatches
- **Problem:** Two tests (`tests/scripts/residual-index-alignment-migration.test.ts` and `tests/subscriptions/phase-22-correction-source-audit.test.ts`) failed during full suite execution due to regex assertion mismatches.
- **Root Cause:** Git checkout on Windows converts files to CRLF (`\r\n`), but the tests asserted exact multi-line string matches with LF (`\n`) delimiters.
- **Resolution Applied:** Added `.replace(/\r\n/g, "\n")` to normalize read file content prior to regex/string assertions.
- **Verification Evidence:** Both tests now pass cleanly in targeted runs and during the full 790-file suite.

### DEF-P2-03: Inaccurate Traceability Matrix File Paths
- **Problem:** Chief Architect review identified 14 non-existent or misspelled file and test paths in `docs/phase2-parallel/REQUIREMENTS_TRACEABILITY.md`.
- **Resolution Applied:** Audited all 129 backticked file paths in the matrix against the filesystem. Reconciled every path to its exact codebase equivalent.

---

## 4. Phase 1 Blockers (Cross-Stream Dependencies)

### DEF-P1-01: Verified-Payment Event Consumer Receipt Contention
- **Problem:** Under concurrent payment webhook notifications, duplicate attempts to insert into `paymentVerifiedEventConsumerReceipt` trigger Prisma `P2034` (transaction write conflict) errors.
- **Phase 1 Ownership:** GPT-6.1 Solo is actively engineering concurrency guards and idempotency handling in `lib/payments/verified-payment-event-processor.service.ts` on branch `production-closure-2026-10-07`.
- **Phase 2 Status:** Phase 2 maintained a strict zero-edit policy on all payment processing files. Combined integration testing remains `PENDING_INTEGRATION` until Phase 1 fixes are merged.

### DEF-P1-02: 41-Case Canonical PostgreSQL Financial Acceptance
- **Problem:** Canonical financial acceptance tests require dedicated single-worker PostgreSQL runs with verified settlement, ledger journals, and refund dual-control.
- **Phase 1 Ownership:** Directly dependent on Phase 1 financial completion (`lib/services/ledger-posting.service.ts`, `lib/marketplace-checkout/*`).

---

## 5. External Client & Commercial Blockers

All items listed in Section 2 under `EXTERNAL` are business decisions, legal confirmations, or operational credentials. They cannot be resolved autonomously by any AI coding agent and require formal human client sign-off as detailed in `docs/phase2-parallel/CLIENT_DECISIONS_REQUIRED.md`.

---

## 6. Conclusion & Readiness Assessment

- **Phase 2 Code & Test Health:** 100% of Phase 2 defects have been resolved. All 790 unit/policy test files pass cleanly (3,712/3,712 tests).
- **Combined Certification Status:** `BLOCKED_PHASE1` on financial consumer concurrency; `BLOCKED_EXTERNAL` on commercial rate confirmations and legal approvals.
- **Deployment Status:** `NOT_READY`. No live deployment authorized.
