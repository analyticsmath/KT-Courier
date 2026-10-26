# Vendor CSV product draft import — 27 October 2026

## Engineering implementation

The vendor Imports page now uploads real CSV content, persists normalized rows and row errors, validates a durable preview, and applies clean batches through the canonical private-product command. Batches are bounded to 100 rows / 64 KB. Quoted commas, doubled quotes, CRLF, BOM and embedded newlines are supported. Unsupported headers, malformed quoting, formula/HTML/remote URL cells, oversized content and invalid attribute data fail safely.

The selected approved product type and active category are verified server-side. The authenticated store is authoritative. Import validation and application lock the job; application creates all private DRAFT products, default variants, row confirmations and audit evidence in one transaction. A failure rolls the whole batch back; concurrent/repeated apply returns the same completed job. No offer, price, stock, public listing or commercial approval is created by applying the CSV.

Imported product pages now offer photo attachment and store-offer creation, and link to existing offers for price correction. Uploaded photos retain the private validated media pipeline. Already attached assets are excluded from the picker. Existing product, price, packaging and publication rules remain in force.

## Executed evidence

- Parser, command/schema and ownership/replay unit regressions: passed.
- Full local regression after implementation: 4,869 tests across 981 suites passed.
- TypeScript, changed-file ESLint and diff whitespace checks: passed.
- Browser/workflow execution-plan assertions: 16 passed.
- Published import release: `4e574a6fcec1a81729d639a85d95d076922ed8b6`.

## Certification correction and pending acceptance

The first exact-source closure job, run `40385306885`, job `121792428418`, executed 213 tests: 210 passed and the three new import cases failed before application execution. Their shared fixture expected the catalog runner's `disposable` role; this job deliberately uses `kt_closure_test`. The follow-up supplies that exact named role while keeping all network/database isolation checks and default catalog assertions unchanged. The failed job is retained as evidence; it is not a product-transaction pass.

The corrected PostgreSQL suite must prove durable preview, atomic private-draft creation, concurrent replay, cross-store denial and whole-batch rollback on canonical refusal. Chromium cases at 320/390/1440px must prove upload, errors, reload/recovery, application, photo attachment, offer creation and tenant denial. Added tests are not counted as passing until execution receipts confirm them.

Local PostgreSQL installation was unavailable in the workspace (container/package permissions). No production database was used to work around isolation. Production test-store mutations, real legal identity verification, finance activation, payment or settlement have not been performed for this import release.

Phase 2 remains open until the relevant exact-source database, browser, deployment and remaining role-journey gates pass. This file is an engineering checkpoint, not commercial launch certification.
