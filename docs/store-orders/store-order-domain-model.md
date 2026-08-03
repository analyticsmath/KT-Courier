# Store-order domain model

`MarketplaceOrder` is the parent purchase; `MarketplaceStoreOrder` is one seller's immutable paid obligation; `Order` is the existing courier execution; `MarketplaceStoreOrderAdjustment` and `PaymentRefund` are separate financial obligations. Phase 21 adds operational policy/snapshot, line fulfilment, issues, substitution holds/decisions, amendments, history/operations, bridge, handoff, outbox intent and reconciliation records. Original Phase 20 lines and snapshots are never rewritten.
