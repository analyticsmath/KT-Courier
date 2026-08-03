# KT Couriers Phase 22 Architect Correction Report

## 1. Status

CORRECTION COMPLETE — DEEP VALIDATION DEFERRED TO PHASE 26.5.

READY FOR ARCHITECT IMPLEMENTATION REVIEW.

## 2. PayFast Recurring Mode

`PROVIDER_MANAGED_SUBSCRIPTION` is the initial monthly rolling target.
`PLATFORM_SCHEDULED_TOKEN` remains modelled and source-locked; it cannot send
an external charge.

## 3. PayFast Recurring Protocol

The recurring adapter uses pinned `https://api.payfast.co.za`, REST signing,
integer ZAR cents, timeout/redirect/response bounds, safe JSON normalization,
operation-id idempotency headers and unknown-outcome reconciliation. It does
not use the custom checkout signer.

## 4. Recurring Authorization

The customer action is a recurring authorization action whose merchant
reference is the exact immutable subscription invoice. It carries no CVV,
split payment, raw token or browser-authoritative activation path. Token
capture is encrypted/fingerprinted through the server vault or fails closed
with `PROVIDER_TOKEN_STORAGE_UNAVAILABLE`.

## 5. Provider Event Resolution

The recurring resolver checks invoice reference, provider payment reference,
token fingerprint, payer, amount, currency, environment and cycle before
classifying initial payment, renewal payment, duplicate or reconciliation.
Phase 12 remains the verified ITN authority.

## 6. Invoice Financial Settlement

`settleAndActivatePaidInvoice` locks Payment/invoice/cycle, then posts exactly
one canonical debit from `PLATFORM-CUSTOMER-FUNDS-HELD-ZAR` to
`PLATFORM-SUBSCRIPTION-DEFERRED-REVENUE-ZAR` (and tax payable where
authoritative tax exists). A unique settlement record preserves the evidence.

## 7. Revenue Recognition

Subscription schedules and entries use cumulative daily straight-line target
allocation. The recognition journal debits deferred revenue and credits
`PLATFORM-SUBSCRIPTION-REVENUE-ZAR`; the final-cent delta is deterministic.

## 8. Contract Activation and Renewal

The chain is verified Payment → settlement → invoice/cycle/contract activation
→ grants → recognition schedule → next renewal job. Renewal lifecycle services
create/prep exact next-cycle evidence and reject unprepared provider outcomes.

## 9. Dunning

The dunning service separates definite failures from `UNKNOWN`: only definite
failure enters bounded policy/grace handling, while unknown outcome opens
reconciliation and never creates a blind retry.

## 10. Entitlements

Paid activation creates grants. The canonical usage service appends
reserve/consume/release/reverse evidence, enforces remaining allowance and
supports idempotent operation keys.

## 11. Delivery Benefit Integration

Phase 6 supplies the authoritative base quote; the Phase 22 adapter resolves
an active paid grant, reserves it, bounds the adjustment to a non-negative fee,
and sends the adjusted quote into Phase 20 review freeze.

## 12. Commission Eligibility Integration

Phase 20 consumes an active paid store grant only as an approved Phase 14 plan
reference/version constraint, then freezes the Phase 14 plan evidence. It
does not calculate or mutate a commission rate.

## 13. Cancellation and Contract Changes

Rolling end-of-paid-period cancellation request evidence is implemented. Plan,
price, pause/resume and provider cancellation/update execution remain explicitly
source-locked until provider semantics are validated; pause/resume are not
claimed as launch functionality.

## 14. Refund and Entitlement Reversal

Subscription refund requests compose Phase 15 and never create a second refund
aggregate. Entitlement/revenue reversal uses reconciliation evidence pending
the Phase 26.5 deployed Phase 15/provider proof.

## 15. Customer and Store APIs

| Surface | Read endpoints | Mutation status |
| --- | --- | --- |
| Customer | plans, contracts, invoices, entitlements, usage | review/acknowledgement/initial preparation/cancellation are guarded; pause, resume, plan change and authority update are source-locked. |
| Store | plans, contract, invoices, entitlements, usage | exact-store owner/delegated billing with explicit `DENY`; unsupported mutations are source-locked. |

No response includes provider tokens or credentials.

## 16. Administrative Recovery

Subscription permissions intentionally contain no mark-paid, manual-grant or
token-write authority. Existing reconciliation reads are guarded; retry
activation/settlement/renewal/provider/cancellation/entitlement/refund/rescan
execution remains production-locked until canonical deployed composition is
validated.

## 17. Processors

The eight processor entry points accept `--dry-run`, `--apply` and `--limit`
and identify their canonical service. `--apply` fails closed with
`CONSOLIDATED_VALIDATION_NOT_APPROVED` until validation approval.

## 18. Legacy Migration Compatibility

The unapplied migration is a non-destructive compatibility migration. It
renames `SubscriptionPlan`, `StoreSubscription`, `SubscriptionInvoice` and
`SubscriptionInvoiceStatus` to explicit legacy names, retaining rows, foreign
keys, indexes and legacy Prisma mappings. No Phase 21-or-earlier migration was
changed; active runtime source has no obsolete legacy writer.

## 19. Tests

Focused DB-free tests cover:

- PayFast recurring signing, cents, pinned endpoint, fetch/cancel and token redaction;
- activation/settlement failure behavior and provider-event resolution;
- settlement/revenue journals and final-cent allocation;
- paid-grant delivery and Phase 14 eligibility composition;
- renewal/dunning policy;
- existing payment-subject, review, API-contract and source-audit coverage.

## 20. Lightweight Checks Actually Run

`npx prisma format` and `npx prisma validate` passed. Scoped ESLint passed.
The focused Vitest command passed **13 files / 28 tests**. `node --check`
passed for every `*subscription*.mjs` processor, and `git diff --check` passed
(the pre-existing dirty worktree emitted only CRLF warnings in unrelated root
files). These were the only validation commands used.

## 21. Validation Deferred

No database deployment, Prisma generation, seed, PostgreSQL integration,
Docker, provider call, build, browser, full typecheck, full suite or CI ran.

## 22. Deferred Risks

Only Phase 26.5 runtime risks remain: deployed rename/trigger proof, generated
client drift, PayFast recurring contract validation, encrypted token facility
approval, live ITN behavior, concurrency, cross-service delivery/finalization,
refund accounting and browser/accessibility proof.

## 23. Final Confirmation

- Custom checkout signing is not used for recurring API calls.
- Recurring tokens are encrypted/fingerprinted and never exposed.
- Initial/renewal event policy maps to exact invoices.
- Successful subscription funds leave customer-funds-held through settlement.
- Deferred revenue and recognition use exact Decimal evidence.
- Paid-cycle settlement precedes entitlement creation.
- Phase 6/20 reserve delivery benefits canonically; Phase 14/20 freeze store eligibility canonically.
- Cancellation prevents future renewal creation; refunds reuse Phase 15.
- Revenue/entitlement reversal is reconciled rather than manually overwritten.
- Production remains locked; no recurring merchandise orders or Phase 23 behavior exists.
- No earlier migration changed and no secret is documented or returned.
