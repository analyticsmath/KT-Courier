# Phase 8: Driver Operations Hardening

## Scope

Phase 8 hardens mobile driver execution from accepted assignment through pickup, custody, transit, delivery attempt/retry, OTP/POD completion, and assignment completion. It does not implement earnings, wallets, commissions, payments, GPS/live tracking, route optimisation, autonomous dispatch, or notification-platform infrastructure.

## Availability preference

`DriverProfile.availability` is the future-offer preference: `AVAILABLE`, `UNAVAILABLE`, or `OFFLINE`. An accepted assignment is independent of that preference. A driver can choose unavailable/offline without losing or being blocked from completing current work. `ON_DELIVERY` remains a deprecated compatibility enum value; Phase 8 no longer writes it and drivers cannot select it. Current delivery is derived from an accepted current assignment and its order state. Dispatch eligibility uses preference plus existing capacity checks.

Availability mutation requires `expectedRevision`. It conditionally updates the profile ID/revision pair, increments the revision, and returns `DRIVER_AVAILABILITY_STALE` on zero affected rows. Same-state calls return the current revision without changing assignments, custody, pricing, or pointers.

## Authority, transitions, and receipts

Each driver command verifies active user/profile, profile ownership, `ACCEPTED` assignment, matching `Order.currentDriverProfileId`, expected assignment version, and non-terminal order state. `OrderAssignment` is still lifecycle authority and all order changes use the central state service.

`DriverOperationCommand` is the durable command receipt. It is separate from `OrderOperationalEvent` because one command can emit many lifecycle events. A unique operation ID, canonical SHA-256 request hash, type, and safe result snapshot are committed with the mutation. The snapshot contains only IDs, result statuses, and completion time. It never stores an OTP, token, raw payload, or private URL. Same ID/same hash returns the original receipt; same ID/different hash raises `DRIVER_OPERATION_IDEMPOTENCY_CONFLICT`; rollback leaves no completed receipt.

## Pickup, transit, and attempts

Pickup confirmation atomically transitions to `PICKED_UP`, records `custodyEstablishedAt`, histories/events, and a command receipt. Transit/resume records `transitStartedAt`. Resume from `DELIVERY_ATTEMPTED` requires the latest attempt to belong to the current assignment, be retryable, and have an established custody boundary.

`DeliveryAttempt` has a unique `(orderId, attemptNumber)` guard. Attempt allocation locks the order row inside the transaction before reading the maximum, with the unique guard as a backstop. Reason retryability/evidence requirements are server-owned. Drivers record attempts only; terminal `FAILED` remains an authorized admin/server decision.

## OTP and POD

OTP codes are hashed, expire server-side, invalidate prior active codes on reissue, enforce a 60-second request cooldown and hourly cap, increment attempts atomically, and set `lockedAt` at the limit. Completion re-reads and consumes OTP inside its transaction. OTP issue/reissue has a command receipt and does not return plaintext to a driver.

`getTestIssuedDeliveryOtp()` is a test-process-only fixture boundary, guarded by `NODE_ENV === "test"`; it is not used by routes or production builds. It does not persist plaintext.

POD is one final record per order/assignment and is created in the completion transaction. `evidenceReference` is nullable and only permits an opaque restricted identifier. URLs, data URLs, and filesystem paths are rejected; photo/signature upload is not claimed as production-ready.

## Workbench and admin visibility

`getDriverWorkbench()` returns availability/revision, offers, one active assignment, paginated recent completions, server-derived actions, custody/transit state, safe attempt history, and OTP/POD state without secrets. The workbench renders an accessible lifecycle stepper, current operation summary, safe attempt history, and server-permitted action guidance. The assignment UI retains a native UUID over network retries, changes it when material input changes, and refreshes after conflict.

The existing admin order detail now includes a safe driver-operation summary: custody/transit times, attempts/reason/retryability, OTP state without code/hash, POD method/recipient/delivery time, and assignment completion. Raw evidence references and command hashes are not displayed.

## Schema and migration

The unapplied additive migration `20260716020000_phase8_driver_operations_hardening` adds availability revision, custody/transit timestamps, hardened OTP fields, POD evidence reference, `DeliveryAttempt`, and `DriverOperationCommand`. It contains no destructive SQL and earlier migrations remain unchanged.

## Test definitions and user validation

Phase 8 includes policy, service-contract, API-contract, frontend helper, live PostgreSQL lifecycle/concurrency, and Playwright specifications. They are written but not executed. Run Prisma generation/migration only on a disposable database, then focused tests, live integration tests, full tests, coverage, build, browser E2E, CI, and audit as the user-controlled validation lifecycle.
