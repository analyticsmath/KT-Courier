# Phase 17 implementation map

Status: complete before the Phase 17 Prisma edit. This document maps the driver-earning design to the repository as it exists on 2026-07-18. Conceptual names from the brief are not treated as proof that a model exists.

## Existing driver and assignment inventory

### Driver and delivery records

| Concept | Actual record and contract | Runtime writers, fixtures, and operational status |
| --- | --- | --- |
| Driver | `DriverProfile`: `id`, unique `userId`, unique `driverCode`, `active`, `status`, `availability`, `onboardingStatus`, approval/suspension/rejection evidence, `availabilityRevision`, capacity and vehicle/profile fields. Relations include `User`, service regions, assignments, operational events, POD, delivery attempts/commands, and current orders. Indexed by status, availability, onboarding, code, and availability/status. | Admin driver services and driver availability service write profiles. `prisma/seed.ts` creates three demo profiles; `scripts/create-e2e-fixtures.ts` and `tests/integration/phase7-5-fixtures.ts` create active fixtures. It is operational, not a placeholder. `active=true`, `status=ACTIVE`, approved onboarding, and an active DRIVER user are separate facts. Suspended means `status=SUSPENDED`; inactive and rejected are distinct. |
| `Driver` | No such model. | `DriverProfile` is canonical. Phase 17 must not introduce a duplicate driver aggregate. |
| Driver/dispatch assignment | `OrderAssignment`: internal `id`, `orderId`, `driverProfileId`, status, lifecycle timestamps, `version Int`, dispatch policy/snapshot, active-order guard, reassignment link, and event/POD/attempt relations. Unique `activeOrderGuard`; indexes cover order, driver, status, timestamps and expiry. | `lib/services/dispatch-assignment.service.ts` owns offer/accept/reject/reassign/unassign and optimistic version changes. Phase 8 delivery execution completes the accepted assignment and increments its version. Operational. There is no separate `DriverAssignment` or `DispatchAssignment` model. |
| Assignment history | `OrderAssignmentEvent`: assignment/order/driver IDs, actor, event type, old/new status, reason/note/metadata and `createdAt`; indexed by all identities and time. `OrderOperationalEvent`: order, optional assignment/driver, typed event, before/after order status, occurrence time, evidence-safe notes and operational metadata; indexed by identities/type/time. | Dispatch and delivery services write both. These are evidence, not an entitlement trigger. |
| Delivery | No `Delivery` model. Delivery state is distributed across `Order`, `OrderAssignment`, `ProofOfDelivery`, `OrderOperationalEvent`, `DeliveryAttempt`, `DeliveryOtp`, and `DriverOperationCommand`. | Phase 17 will resolve evidence across these records and will not create or mutate them. |
| Delivery proof | `ProofOfDelivery`: unique `orderId`, unique optional `assignmentId`, `driverProfileId`, method, recipient, OTP/evidence reference, `deliveredAt`, creator, coordinates/notes and timestamps; indexes on identities and time. | `completeDelivery` creates OTP POD; admin override creates admin POD. Operational completion evidence. No dispute/incident model exists. |
| Failed delivery | `DeliveryAttempt`: order/assignment/driver identity, unique order attempt number, reason, retryability, optional evidence, occurrence time; indexes by assignment/driver time. | `recordDeliveryAttempted` writes attempts. A failed attempt is explicitly not completion evidence. Terminal driver failure is prohibited by the runtime. |
| Driver command receipt | `DriverOperationCommand`: unique operation ID, order/assignment/driver identity, type/hash/result, completion time. | Phase 8 writers use it for retry-safe mobile operations. It corroborates command execution but is not the payable source. |

Assignment statuses are `ASSIGNED`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `COMPLETED`, `EXPIRED`, `REVOKED`, and `SUPERSEDED`. Phase 17 only accepts a `COMPLETED` assignment whose version, driver, order, POD, and delivery-completion evidence agree.

### Commerce and financial records

