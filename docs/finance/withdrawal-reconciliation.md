# Withdrawal Reconciliation

Reconciliation records unknown outcomes, duplicate references, stale processing, cash-clearing shortages, held-balance mismatches, incomplete evidence, and related safe anomalies. Cases are idempotent by case key and retain only safe summaries/evidence references.

There is no generic “mark withdrawal paid” action. Finance must either confirm no external payout through the ordinary failure/cancellation path, or confirm an external payout through the ordinary atomic completion path. Unresolved cases leave funds held and block new attempts.
