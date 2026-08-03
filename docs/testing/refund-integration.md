# Refund Integration Validation Plan

Phase 15 integration and browser tests are written as deferred scaffolding and were not executed during implementation.

`scripts/refund-integration-test.mjs` requires `KT_REFUND_INTEGRATION_APPROVED=true`. The fixture additionally requires a uniquely named `kt-couriers-refund-*` Compose project and a test/refund-marked database URL. The canonical database volume must never be used. CI jobs are gated by `ENABLE_DEFERRED_REFUND_VALIDATION`; the provider is deterministic and makes no Payfast network request.

The PostgreSQL scenarios cover full/partial/multiple/final-cent refunds, one-cent over-refund, concurrent row-lock behavior, same-key replay and changed-payload conflict, platform/beneficiary commission clawback, downstream-release blocking, exact cancellation/rejection release, wallet completion and rollback, provider success/failure/unknown/query, duplicate evidence and ID conflicts, insufficient cash, maker-checker, immutable data, no payment/order mutation, no fee, no banking data, and the production lock.

The browser scaffolds cover customer wallet/refund headings, balances, transaction history, full/partial request validation, lock explanation, cancellation, status privacy, finance review/approval/separate processing, provider fixture, reconciliation, funding breakdown, explicit DENY, and absence of banking, credentials, amount editing, and mark-success controls. Deferred CI uses Chromium only and the repository Playwright configuration retains failure-only traces.

Consolidated validation must run migration bootstrap/deploy, Prisma generate/typecheck/drift, invariant scripts, integration suites, browser suites, production build, and security review in an isolated environment. Results must be reported as executed evidence, never inferred from scaffolding.
