# Payfast Confirmation Deferred Integration Validation

The Phase 12 live runner is `npm run test:integration:payfast-confirmation`. It is scaffolding only and was not executed during implementation.

When authorized, it creates a uniquely named disposable Compose project and database, refuses the canonical project name, starts only its disposable database, deploys migrations, seeds zero-balance foundations, runs Phase 12 preflight, runs `vitest.payfast-confirmation-integration.config.ts` serially, runs confirmation invariants, and removes only its verified disposable project/volume.

Tests inject deterministic DNS, source address, query-validation result, and clock. They never contact Payfast. Scenarios cover verified complete, exact/concurrent duplicate, changed body, both provider-reference conflicts, source/signature/merchant/amount rejection, provider unavailability, pending/failure/unknown precedence, stale and conflicting evidence after success, complete after unknown, credential mismatch, scanner idempotency, full rollback, ledger lock race, evidence links/projections, and no Order/dispatch/driver/pricing mutation.

Browser scaffolding uses controlled local notification fixtures for return-before-ITN, verified notification, duplicate delivery, webhook/reconciliation admin inspection, explicit permission denial, and visible/storage/URL/JSON secret safety. It must run Chromium only with traces on failure and no external Payfast request.

Deferred CI jobs `payfast-confirmation-integration` and `payfast-confirmation-e2e` require `ENABLE_DEFERRED_PAYFAST_CONFIRMATION_VALIDATION=true`. They must not be enabled until the architect authorizes the consolidated gate.

Before execution, validate the migration against a clean bootstrap and canonical migration chain, generate Prisma Client, typecheck/build, confirm the reverse-proxy contract, and verify the environment is disposable. Never reset or delete the canonical database or retained volume.