| Concept | Actual record and contract | Phase 17 relevance |
| --- | --- | --- |
| Order | `Order`: internal `id`, unique `orderNumber`, status/source/delivery type, ZAR currency, customer/store, quote/pricing snapshot, current driver pointer and custody/transit timestamps. Relations include assignments, events, POD, attempts, payments, items and `PricingQuote`. Indexed by public/order fields and ownership/status/time. | `orderNumber` is the safe order reference. Current driver is cleared at successful delivery, so `currentDriverProfileId` cannot determine entitlement. |
| Order quote | `PricingQuote`, not `OrderQuote`: Decimal(12,2) subtotal/tax/total, calculation version and immutable-like input/rule/region/tax snapshots; unique order relation. | Pricing is context only. Driver basis must come from the injected authoritative driver settlement and must never be inferred from quote/payment totals. |
| Payment | `Payment`: internal `id`, mapped unique `publicReference`, unique `orderId`, customer, status, Decimal(18,2) amount/refund projections, ZAR, version, successful attempt/webhook/journal evidence and reconciliation state. | Required evidence is `SUCCEEDED`, ZAR, successful attempt and success journal, matching order and snapshot public reference. Compatibility provider/result columns are ignored. |
| Payment attempt | `PaymentAttempt`: optional unique public reference, payment/attempt identity, provider evidence, Decimal(18,2) amount, ZAR, status/version and snapshots. Unique payment/attempt, provider/reference, and idempotency identities. | Successful attempt corroborates payment authority; it does not calculate driver basis. |
| Wallet | `Wallet`: unique `(ownerType, ownerId, currency)`, status/version and legacy Decimal(12,2) balance columns. Relations to accounts, withdrawals and other aggregates. | Canonical driver wallet is `(DRIVER, DriverProfile.id, ZAR)`. Legacy wallet balances remain untouched. Seed does not provision driver wallets. |
| Ledger account | `LedgerAccount`: unique `(walletId, purpose, currency)`, unique code, category/status/negative policy and Decimal(18,2) balance/totals. | Phase 17 adds one `DRIVER_EARNINGS_PAYABLE` liability account per driver wallet and reuses `OWNER_WITHDRAWABLE`. Platform `HELD` is the customer-funds-held boundary; platform `CASH_CLEARING` remains outside driver accrual/release/reversal. |
| Ledger journal/entry | `LedgerJournal` has unique reference/idempotency/source reference, typed ZAR journal, request hash, totals and immutable ledger relations. `LedgerEntry` is Decimal(18,2) and unique by journal sequence and line code. | Phase 17 adds accrual, release and reversal journal types. Existing serializable ledger posting and retry services remain canonical. |
| Commission accrual | `CommissionAccrual`: unique public/idempotency/journal identities, `(subjectType, subjectId, settlementVersion)` uniqueness, Decimal(18,2) basis/total, authoritative snapshots, status/version and allocation/history/reconciliation relations. | Only `COURIER_ORDER`, `ACCRUED` evidence matching the driver settlement is eligible. |
| Commission allocation | `CommissionAllocation`: unique public reference, allocation/rule/beneficiary/account identity, Decimal(18,2) amount, existing Decimal(18,2) `storeAttributedAmount`, status and attribution metadata. | Phase 17 adds Decimal(18,2) `driverAttributedAmount` and immutable driver-charge rows. Database and service checks enforce `store + driver <= allocation amount`. |
| Payment refund | `PaymentRefund`: unique public/idempotency/reserve-journal identity, Decimal(18,2) amount, ZAR, status, projections, execution/history/reconciliation and funding allocations. Old Phase 4 compatibility fields are ignored. | Refund state is authoritative; no payment-level proportional inference is allowed for driver exposure. |
| Refund funding allocation | `RefundFundingAllocation`: unique public ref, source/account, optional commission/store identities, Decimal(18,2) amount, source-shape constraints and indexes. | Phase 17 adds `driverEarningId`, uniqueness/index/FK and the `DRIVER_EARNINGS_PAYABLE` source shape. Generic refund paths must prove no driver exposure. |
| Withdrawal request | `WithdrawalRequest`: wallet/owner/source/held accounts, Decimal(18,2) amount, lifecycle/status/version, payout evidence and reconciliation. | Phase 17 does not create payout/cashout behavior. Released amounts become eligible only through existing `OWNER_WITHDRAWABLE`; withdrawal policy already uses `DriverProfile.id`. Legacy bank compatibility columns remain ignored. |
| Audit log | `AdminActivityLog`, not `AuditLog`: actor/action/entity/message/metadata and timestamp/indexes. | Admin reversal route records safe operation/reason/evidence references only. No secret or raw provider payload is logged. |

The active seed provisions platform cash-clearing and customer-funds-held accounts and demo driver/assignment records, but no driver payable, driver earning, driver commission charge, or Phase 17 journal. Phase 17 seed changes are structural permission/settings only and create no financial evidence.

## Driver ownership map

