# Driver earning deferred integration validation

The gated runner creates a unique Compose project, disposable database, shadow database, credentials, port and volume namespace; it refuses the canonical project, disables external network access, deploys migrations, seeds structural permissions only, runs the dedicated Vitest config serially, and removes the disposable volume.

Seven PostgreSQL files encode all 40 numbered scenarios across accrual/assignment/handoff, concurrency/idempotency/rollback, release, refunds/final cents, reversal/commission coordination, scanner behavior and cross-module/production-lock invariants. Two skipped Playwright files cover driver ownership/privacy and finance evidence/explicit-DENY/control absence. CI jobs are gated by `ENABLE_DEFERRED_DRIVER_EARNING_VALIDATION`; Chromium retains traces/screenshots/video only on failure through the repository Playwright config.

Do not run these against a canonical database. Deep validation must include Prisma generation/drift/typecheck, clean bootstrap, live assignment/POD compatibility, concurrent store-plus-driver attribution, refund/release races, Phase 13 transfer and browser flows.
