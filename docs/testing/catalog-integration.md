# Catalog integration validation

`vitest.catalog-integration.config.ts` selects only Phase 18 PostgreSQL scaffolds. `scripts/catalog-integration-test.mjs` refuses to run unless `KT_CATALOG_INTEGRATION_APPROVED=true`, creates a uniquely named disposable Compose project/database/port, prohibits network egress, and refuses the canonical project name.

Scenarios cover taxonomy cycles, product-type immutability, canonical/store-private products, variants/options/GTIN, store SKU, price periods/concurrency, movement locking/replay, moderation/restrictions, modifiers, imports, snapshots/events, cross-store denial, rollback, production lock, and absence of cart/order/payment/earnings writers.

Do not run this suite before Phase 26.5 authorization. It must never touch the canonical volume.

