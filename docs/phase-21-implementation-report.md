# KT Couriers Phase 21 Implementation Report

## 1. Executive Summary

IMPLEMENTATION COMPLETE — DEEP VALIDATION DEFERRED TO PHASE 26.5

Phase 21 adds bounded, independently operated merchant fulfilment to a settled
marketplace order without changing Phase 20 commercial evidence or taking over
the existing financial and courier authorities.

The composition correction is recorded in
`docs/phase-21-architect-correction-report.md`; where this earlier report
described interface-only wiring, the correction report is authoritative.

## 2. Research Conversion

The implementation maps merchant review, customer-authorised substitution,
refund, operational-policy, privacy and two-party custody research into
immutable evidence, explicit state transitions, bounded inputs and source locks.

## 3. Existing Architecture Audit

The implementation map records the Phase 20 store-order/settlement boundary,
catalog inventory authority, Phase 14/16 financial authority, Phase 15 refund
authority, and existing courier order, dispatch and driver-assignment services.

## 4. Final Architecture

`MarketplaceStoreOrder` proceeds through review, line resolution, acceptance,
preparation, one courier bridge and verified store-to-driver handoff. Financial
and courier commands cross injected canonical-authority boundaries.

## 5. State Machines

Acceptance, preparation, resolution, financial-resolution and delivery-bridge
dimensions are independent and are projected to a derived status; the Phase 20
commercial `status` remains intact.

## 6. Operational Policies

`StoreOrderOperationalPolicy` has draft, submitted, approved, active and
retired lifecycle states. An active policy is frozen by reference, version and
snapshot onto each operational store order; retired frozen versions remain
readable for their existing orders.

## 7. Merchant Review

The store queue is scoped to an active store owner/role, uses explicit
`store_orders.*` permissions with DENY precedence, and sorts by deadline,
scheduled fulfilment time, paid creation time and public reference.

## 8. Acceptance and Rejection

Acceptance requires every line to be resolved, frozen settlement evidence, an
active store and a bounded preparation estimate. Rejection and expiry create an
explicit adjustment record; timeout uses the same rejection transition.

## 9. Line Availability

Every original line receives an immutable fulfilment record at Phase 20 order
creation. Confirmed and resolved quantities are checked against ordered quantity
and unavailable quantities create issues rather than silently changing a line.

## 10. Substitution Preferences

Customers can set a bounded preference through authenticated ownership or a
verified high-entropy marketplace guest secret. The secret is verified and never
persisted as plaintext.

## 11. Substitution Proposals

Proposals resolve only current, published, same-store catalog offers, retain the
original line evidence, enforce the frozen price cap, expire, and create a
conditional inventory reservation and movement evidence.

## 12. Customer Decisions

Customer decisions are immutable, idempotent records. Approval consumes the
reservation; rejection or expiry releases it and preserves the decision trail.

## 13. Amended Transaction Records

Every resolved line change writes a versioned `MarketplaceStoreOrderAmendment`;
the original marketplace order line remains untouched.

## 14. Store-Order Adjustments

`MarketplaceStoreOrderAdjustment` records structured types, reason, status,
operation identity, financial evidence and allocation children before any
canonical financial command is requested.

## 15. Financial Allocations

Allocation uses integer cents and cumulative allocation evidence so a sequence
of partial fulfilments cannot exceed the frozen Phase 20 store-group amount.

## 16. Commission and Store-Earning Adjustments

Phase 21 does not write ledger, commission or store-earning tables. Its
`FinancialAdjustmentAuthority` composition point is the required canonical
Phase 14/16 boundary; live authority wiring remains source-locked pending the
Phase 26.5 integration proof.

## 17. Refunds

Refund initiation is delegated through the canonical financial/refund authority,
with the adjustment evidence identifying original-payment-method treatment. No
new payment or direct refund writer was added.

## 18. Delivery-Fee Policy

Delivery fees are independently represented on an adjustment: full pre-delivery
rejection can include the frozen fee, while partial line resolution keeps the
fee separate from merchandise adjustments.

## 19. Inventory Disposition

The migration adds explicit substitution reservation, release, commitment,
cancellation-restock and damage-quarantine movement types. Shortage is not
treated as automatic restock; damage is represented as quarantine evidence.

## 20. Customer Cancellation

