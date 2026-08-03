# Phase 27 notification architecture

Business authorities append durable intents; Phase 27 receives them idempotently, resolves one active route and exact recipients, freezes a logical message, then creates in-app and eligible external delivery records. Provider acceptance is not delivery confirmation. External providers are `NotConfigured` and return stable configuration failures until an approved adapter and Phase 30 validation are present.

The legacy `Notification` table is compatibility-only. New writes target the `Notification*` Phase 27 models; the historical channel enum is not altered.
