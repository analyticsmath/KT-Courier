# Store settlement

Settlement snapshots freeze reviewed commission policy/version, seller basis,
commission, store earning and line allocations. Seller basis comprises merchandise
and modifiers; delivery fee is a separately traceable residual. Phase 14/16
services remain the only accounting writers; no PayFast split payment or driver
earning is created.

Settlement authority originates in accepted checkout review, not finalization-time
store data. Per-line seller basis, commission and earning use stable ordering and
deterministic final-cent allocation. `seller basis - commission = net store
earning`, and all line sums reconcile to the store group. Legal/VAT classification
is documented implementation evidence, subject to later legal approval.
