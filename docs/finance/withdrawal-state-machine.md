# Withdrawal State Machine

`REQUESTED` already has a reserve journal. `UNDER_REVIEW` and `APPROVED` keep funds held. `PROCESSING` has one active manual payout attempt. `RECONCILIATION_REQUIRED` keeps funds held until an explicit, ledger-backed resolution. `PAID`, `REJECTED`, and `CANCELLED` are terminal.

Allowed transitions are `REQUESTED → UNDER_REVIEW|APPROVED|REJECTED|CANCELLED`, `UNDER_REVIEW → APPROVED|REJECTED|CANCELLED`, `APPROVED → PROCESSING|CANCELLED`, `PROCESSING → PAID|APPROVED|RECONCILIATION_REQUIRED`, and `RECONCILIATION_REQUIRED → APPROVED|PAID|CANCELLED`.

Payout attempts progress `RESERVED → PROCESSING → SUCCEEDED|FAILED|UNKNOWN`. A definite failure returns the withdrawal to `APPROVED` and retains the hold. An unknown outcome opens reconciliation and never triggers an automatic retry, release, or paid status.
