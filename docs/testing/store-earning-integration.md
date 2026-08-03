# Store Earning Deferred Integration Validation

Phase 16 integration and browser tests are deliberately written but not executed. `npm run test:integration:store-earnings` refuses to start unless `KT_STORE_EARNING_INTEGRATION_APPROVED=true` is explicitly set by the deferred-validation workflow.

When approved, the runner derives a unique `kt-couriers-store-earning-*` Compose project, uniquely named database and shadow database, isolated port, and disposable credentials. It refuses the canonical Compose project/database, starts only its own database, deploys migrations and base permission seed inside the disposable project, runs one deterministic Vitest worker with external network disabled, and removes its volumes in `finally`.

Seven PostgreSQL files encode all 32 required scenarios: accrual, multi-store, commission links, arithmetic, replay/conflict/uniqueness/concurrency, over-attribution/held funds/rollback, release, partial refund lifecycle/final cents/inference/released block, reversal/commission coordination/rollback, reconciliation, accounting and cross-module invariants, and source lock.

Two Playwright specs encode store and finance journeys. Deferred CI uses Chromium only and the repository's failure-only trace policy. Neither suite may use the canonical database volume or an external payment/network fixture.

Before activation, run clean bootstrap/deploy, Prisma generation/drift/typecheck, all focused and integration suites, invariant scripts, production build, Chromium E2E, permission/DENY tests, and the cross-phase audit under architect-approved conditions.
