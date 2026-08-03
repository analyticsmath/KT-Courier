# R21 financial interface model

## Authority boundary

R21 is presentation-only. Ledger and money values are canonical fixed-decimal
ZAR strings from the existing query services. The browser formats those strings
for display and performs no arithmetic, rounding, reconciliation, completion,
or provider-success inference.

| Area | Existing authority | R21 presentation rule |
| --- | --- | --- |
| Command centre | `getFinanceDashboard` | Four source-backed attention tiles, then bounded evidence queues and definition lists. No executive chart or fabricated KPI. |
| Ledger | `listLedgerAccounts`, `listLedgerJournals` | Read-only filtered/paginated projections. Journals remain immutable; an inverse journal is the only correction model. |
| Payments | `payment-query.service` and canonical payment attempts/history DTOs | Display provider-neutral state, exact amount/currency, attempt metadata and history. No signature, header, payload, secret, or browser success inference. |
| Payment reconciliation | `payment-query.service` reconciliation DTOs | Cases remain `OPEN`, `MONITORING`, `RESOLVED`, or `CLOSED` as returned. Reconciliation never posts a journal or marks a payment successful. |
| Refunds | `refund-query.service`, refund page permission, canonical actions | Requested, approved, held, completed and reconciliation-required states stay distinct. Unknown attempts retain funds; processing eligibility and the production lock are projected server-side. |
| Withdrawals and payouts | `withdrawal-query.service`, `withdrawalProductionReadiness` | Reserved, approval, payout attempt and reconciliation evidence are separate. There is no generic “mark paid” UI and destinations remain masked. |
| Store/driver earnings | existing store/driver finance query services | Accrued, payable, reserved, refunded, released, reversed and reconciliation values remain distinct source projections. |
| Promoter earnings/commissions | existing promoter/commission query services | R21 presents canonical references and amounts only. It does not calculate commissions, alter attribution, or perform manual earning actions. |

## Control safeguards

- `ADMIN` remains subject to the existing server permission checks, including
  explicit DENY precedence. `SUPER_ADMIN` continues through the same server
  authority, never a client-only bypass.
- Route guards, service calls, query parameters, pagination, optimistic
  versions, action endpoints, idempotency and maker-checker policy are
  unchanged.
- Finance action islands receive only server-projected affirmative capabilities
  and safe identifiers. They wait for the existing canonical response.
- Provider credentials, signing secrets, raw evidence, bank details, account
  internals, session data and raw Prisma records are not passed to client
  presentation.
- Unknown and newly introduced state values render neutral until added to the
  explicit `presentR21Status` mapping.

## Locks and intentionally deferred work

The existing payment, refund, withdrawal, subscription, promotion, advertising
and marketplace production locks are unchanged. R21 adds neither live provider
activation nor financial lifecycle implementation. Report/export backends are
absent from the route tree; the `reports.*` permission placeholders are not
presented as a working export feature.

## State, concurrency and regression policy

Payment states and attempts retain the existing state machine: `UNKNOWN` is not
failure or success and blocks an unsafe new attempt. Refund unknown attempts
keep the reserve and require reconciliation. Withdrawal payout attempts retain
the canonical `RESERVED → PROCESSING → SUCCEEDED|FAILED|UNKNOWN` meaning; no
screen infers completion. Earnings and commission values remain discrete source
projections.

All changes preserve service-owned optimistic version checks, database locking,
idempotency receipts and maker/checker exclusions. Focused R21 tests scan for
browser arithmetic, direct legacy finance primitives, route preservation and
unknown-state neutrality; focused R20 tests protect the commerce/finance split.
