# Store-order integration scaffolding

`vitest.store-order-integration.config.ts` targets only `store-order-*.integration.test.ts` and must use a uniquely named disposable PostgreSQL database, never a canonical volume. The scaffold covers acceptance, substitution, adjustment, refund, inventory, bridge, handoff, reconciliation and invariants. It is intentionally deferred and not executed in Phase 21.
