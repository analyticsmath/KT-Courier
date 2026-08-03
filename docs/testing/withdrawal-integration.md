# Withdrawal Validation Plan

`vitest.withdrawal-integration.config.ts`, the `withdrawal-*.integration.test.ts` files, and `scripts/withdrawal-integration-test.mjs` are intentionally deferred scaffolding. The runner refuses to execute without an explicit consolidated-validation approval flag and must later use an isolated disposable PostgreSQL Compose project, never a canonical volume.

Required proof includes request/reserve, exact-balance acceptance, one-cent rejection, concurrent overspend prevention, idempotency replay, cancellation/rejection release, approval, attempt lifecycle, unknown reconciliation, cash insufficiency, payout completion rollback, duplicate reference conflicts, maker-checker, destination suspension, and cross-module non-mutation.
