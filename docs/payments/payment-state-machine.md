# Payment state machines

## Aggregate transitions

| From | Allowed next states |
|---|---|
| `CREATED` | `PROVIDER_PENDING` |
| `PROVIDER_PENDING` | `REQUIRES_ACTION`, `PROCESSING`, `FAILED`, `EXPIRED`, `CANCELLED` |
| `REQUIRES_ACTION` | `PROCESSING`, `SUCCEEDED`, `FAILED`, `EXPIRED`, `CANCELLED` |
| `PROCESSING` | `SUCCEEDED`, `FAILED`, `EXPIRED`, `CANCELLED` |
| `FAILED` | `PROVIDER_PENDING` |
| `EXPIRED` | `PROVIDER_PENDING` |
| `SUCCEEDED` | none |
| `CANCELLED` | none |

`CREATED` has no active provider work. `PROVIDER_PENDING` has a durable reserved attempt. `REQUIRES_ACTION` has a validated customer action. `PROCESSING` is accepted or unknown but not final. `SUCCEEDED` is authoritative provider confirmation but posts no ledger evidence in Phase 10. `FAILED` is definite. `CANCELLED` and `EXPIRED` are explicit final/session outcomes. Failed and expired are the only retry reservation states. Direct status assignments outside preparation/session services are prohibited.

For Phase 11 Payfast, form construction and browser handoff end at `REQUIRES_ACTION`. Rendering/submitting the form, returning from Payfast, or visiting the cancel page cannot move payment/attempt state. Only future verified Phase 12 provider evidence may establish an authoritative result.

## Attempt transitions

| From | Allowed next states |
|---|---|
| `RESERVED` | `REQUESTING`, `FAILED`, `CANCELLED`, `EXPIRED` |
| `REQUESTING` | `REQUIRES_ACTION`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED`, `UNKNOWN` |
| `REQUIRES_ACTION` | `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED`, `UNKNOWN` |
| `PROCESSING` | `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED`, `UNKNOWN` |
| `UNKNOWN` | `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED` after later proof |
| `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED` | none |

UNKNOWN means the operation may have reached the provider but no definitive response was safely persisted. It is non-terminal for future verified lookup/reconciliation, but it blocks creation of another attempt. It never aliases failure. Terminal attempts cannot reopen.

Same-state observation is idempotent in policy helpers; services still use version checks and do not create duplicate history for a no-op. An immediate authoritative success is recorded as payment `PROVIDER_PENDING -> PROCESSING -> SUCCEEDED`, preserving the central aggregate transition graph.