- Canonical financial driver ID: `DriverProfile.id`.
- Authenticated identity: `DriverProfile.userId -> User.id`; driver reads first resolve the authenticated active `User(role=DRIVER)` to exactly one profile.
- Public driver reference: existing unique `DriverProfile.driverCode`; finance rows retain both internal ID and this snapshot reference.
- Active rule: user `status=ACTIVE`, user `role=DRIVER`, profile `active=true`, profile `status=ACTIVE`, and `onboardingStatus=APPROVED`. Suspension or rejection blocks release. Availability does not create or revoke an earned entitlement.
- Wallet identity: `Wallet.ownerType=DRIVER`, `Wallet.ownerId=DriverProfile.id`, `currency=ZAR`; it does not reference the user ID. Uniqueness is the wallet composite constraint.
- Destination account: the existing active ZAR `OWNER_WITHDRAWABLE` liability account in that same wallet. Phase 17 never mutates legacy wallet balances.
- Existing driver route group: `app/(driver)/driver`; APIs are under `app/api/driver`. Phase 17 adds `/driver/earnings` and driver-owned read APIs there.
- A deterministic, opaque assignment public reference is derived as `ASG-` plus a SHA-256 prefix of the assignment ID because no persisted public assignment field exists. The aggregate stores both the internal assignment ID and this safe reference.

## Delivery evidence map

| Evidence | Authoritative repository source and rule |
| --- | --- |
| Assignment identity/driver/version | The exact `OrderAssignment.id`, `driverProfileId`, and post-completion `version`; the injected snapshot must equal the locked row. |
| Pickup | Pickup status/events and `Order.custodyEstablishedAt` are supporting evidence, not a payable trigger. |
| Completion | `OrderAssignment.status=COMPLETED`, non-null matching `completedAt`, `ProofOfDelivery` with the same order/assignment/driver and `deliveredAt`, plus same-assignment `DELIVERY_COMPLETED` and `ASSIGNMENT_COMPLETED` evidence. The order must be delivered/completed, not failed/cancelled. |
| Cancellation | Assignment terminal status/timestamps and cancellation/revocation events. Any pre-entitlement cancellation fails source resolution; later invalidation is a reviewed reversal/reconciliation input. |
| Reassignment/handoff | Each reassignment is a distinct `OrderAssignment`, linked by `reassignedFromId` and supersession events. Entitlement belongs only to the assignment and driver that produced the accepted completion/POD evidence. Earlier drivers cannot inherit it and a current-driver pointer is never used. |
| Failed delivery | `DeliveryAttempt` and attempted/failed events are non-entitling. They cannot be promoted to completion. |
| Completion timestamp | `serviceCompletedAt` must match assignment `completedAt` and POD `deliveredAt`; `authoritativeAt` cannot precede it. |
| Dispute/incident | No canonical dispute or incident aggregate exists. Release therefore remains locked and policy treats any open payment/refund/driver-earning reconciliation as exposure. |

The repository has sufficient identity and completion evidence to validate a supplied settlement, but no authoritative delivery-settlement calculator/producer. Phase 17 therefore implements a dormant resolver plus an injected immutable snapshot contract. Production financial entry points are source-locked; the injected path is reachable only through an explicit in-process test option, never an environment flag or public route.

## Financial source map

- Successful payment: one matching `Payment(status=SUCCEEDED, currency=ZAR)` with success attempt/journal and no conflicting reconciliation.
- Customer funds held: active non-negative platform ZAR `HELD` liability account.
- Commission: one matching accrued Phase 14 `CommissionAccrual` and its eligible allocations. Driver commission charge rows must exactly sum the snapshot commission and increment each allocation's driver projection in the same transaction.
- Existing exposure: `Payment.totalRefundedAmount`, `totalRefundReservedAmount`, `PaymentRefund`, commission funding, and Phase 16 store-earning funding remain independent authoritative projections.
- Driver payable: active non-negative ZAR `DRIVER_EARNINGS_PAYABLE` liability on the canonical driver wallet.
- Owner withdrawable: existing active non-negative ZAR `OWNER_WITHDRAWABLE` liability on the same wallet.
- Cash clearing: platform `CASH_CLEARING` asset is involved in payment receipt/external payout only; driver earning journals never touch it.
- Economic ownership: customer held is debited once for the driver net; commission was already economically separated by Phase 14. Attribution rows are projections/evidence, not a second commission posting.

## Transaction map

