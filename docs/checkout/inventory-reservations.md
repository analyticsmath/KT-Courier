# Inventory reservations

Carts do not reserve stock. A reviewed checkout may obtain a bounded reservation
through canonical inventory movements (`RESERVATION`, `RESERVATION_RELEASE`,
`SALE_COMMITMENT`). Definite payment failure may release stock; `UNKNOWN` or
processing payment outcomes retain the hold and open reconciliation.
