# Phase 20 marketplace checkout

Phase 20 introduces separate cart, checkout, reservation, Payment binding,
marketplace order, store order and settlement snapshot aggregates. It is source
locked pending Phase 26.5: no production reservation, payment preparation,
authoritative finalisation or settlement is enabled.

## Review-owned settlement evidence

Review atomically persists one immutable settlement authority per store group and
one allocation per reviewed line. It freezes approved legal seller identity,
versioned commission plan/rules, policy references, tax classification and exact
ZAR allocation evidence. Seller basis is merchandise plus modifiers only; delivery
fees are retained separately. A changed review creates new evidence and invalidates
the prior acknowledgement.

The paid-checkout finalizer consumes the acknowledged evidence rather than looking
up current seller identity or commission plans, and creates a traceable settlement
snapshot. Missing, stale or mismatched evidence is reconciliation-required. This
does not authorize Phase 21 acceptance, fulfilment, cancellation or refunds.