Cancellation is stage-aware: eligible pre-preparation requests are recorded as
requests and later stages require an operational/financial resolution rather
than a destructive order rewrite.

## 21. Store Cancellation

Post-acceptance store cancellation is a structured cancellation request with
reason/evidence and follows the same authoritative adjustment path.

## 22. Preparation

The service supports preparation start, bounded preparation-time updates and a
ready-for-handoff state, with each action recorded in history and outbox intent.

## 23. Delivery Bridge

Acceptance creates exactly one bridge record holding frozen quote reference and
version. The bridge invokes the existing courier-order authority; it neither
creates a replacement delivery workflow nor assigns a driver.

## 24. Dispatch and Driver Integration

Phase 7/8 remain the dispatch and assignment authorities. Phase 21 verifies an
accepted, unexpired assignment owned by the authenticated driver before custody
is confirmed.

## 25. Pickup Handoff

The store issues a short-lived, hashed-only pickup challenge after verifying an
active assignment; the driver supplies the second factor. Failed attempts are
counted and handoff records package/seal evidence without marking delivery done.

## 26. Parent-Order Projection

Parent progress is a pure aggregation of independent store-order outcomes,
including customer action, handoff, cancellation and reconciliation states.

## 27. Events

History, idempotent operation receipts and `MarketplaceStoreOrderEventIntent`
provide durable event-intent evidence for operational transitions.

## 28. Reconciliation

Reconciliation cases are explicit, queueable and non-overriding. Retrying a
financial or courier side effect must return to its canonical authority.

## 29. Store APIs

| Endpoint | Purpose |
| --- | --- |
| `GET /api/store/orders` | Scoped deadline-first merchant queue |
| `POST /api/store/orders/[reference]/actions` | Named review, availability, acceptance, preparation and handoff actions |

## 30. Customer APIs

| Endpoint | Purpose |
| --- | --- |
| `POST /api/marketplace-orders/[reference]/store-orders/[storeOrderReference]/actions` | Preference, substitution decision and cancellation request via owner or guest secret |

