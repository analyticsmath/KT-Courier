# Marketplace checkout integration validation

The Phase 26.5 integration harness must use a uniquely named disposable Compose
project and must never touch canonical volumes. It must prove guest isolation,
optimistic/idempotent cart mutations, price changes, reservation races/expiry,
unknown payment holds, ITN-only finalisation, parent/store grouping and settlement
replay. It is scaffolded but intentionally not run in Phase 20.
