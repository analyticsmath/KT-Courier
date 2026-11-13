# KT Couriers — Phase 3 independent launch gate remediation
Date: 13 November 2026
Audited source: `a090c77d564b5e04c3f3e12fc020bcacaab2808e`

## Exact verified engineering evidence

- Main CI [43357313047](https://github.com/analyticsmath/KT-Courier/actions/runs/43357313047) passed on the exact SHA.
- [Production Certification 43357312918](https://github.com/analyticsmath/KT-Courier/actions/runs/43357312918) completed with **25 automated engineering jobs passed** and **one deliberate independent Phase 3 launch-veto failure**. User-supplied detailed counts: 5,552 quality tests, 221 disposable PostgreSQL tests across 39 files and 154 Chromium cases with no failure, skip or flake.
- Vercel production deployment at this SHA is READY; Railway web/operations services have SUCCESS deployments and are online.
- `docs/production-closure/engineering-gates.json`: **28 gates, 19 IMPLEMENTED, 6 OPEN, 3 VALIDATION_BLOCKED.** Commercial release remains `NOT_READY`.

## Root cause of exit 1

`node scripts/check-closure-engineering-gates.mjs` is an intentionally fail-closed **live-launch authorization** check. It returns nonzero for `NOT_READY` or any blocked gate; a passing build, PostgreSQL matrix and Chromium test run cannot override that decision. The code's exact-source check was hardened: missing, partial or mismatched `KT_CERTIFICATION_HEAD_SHA` can no longer be treated as matching launch provenance. Do not use synthetic approvals, `continue-on-error`, false bank/provider events, or manually set the registry READY.

## Required closure for each remaining launch gate

| Gate | State | Accountable party and required proof |
|---|---|---|
| marketplace_parcel_classification | OPEN | Owner-approved genuine merchant parcel/package dimensions and packing rules; physical multi-item quote, load and delivery acceptance |
| notification_required_domains | OPEN | Business owner-approved templates and event routes; real provider and recipient delivery evidence |
| commercial_financial_certification | VALIDATION_BLOCKED | Independently approved finance, tax, Paystack test scope, COD limits, commission, bank/reconciliation and active StoreOrderOperationalPolicy |
| customer_vendor_driver_full_functional_acceptance | OPEN | Owner-created real-email roles, approved real store pickup, certified driver/vehicle, actual pickup OTP, GPS, delivery OTP/POD, finance closeout |
| visual_acceptance | OPEN | Human role/device review on 320/390/1440, keyboard, focus and assistive technology |
| media_full_functional_acceptance | OPEN | Authorized live Cloudinary/private-media, mobile camera/GPS and genuine POD acceptance |
| critical_skip_closure | OPEN | Reconcile deferred/skip inventory with mandatory tests; human-approved exclusions for disabled optional processors, not a silent pass |
| fresh_production_protected_row_audit | VALIDATION_BLOCKED | Least-privilege read-only DB principal; fresh protected-table hash/count baseline and independent comparison |
| github_certification_and_deployment | VALIDATION_BLOCKED | Exact-SHA runtime/worker/policy/queue verification and independent operations signoff beyond green deployment |

## Engineering work and useful commands

Review inactive processor capabilities: asynchronous report and artifact generation/expiry, subscription renewal, developer webhook delivery/credential expiry, promotion expiry, advertising click billing and promoter qualification. Identify those actually approved and required at launch; finish production-ready implementations with concurrency, retries, idempotency, privacy and error tests, or preserve explicit `EXCLUDED_WITH_SCOPE` for unapproved features. Never switch on billing, payroll, commissions, external notifications or payouts merely to obtain a green certification.

Execute `node --test tests/scripts/phase3-blocker-actions.node-test.mjs` and `node scripts/report-phase3-blockers.mjs`. The second command writes `output/production-closure/phase3-blocker-actions.json` describing accountable owners, actions and evidence; it does **not** perform, imply or bypass Phase 3 authorization. The independent `node scripts/check-closure-engineering-gates.mjs` stays fail closed until genuine launch evidence is accepted.

Collect actual approvals in restricted operator records, not source control. No passwords, card data, OTPs, keys, bank account numbers, private ID media, or invented provider receipts belong in evidence. Reference `PARCEL_REAL_ACCOUNT_ACCEPTANCE_MATRIX_2026-11-12.md`, `REAL_MONEY_ACCEPTANCE_RUNBOOK.md`, and `ENGINEERING_ACCEPTANCE_REPORT_2026-11-13.md`.

## Product owner-dependent acknowledgements

`AWAITING_OWNER_TEST_ACCOUNT`, `AWAITING_FINANCE_REVIEWER`, `AWAITING_PROVIDER_TEST_AUTHORIZATION`, `AWAITING_OPERATOR_ACCEPTANCE`, `AWAITING_COMMERCIAL_APPROVAL`. Preserve actual statuses until each reviewer provides source-bound proof.
