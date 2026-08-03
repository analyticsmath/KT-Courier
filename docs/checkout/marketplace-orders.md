# Marketplace orders

After authoritative payment confirmation only, one immutable parent order and
one immutable `PENDING_SETTLEMENT` child store order per checkout group are
created atomically with snapshots. The finalizer loads the customer-acknowledged
review's frozen seller evidence and line allocations; it neither recalculates
commission nor reads mutable seller identity. Each snapshot traces checkout,
review, group, evidence, fingerprint and payment through to the store order and
accrual. No acceptance, picking, fulfilment, driver or other Phase 21 transition
is introduced.
