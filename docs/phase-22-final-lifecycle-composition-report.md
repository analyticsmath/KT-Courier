# KT Couriers Phase 22 Final Lifecycle Composition Report

## 1. Status

CORRECTION COMPLETE — DEEP VALIDATION DEFERRED TO PHASE 26.5

READY FOR ARCHITECT IMPLEMENTATION REVIEW

## 2. Renewal Provider-Event Application

Phase 12 verified ITNs now resolve invoice-bound recurring `PaymentAttempt`
evidence, then call the production subscription success hook. The hook resolves
the exact invoice, billing cycle, contract and authority; classifies initial,
renewal or duplicate evidence; validates payer, amount, currency, environment
and token fingerprint evidence; settles before activation; creates grants and
the recognition schedule; and creates the next exact renewal job. The unique
`SubscriptionRenewalApplication` record makes replay converge without duplicate
grants. Incoherent or out-of-order evidence opens reconciliation while the
successful Payment remains successful and customer funds remain held.

## 3. Rolling Cancellation

`requestSubscriptionCancellation`, `synchronizeProviderCancellation` and
`applySubscriptionCancellation` are canonical services. Request records the
end of the paid period, cancels future jobs and preserves paid grants. Provider
work occurs after the transaction and records cancelled, replay or unknown
evidence. Effective cancellation expires grants, voids future issued invoices,
cancels remaining jobs, appends status history and emits an event intent.

## 4. Provider Synchronization

`synchronizeSubscriptionProviderAuthority` locks the authority and contract,
passes only an opaque authority reference to the PayFast recurring adapter,
records safe observations and updates only synchronization state. Provider/
internal mismatches open a subscription reconciliation case. No synchronization
path pays invoices, creates cycles, grants entitlement, changes terms or exposes
a token.

## 5. Refund Composition

`requestSubscriptionRefund` composes the existing Phase 15
`createRefundRequest` aggregate and never creates a subscription refund
aggregate. It then calls `applySubscriptionRefundAdjustment`; it never marks a
provider refund complete.

## 6. Refund Accounting

`allocateSubscriptionRefundReversal` uses exact `Decimal` arithmetic and
deterministically allocates unrecognised deferred revenue before recognised
revenue. `subscriptionRefundReversalPosting` debits the corresponding
deferred/revenue (and authoritative tax payable when applicable) accounts and
credits the canonical customer-funds-held account. Immutable adjustment and
journal-link evidence is recorded; incoherent limits route to reconciliation.

## 7. Entitlement Reversal

`applySubscriptionEntitlementRefundAdjustment` revokes unused grants, releases
eligible active reservations through append-only usage evidence and records
refund-adjustment links. Consumed benefit history is preserved and opens
reconciliation rather than producing negative allowance or rewriting orders.

## 8. Administrative Recovery

| Route | Permission | Canonical service |
| --- | --- | --- |
| retry-activation | `subscription_billing.reconcile` | Phase 12 subscription payment hook |
| retry-settlement | `subscription_billing.reconcile` | Phase 12 subscription payment hook |
| retry-renewal | `subscription_billing.reconcile` | exact paid-invoice application hook |
| retry-provider-sync | `subscription_contracts.reconcile` | provider synchronization |
| retry-cancellation | `subscription_contracts.reconcile` | provider/effective cancellation |
| retry-refund | `subscription_billing.reconcile` | Phase 15 refund composition |
| retry-entitlement-reconciliation | `subscription_entitlements.reconcile` | entitlement refund adjustment |
| rescan | `subscription_contracts.reconcile` | canonical reconciliation case rescan |

Each route authenticates, honours explicit `DENY`, requires same origin, rate
limits, accepts only a strict `operationId` body, resolves the production
composition and returns safe evidence. No route has manual financial,
entitlement, token or contract-price controls.

## 9. Processors

All eight `.mjs` processors accept `--dry-run`, `--apply` and `--limit`.
Dry-run is read-only. Apply delegates to `scripts/subscription-processor.ts`,
which selects bounded candidates, derives deterministic operation IDs and calls
canonical TypeScript lifecycle services. The shell scripts never mutate ledger,
Payment, provider or refund state directly.

## 10. Renewal Recovery

Successful-but-unsettled and grant-missing paid invoices replay the exact
settle-and-activate hook. An event without a prepared cycle opens
reconciliation; a provider ambiguity synchronizes and reconciles rather than
recharging; cancellation processors canonically cancel future jobs.

## 11. API Support Matrix

| Operation | Status |
| --- | --- |
| Review, acknowledgement, initial preparation, end-of-period cancellation | supported and canonically composed |
| Contract, cycle, invoice, grant, usage, scheduled cancellation and safe provider status reads | supported read paths |
| Plan change, pause/resume, payment-authority update | intentionally unsupported/source-locked |
| Browser activation, manual mark-paid, manual grant, token replacement, direct ledger mutation | absent and prohibited |

## 12. Migration

Only `prisma/migrations/20260717140000_phase22_subscriptions/migration.sql`
was updated. It adds lifecycle operation receipts, provider synchronization
evidence, refund/accounting and entitlement-refund links, and renewal
application uniqueness. No Phase 21-or-earlier migration changed; the legacy
compatibility rename remains non-destructive.

## 13. Tests

Focused DB-free coverage is in:

- `tests/subscriptions/subscription-activation-hook.test.ts`
- `tests/subscriptions/subscription-renewal-dunning.test.ts`
- `tests/subscriptions/subscription-provider-event-resolution.test.ts`
- `tests/subscriptions/subscription-cancellation-lifecycle.test.ts`
- `tests/subscriptions/subscription-provider-synchronization.test.ts`
- `tests/subscriptions/subscription-refund-adjustment.test.ts`
- `tests/subscriptions/subscription-entitlement-refund.test.ts`
- `tests/subscriptions/subscription-lifecycle-source-audit.test.ts`
- existing subscription accounting, entitlement and Phase 22 source audits.

## 14. Lightweight Checks Actually Run

- `npx prisma format`
- `npx prisma validate`
- `npx vitest run tests/subscriptions --reporter=dot` — 16 files, 38 tests
- file-scoped ESLint for changed Phase 22 services/routes/scripts/tests
- `node --check` for every `*subscription*.mjs` script
- `git diff --check`

## 15. Deferred Validation

No installation, Prisma generation, migration deployment, seed, PostgreSQL,
Docker, provider call, full test suite, full typecheck, build, browser or CI
was executed.

## 16. Deferred Risks

Only Phase 26.5 runtime proof remains: deployed migration compatibility,
generated Prisma/type proof, PayFast recurring API semantics, provider-network
behavior, concurrent locking, PostgreSQL integration, browser/UI behavior and
full-suite/CI validation.

## 17. Final Confirmation

- Renewal ITN application is concretely wired.
- Cancellation and provider synchronization are concretely composed.
- Refunds use Phase 15 and accounting reversal is implemented.
- Unused entitlement is revoked; consumed use is preserved.
- Admin recovery and processors call canonical services.
- Production remains locked.
- No recurring merchandise orders, Phase 23 behavior, earlier-migration edits
  or secrets were introduced.
