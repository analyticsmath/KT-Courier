# Phase 10 deferred-validation risk register

Phase 10 status is implementation complete with deep validation deferred. Nothing below is claimed as passed unless listed in the final implementation report's actually-run checks.

| Area | Deferred proof | Current risk / likely correction files |
|---|---|---|
| Migration | Clean bootstrap; deployment after Phase 9; fail-closed legacy preflight; enum alteration/default ordering; FK/trigger/index creation | PostgreSQL enum timing and trigger SQL need live proof. `prisma/migrations/20260717020000_phase10_payment_provider_foundation/migration.sql`, preflight script. |
| Schema | Prisma validation/generation, drift, mapped compatibility columns, constraint/trigger behavior | Generated-client alignment and mapped ignored fields may need correction. `prisma/schema.prisma`, `types/db.ts`, schema tests. |
| State machine | Complete payment/attempt policy suite | Pure tests cover declared matrices, but full suite/lint/type generation are deferred. `lib/payments/*state-machine.ts`. |
| Concurrency | Preparation convergence, attempt counter races, conditional finalization, unique-winner rereads | Serializable behavior and transaction mocks require live PostgreSQL proof. preparation/session services and integration tests. |
| External calls | Timeout race, crash windows, UNKNOWN persistence and later recovery | Fake-only behavior is encoded; no real adapter/status lookup exists. Provider session service and Phase 12 reconciliation design. |
| Security | Recursive snapshot redaction, byte/depth limits, redirect host safety, error/DTO leakage, public-variable audit | Requires full source/dependency/static review and hostile fixtures. provider policies, DTOs, pages/routes. |
| API | 401/403/DENY/SUPER_ADMIN, malformed filters, 404, safe serialization, 405 boundary | Focused tests are written but full API suite is not run. admin payment routes, validation and query service. |
| UI | Next.js compile, loading/error behavior, accessibility, filters/pagination and visible-body secret check | Production build and browser are prohibited here. payment pages/components and E2E spec. |
| Docker | Disposable runner and production image/runtime | No Docker command is run. integration runner, Compose and CI jobs. |
| Cross-module | No ledger/wallet/order/dispatch/driver mutation | Source audits are written; live DB invariants remain deferred. payment services, verifier, integration tests. |

## Implementation assumptions

- Phase 4 payment, attempt, refund and webhook tables contain no retained rows, consistent with accepted Phase 9 audit. Any row blocks migration rather than receiving invented identity or success.
- Current courier orders created from Phase 6 have a linked used quote and copied quote ID/version/subtotal/tax/total evidence. Only PENDING, CONFIRMED and PICKUP_SCHEDULED are Phase 10 payable.
- Phase 10 has no runtime caller for checkout-session creation; therefore production PayFast and callback configuration can remain absent and fail closed.
- Empty Phase 4 aggregate provider-result columns remain database compatibility columns but are ignored by Prisma/runtime. A later cleanup migration may drop them only after deployment evidence.
- Provider `SUCCEEDED` is state evidence only and intentionally does not settle the ledger or change the order.

## Exact consolidated-gate commands

Run only in the later architect-approved consolidated gate, in this order and with a disposable database where applicable:

```text
npx prisma validate
npx prisma generate
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run docker:migration-smoke
npm run test:integration:payment-foundation
npm run db:verify:payments
npm run test:e2e -- --grep "read-only payment foundation admin"
npm run build
npm run docker:build
npm run docker:smoke
```

Also execute clean bootstrap and a copy-of-canonical deployment drill, inspect query plans/index use, force reservation/finalization failures, race identical/different commands, kill a worker around provider-call boundaries, exercise hostile redirects/snapshots/errors, and verify no payment row correlates with any new ledger journal or order-history mutation.

## Architect review focus

Review the fail-closed zero-legacy-row migration decision, payable order statuses, whether the ignored Phase 4 provider-result columns should be removed in a later cleanup, UNKNOWN resumption/reconciliation ownership, and the future verified-success-to-ledger/order boundary. These are later deployment/phase decisions; no fixable Phase 10 implementation item is intentionally deferred.