## 31. Admin APIs

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /api/admin/store-order-policies` | Policy lifecycle administration |
| `GET /api/admin/store-order-reconciliation` | Read-only reconciliation visibility |

## 32. Store UI

The merchant page adds a stage-separated store-order queue and a detail action
panel with bounded operational inputs. Existing courier delivery requests remain
visible separately.

## 33. Customer UI

The public confirmation surface exposes only safe store operational progress and
explains that store-to-driver handoff is not customer delivery completion. The
customer action API is in place; richer customer timelines remain a Phase 26.5
browser-validation item.

## 34. Admin UI

The admin reconciliation page exposes cases and evidence for investigation; it
intentionally contains no financial, inventory or delivery override control.

## 35. Security and Fraud

Named action allowlists, exact body keys, rate limits, origin checks, replay
receipts, server-side request hashes, store scoping, explicit DENY precedence,
guest-secret verification, frozen policy evidence and two-party handoff protect
against IDOR, tampering and replay.

## 36. Privacy

Store screens exclude raw customer contact data, pickup codes are stored only as
hashes, and driver verification records the minimum assignment and custody
evidence required.

## 37. Prisma Schema

The schema adds operational policy, line fulfilment, issues, substitutions,
reservations, decisions, adjustments, allocation, amendment, cancellation,
delivery bridge, handoff, history, operation, event-intent and reconciliation
models, plus explicit relations, unique keys, indexes and constrained enums.

## 38. Migration

`prisma/migrations/20260717130000_phase21_store_order_management/migration.sql`
is additive and follows `20260717120000_phase20_marketplace_checkout`. It adds
the policy immutability trigger, columns, tables, foreign keys, indexes and enum
values. No Phase 20 or earlier migration was changed.

## 39. Seed

System permission definitions and default admin/store-catalog role grants were
added; no live operational policy, order, refund, inventory or courier data is
seeded.

## 40. Scripts

`phase21-store-order-preflight.mjs` checks required assets;
`verify-store-order-invariants.mjs` checks source composition and locks; and
the timeout, substitution-expiry, initialization, adjustment, refund, delivery
and reconciliation scripts call only bounded canonical services.

## 41. Tests

Ten focused policy, service and API test files pass (32 tests). Nine named
PostgreSQL integration scenarios and six Playwright E2E scenarios are present
as intentionally skipped Phase 26.5 scaffolds.

## 42. Files Changed

Core implementation: `prisma/schema.prisma`,
`prisma/migrations/20260717130000_phase21_store_order_management/migration.sql`,
`lib/store-orders/{allocation,api-policy,contracts,errors,operational-policy.service,production-lock,state-machine,store-order-auth,store-order.service}.ts`,
`lib/auth/permission-keys.ts`, `lib/security/rate-limit.ts`, and
`lib/marketplace-checkout/prisma-marketplace-finalization.repository.ts`.

Routes and UI: `app/api/store/orders/route.ts`,
`app/api/store/orders/[reference]/actions/route.ts`,
`app/api/marketplace-orders/[reference]/store-orders/[storeOrderReference]/actions/route.ts`,
`app/api/driver/store-order-handoffs/[reference]/route.ts`,
`app/api/admin/store-order-policies/route.ts`,
`app/api/admin/store-order-reconciliation/route.ts`,
`app/api/orders/[id]/confirmation/route.ts`, `components/store-orders/StoreOrderQueue.tsx`,
`components/store-orders/StoreOrderActionPanel.tsx`,
`app/(store)/store/orders/page.tsx`,
`app/(store)/store/marketplace-orders/[reference]/page.tsx`,
`app/(admin)/admin/store-order-reconciliation/page.tsx` and the public
confirmation API projection.

Support assets: `scripts/{phase21-store-order-preflight,verify-store-order-invariants}.mjs`,
`scripts/{expire-store-order-timeouts,expire-store-order-substitutions,initialize-store-order-operations}.ts`,
the eight focused tests, nine `tests/integration/store-order-*.integration.test.ts`
files, six `tests/e2e/store-order-*.spec.ts` files,
`vitest.store-order-integration.config.ts`, `docs/phase-21-research-and-implementation-map.md`,
`docs/phase-21-store-order-management.md`, `docs/testing/store-order-integration.md`,
`docs/deferred-validation/phase-21-risk-register.md`, and all fifteen
`docs/store-orders/*.md` topic documents.

## 43. Lightweight Checks Actually Run

`npx prisma format`, `npx prisma validate`, focused ESLint, ten focused
Vitest files (32 passing tests), the Phase 21 preflight, source-invariant scan,
JavaScript syntax checks, migration identifier-length check and `git diff --check`
were run successfully.

## 44. Validation Deferred

No dependency install, Prisma generation, migration application, seed, Docker,
database integration, full test suite, typecheck, build, browser run, CI,
provider call or geocoder was run. Those actions are deferred to Phase 26.5.

## 45. Deferred Risks

Phase 26.5 must prove the PostgreSQL trigger and constraints, runtime canonical
financial/refund and courier composition, concurrency/locking, provider
outcomes, job scheduling, accessibility, browser behavior, performance and
operational observability. See the Phase 21 risk register.

## 46. Bugs Found and Fixed

The final static review found and corrected frozen orders rejecting a retired
policy version and overlength PostgreSQL index identifiers. Queue ordering
now includes scheduled fulfilment time; Prisma validation and the identifier
audit were rerun after those fixes.

## 47. Architect Review Items

Confirm the frozen-evidence contracts across the existing Phase 14/16/15
authorities and courier bridge, the operational-policy approval ownership, and
the Phase 26.5 integration environment/fixture plan. See the correction report
for the concrete composition and recovery staging model.

## 48. Progression Readiness

READY FOR ARCHITECT IMPLEMENTATION REVIEW

## 49. Final Confirmation

- Merchant acceptance is bounded.
- No silent partial fulfilment exists.
- Original order lines remain immutable.
- Substitutions require customer authority and higher-priced substitutions are blocked.
- Substitute stock is reserved and amendments are recorded.
- Adjustments use frozen Phase 20 evidence and defer to Phase 14/16 and Phase 15 authorities.
- Delivery fees remain separate and shortages do not blindly restock.
- Courier orders reuse the existing architecture; no second Payment exists and stores cannot assign drivers.
- Handoff requires an active assignment and does not mark customer delivery complete.
- Parent status is derived; production remains locked; no Phase 22 behavior exists.
- No earlier migration changed and no secrets are exposed.
