# Phase 7.5 — Phase 6 and Phase 7 Closure

Status: **CLOSED**. This gate verifies the Phase 6 pricing engine and Phase 7 dispatch hardening together without starting Phase 8 work.

## Scope completed

- Pricing quotes are server-authoritative, ZAR-only, normalized, deterministic, versioned, and consumed atomically by orders.
- Pricing rules support region, vehicle, weight, dimensional, effective-date, revision, archive, and auditable administration controls.
- Dispatch uses `OrderAssignment` as the lifecycle record, serializable transactions, retry for recognized serialization conflicts, one-current-assignment protection, capacity checks, and custody boundaries.
- Database constraints reconcile quote totals and lines, prevent invalid active assignment state, protect accepted-driver pointers, and preserve immutable pricing evidence.
- The customer order flow, pricing administration, dispatcher board, and driver acceptance flow are validated through isolated live tests and production-image Chromium E2E.

## Runbook

Run the full local gate:

```bash
npm run verify:phase7.5
```

Targeted checks are also available:

```bash
npm run test:integration:pricing
npm run test:integration:dispatch
npm run test:integration:cross-module
npm run test:e2e
npm run db:verify-phase7.5
```

Each live integration and E2E invocation uses a unique disposable Compose project. It may run `down -v` only for that verified disposable project. The normal Compose project and its preserved baseline-era volume are never removed by these commands.

## Deferred after closure

Phase 8 work remains out of scope: payments, wallet/earnings, promotions, dynamic/surge pricing, marketplace settlement, multi-currency, GPS/live tracking, route optimization, autonomous dispatch, and notification infrastructure.

The authoritative evidence map is [phase-7.5-closure-matrix.md](phase-7.5-closure-matrix.md).
