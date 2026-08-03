# Checkout repricing

Every checkout review re-resolves offer, variant, price version, modifiers,
inventory, serviceability, quote and commission evidence. Price increases,
quantity reductions and unavailable lines are explicit changes; acknowledgement
is required before reservation. Client totals and fees are never authoritative.

For every fully reviewable store group the same Serializable review transaction
freezes seller-settlement evidence: approved seller identity/version, commission
plan/rule/calculation version, deterministic line allocations and policy/tax
references. The evidence-version set is part of the commercial fingerprint and
acknowledgement. If any group cannot produce it, the whole review fails closed.
