# Phase 7 — Dispatch Hardening v1

## Phase 7.5 closure status

**PASS — CLOSED.** PostgreSQL guard and deferred pointer constraints, serializable dispatch writes, bounded retry, lifecycle compatibility checks, and driver-capacity reconciliation enforce the canonical assignment model. Live integration tests cover concurrent offers, accept/reject/retry behavior, reassign/unassign, custody boundaries, and cross-module preservation of pricing snapshots. See [Phase 7.5 closure](phase-7.5-phase6-phase7-closure.md).

Phase 7 keeps an administrator as the dispatch decision-maker. It does not implement autonomous assignment, GPS, proximity ranking, live maps, route optimization, earnings, wallets, payments, or notification infrastructure.

## Assignment lifecycle

`ASSIGNED` is the existing offer state. It may become `ACCEPTED`, `REJECTED`, `EXPIRED`, `REVOKED`, or `SUPERSEDED`. An accepted assignment may become `REVOKED`, `SUPERSEDED`, or `COMPLETED`. All other states are terminal. Only accepted assignments set `Order.currentDriverProfileId`; offers do not.

`OrderAssignment` is canonical. `activeOrderGuard` is `orderId` only for current offers/assignments and is unique in PostgreSQL; terminal records clear it. This preserves historical records while enforcing one current assignment per order.

## Eligibility and ranking

Eligibility requires an active DRIVER user, active driver profile, AVAILABLE availability, an explicit matching service region, and capacity. Current load includes accepted assignments plus unexpired offers. Capacity is rechecked within the serializable write transaction. Candidate ranking is deterministic: eligibility, region match, vehicle compatibility, load ratio, load count, availability timestamp, driver code, and ID. There is deliberately no proximity ranking.

## Concurrency

Dispatch writes use serializable interactive transactions, bounded retry for recognized serialization conflicts, conditional status/version updates, and consistent order → sorted driver row locking. No network call occurs inside a dispatch transaction. Reassign/unassign operations are blocked once custody has begun (`PICKED_UP` onward).

## Operations

Offers expire after `dispatch.assignment_offer_ttl_minutes` (10 minutes by default). `npm run dispatch:reconcile-expired` lazily reconciles expired offers in bounded batches and is safe to rerun. Reassigning closes the old current record as `SUPERSEDED` and opens a new offer atomically. Unassignment closes the record as `REVOKED` and clears the accepted-driver pointer.

Every transition records an assignment event and an operational event. Admin mutations additionally create an admin activity record. Pricing snapshots and quote totals are never altered by dispatch.

## Configuration

- `dispatch.assignment_offer_ttl_minutes`: 10
- `dispatch.policy_version`: `dispatch-v1`
- `dispatch.default_driver_capacity`: 1
- `dispatch.serializable_retry_count`: 3

## Deferred

Autonomous assignment, GPS/live locations, live maps, multi-stop optimization, shift scheduling, emergency parcel handover, driver earnings, and notification infrastructure remain deferred.
