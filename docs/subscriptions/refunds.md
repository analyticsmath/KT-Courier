# Subscription refunds

Subscription refunds reuse the Phase 15 `PaymentRefund` aggregate and original
Payment by default. Refund/entitlement mismatch opens reconciliation; no
separate balance writer, provider-completion bypass or cash entitlement exists.
