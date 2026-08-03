# Phase 13 — Withdrawals and Finance Administration

Phase 13 supplies the withdrawal foundation only. It evolves the dormant `WithdrawalRequest` placeholder into a ledger-backed owner withdrawal lifecycle and adds masked payout-destination, payout-attempt, policy, history, and reconciliation aggregates.

It does not create store, driver, or promoter earnings; move customer funds held into owner earnings; call a bank; collect account numbers; recognize revenue; charge a fee; mutate orders/payments; or activate production withdrawals. Customer withdrawals remain disabled.

An eligible owner is an active Store, Driver, or Promoter user with a valid ownership relation, active wallet, active `OWNER_WITHDRAWABLE` and `WITHDRAWAL_HELD` accounts, active policy, active masked payout destination, positive ledger balance, and no open withdrawal reconciliation restriction. Policies are seeded disabled and are server authoritative.

The production lock is reviewed source code, not a public environment setting. Production request creation and payout completion fail closed with `CONSOLIDATED_VALIDATION_NOT_APPROVED` until the consolidated validation gate is approved.

## Legacy placeholder compatibility boundary

The baseline `WithdrawalRequest` columns `reviewedByUserId`, `bankName`, `accountHolder`, `accountLast4`, `rejectionReason`, `metadata`, `reviewedAt`, and `paidAt` remain physically present to preserve additive migration history. They are each represented in Prisma as nullable `@map(...) @ignore` fields with no Prisma Client access. They are not validators, DTOs, API responses, seed data, payout evidence, or service inputs.

The migration fails closed before conversion if any placeholder withdrawal row exists. Once that boundary is passed, the Phase 13 compatibility constraint requires all eight retained fields to remain null. Structured withdrawals resolve a payout only through `WithdrawalRequest.payoutDestinationId` and `PayoutDestination`; they never fall back to a legacy field. Physical removal is deferred until the consolidated cleanup gate can prove no deployment, retention, or archival dependency remains.

Owner routes are `/account/withdrawals`, `/account/withdrawals/[publicReference]`, and `/account/payout-destinations`. Finance routes are `/admin/finance`, `/admin/withdrawals`, `/admin/payout-destinations`, and `/admin/withdrawal-reconciliation`. All money is returned as exact ZAR strings; owner views expose only masked destination metadata.

Future commission, store-earnings, and driver-earnings phases may credit `OWNER_WITHDRAWABLE` through their own approved allocation journals. They must not bypass the reservation, release, payout, policy, or maker-checker boundaries established here.