1. Account provisioning: validate active driver owner, serializable get/create canonical driver wallet, then create or validate zero-opening driver payable and existing owner-withdrawable accounts; retry unique races by rereading.
2. Accrual: lock assignment, driver, payment, commission accrual/allocations and accounts in deterministic order; validate source snapshot/arithmetic; post held debit/payable credit; insert aggregate, charge rows, allocation projection increments and initial history atomically.
3. Accrual replay: same idempotency key/hash returns the original aggregate and journal; same duplicate settlement with different hash fails without mutation.
4. Refund reservation: consume only an authoritative driver refund snapshot, lock refund/earning/account, insert driver funding allocation and increment `refundReservedAmount` in the refund reserve transaction.
5. Refund release: on rejection/cancellation, debit the refund-held account and restore the exact driver payable source while decrementing the driver reserved projection in the same transaction.
6. Refund completion: classify the reserved driver amount as `refundedAmount`, decrement `refundReservedAmount`, update terminal state when the full entitlement is consumed, and retain immutable funding evidence.
7. Release: system worker only; lock earning/account/exposure, recheck every release condition, post payable debit/owner-withdrawable credit and set release/history evidence atomically.
8. Reversal: reviewed admin command with approved reason and opaque evidence; require unreleased/unreserved remaining amount and coherent canonical commission reversal, then post payable debit/held credit and record reversal/history atomically.
9. Reconciliation creation: deterministic unique case key, upsert observation count/time and move an accrued earning to reconciliation-required when safe.
10. Reconciliation resolution: only after invariant restoration and a canonical operation reference; update the case, and restore aggregate state only when no open cases remain. It never posts money.

## Cross-phase dependency map

- Phase 7 dispatch supplies versioned assignment and reassignment/handoff evidence; Phase 17 never writes it.
- Phase 8 driver operations supplies POD, completion events and operation receipts; Phase 17 never completes a delivery.
- Phase 12 supplies verified successful-payment and held-funds journal evidence.
- Phase 14 supplies commission accrual/allocation authority; Phase 17 adds only driver attribution projections and charge evidence.
- Phase 15 owns refund reserve/release/completion transactions; Phase 17 extends their source planning and projections without adding a generic inference path.
- Phase 13 owns canonical driver wallet ownership, `OWNER_WITHDRAWABLE`, withdrawals and cash-clearing boundaries.
- Phase 16 store attribution remains intact; the new global check covers the sum of store and driver projections and both charge tables remain independently exact.
- Future delivery-settlement orchestration must call the internal accrual service with a server-authenticated immutable snapshot. No automatic completion trigger is added now.

## Contract matrix

| Layer | Phase 17 alignment |
| --- | --- |
| Prisma | Driver aggregate, charge/history/reconciliation models; driver attribution and refund source fields; relations on all existing owners/evidence. |
| Migration | Additive enums/tables/columns/indexes/FKs/checks; immutability, account/journal, combined attribution and refund projection triggers. No prior migration edit. |
| Domain | Exact Decimal money, settlement/refund snapshots, assignment reference, calculation hash, state/release/reversal/reconciliation/refund policies and production lock. |
| Services | Canonical account provisioning; locked accrual/source resolution; query/summary; automatic release; reviewed reversal; refund integration; case lifecycle. |
| Validation | Strict bounded query schemas and internal/admin command schemas; no public accrual/release schema. |
| DTO | Driver DTO exposes only owned references, amounts, status and safe timestamps; finance DTO adds assignment/payment/commission/ledger/reconciliation evidence but no secrets. |
| APIs | Three authenticated driver-owned GETs; finance permission-guarded GETs; one reviewed reversal POST. No create/release endpoint. |
| UI | Server-rendered driver Earnings list/detail/summary and finance Driver Earnings/reconciliation views; only reversal form is interactive client code. |
| Tests | Required DB-free policy/service/API files, explicit mocks/fixtures, plus skipped/gated PostgreSQL and Chromium scaffolding with numbered scenarios. |
| Scripts | Reconciliation scan, mature-release coordinator/worker, preflight, invariant verifier and gated integration runner. |
| Documentation | Architecture, ledger, refund, release, operational runbook, API, permissions, scripts/tests and deferred-risk records preserve the production lock. |

## Reviewed source locks

- `DRIVER_EARNINGS_PRODUCTION_VALIDATION_APPROVED = false` is a source constant.
- No environment variable can activate accrual, release, reversal, or driver-source refund mutation.
- Only focused tests may pass an explicit in-process bypass object.
- No route or UI accepts a settlement snapshot, accrual request, release request, pricing input, assignment mutation, or delivery-completion mutation.
