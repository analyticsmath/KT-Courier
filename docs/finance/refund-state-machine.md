# Refund State Machines

## Refund aggregate

| From | Allowed destination |
|---|---|
| REQUESTED | UNDER_REVIEW, APPROVED, REJECTED, CANCELLED |
| UNDER_REVIEW | APPROVED, REJECTED, CANCELLED |
| APPROVED | PROCESSING, SUCCEEDED, CANCELLED |
| PROCESSING | SUCCEEDED, APPROVED, RECONCILIATION_REQUIRED |
| RECONCILIATION_REQUIRED | PROCESSING, SUCCEEDED, CANCELLED |
| SUCCEEDED | terminal |
| REJECTED | terminal |
| CANCELLED | terminal |

Funds are already reserved in `REQUESTED`. They remain reserved through `UNDER_REVIEW`, `APPROVED`, `PROCESSING`, and `RECONCILIATION_REQUIRED`. `REJECTED` and `CANCELLED` require exact release evidence. `SUCCEEDED` requires exactly one completion journal and forbids a release journal.

## Provider attempt

| From | Allowed destination |
|---|---|
| RESERVED | PROCESSING |
| PROCESSING | SUCCEEDED, FAILED, UNKNOWN |
| UNKNOWN | PROCESSING, SUCCEEDED, FAILED |
| SUCCEEDED | terminal |
| FAILED | terminal |

Attempt numbers are allocated while the refund row is locked. A provider success must be definitive and carry a unique provider refund ID. A definite failure leaves funds held and returns the aggregate to `APPROVED`. `UNKNOWN` opens reconciliation and permits no blind new attempt.

Every transition appends immutable safe history. Application services, not arbitrary API fields, own state changes.
