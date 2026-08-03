# Phase 21 research and implementation map

## Scope and architectural decision

Phase 21 starts only after Phase 20 has created a paid, immutable
`MarketplaceOrder` and its per-store `MarketplaceStoreOrder` children.  It adds
the operational record around a store child order; it does not replace the
Phase 20 commercial snapshot, Payment, refund, inventory, commission,
store-earning, dispatch, or courier-order aggregates.

## Repository audit

| Surface | Existing authority and state | Writer / transaction boundary | Phase 21 reuse decision |
| --- | --- | --- | --- |
| Parent marketplace order | `MarketplaceOrder`, `MarketplaceOrderStatus`; immutable totals and commercial fingerprint | Phase 20 finalisation repository | Retain as the customer commercial parent; add only a derived operational projection. |
| Per-store order | `MarketplaceStoreOrder`, `MarketplaceStoreOrderStatus`; `MarketplaceOrderLine` and modifier snapshots | Phase 20 finalisation / settlement | Preserve origin lines and totals. Add orthogonal operational fields and related records. |
| Frozen financial evidence | `MarketplaceSettlementSnapshot`, `MarketplaceOrderLineFinancialAllocation`, `MarketplaceSettlementAllocation` | Phase 20 settlement service | Use frozen line allocations and frozen commission evidence for every reversal; never query current plans for reversal. |
| Settlement jobs | `MarketplaceStoreSettlementJob` | Phase 20 settlement worker | Do not net or mutate settlement snapshots. Record a separate adjustment and fail closed if original settlement is incoherent. |
| Commission | Phase 14 `commission-accrual.service` and `commission-reversal.service` | Canonical commission primitives | Phase 21 records reversal intent/evidence; the canonical Phase 14 writer remains financial authority. |
| Store earnings | Phase 16 `store-earning-*` services and `StoreEarning` records | Canonical earning primitives | Reuse refund/reversal workflow, not direct balance updates. |
| Refunds | Phase 15 `refund-request.service`, provider execution and reconciliation | Existing refund aggregate | Create a linked Phase 15 refund request/reservation only; guests remain original-method only. |
| Catalog inventory | `CatalogInventoryItem`, `CatalogInventoryLevel`, `CatalogInventoryMovement` | `catalog-inventory.service`, Phase 20 reservation service | Add dedicated substitution reservations and explicit movement types; shortage never restocks. |
| Courier order and dispatch | Courier `Order`, `OrderAssignment`, dispatch eligibility/assignment services | Existing Phase 6–8 services | Create at most one bridge reference to an existing courier order; store staff cannot assign drivers or complete delivery. |
| Driver handoff evidence | `OrderAssignment`, `DeliveryOtp`, `OrderOperationalEvent` | Existing driver operational writers | Phase 21 stores a pickup challenge and verifies the existing active assignment before only marking store handoff. |
| Store identity and permissions | `Store.ownerUserId`, `hasPermission`, `UserPermission` explicit `DENY` | Auth and permission services | Require active exact-store ownership and `store_orders.*`; deny overrides always win. |
| Customer ownership | authenticated user or Phase 20 guest confirmation secret | marketplace API policy | Reuse the customer/guest ownership gate for preference, decision, cancellation and status views. |
| Events and notifications | Existing operational events / notification primitives | Existing durable writers | Write Phase 21 immutable history plus an outbox-style event intent inside the operation transaction. |
| Reconciliation | `MarketplaceCheckoutReconciliationCase`, refund/earning reconciliation cases | Canonical remediation services | Add a store-order reconciliation case that links, rather than overrides, financial and delivery authority. |
| Media and evidence | Catalog media assets and existing proof/evidence records | Existing media policy | Store only references, hashes and metadata for package/seal evidence; never duplicate sensitive blobs. |

## Public data boundary

Store queues receive only operational customer contact/pickup evidence frozen at
checkout. Financial allocations, payment references, guest secrets, full driver
identity and full delivery address stay private. Customer status groups are
derived from independent store child orders and never claim customer delivery is
complete at store handoff.

## Implementation map

1. Add additive Phase 21 enums, policy, operational snapshot, fulfilment,
   issue, substitution, amendment, adjustment, history, bridge, handoff and
   reconciliation records.
2. Freeze an operational policy/snapshot when the Phase 20 order becomes
   reviewable. Treat active policy and source commercial evidence as immutable.
3. Implement canonical, idempotent service functions for review, availability,
   acceptance/rejection/timeout, substitution, adjustment, preparation,
   bridge, handoff and parent projection.
4. Expose narrow store, customer and admin route handlers, then build store and
   customer views on their safe DTOs.
5. Document the source locks and add focused policy, service, API and deferred
   integration/E2E scaffolding.

## Research conversion

The design follows the well-established marketplace pattern of a merchant
acceptance SLA, immutable paid-order evidence, customer-authorised substitution
with a no-price-increase cap, and partial fulfilment accounted from cumulative
line allocation.  It separates merchant completion (verified driver handoff)
from courier completion, requires a durable refund/reconciliation boundary for
unknown external provider outcomes, and limits operator data to fulfilment need.
The policy/version snapshot is deliberately frozen per store child order so
changes to a store's current settings cannot alter an already-paid obligation.

## Production source locks

All Phase 21 external authority bridges remain fail-closed until consolidated
validation.  No policy activation, delivery bridge, financial adjustment,
refund execution or handoff can use an unverified production adapter.

## Composition-completion audit

This audit distinguishes a concrete, callable authority from an interface or a
source-locked operation.  A source lock is not an adapter implementation and is
never reported as one.

| Authority | Baseline found | Completion decision | Validation state |
| --- | --- | --- | --- |
| Phase 14 commission reversal | Concrete whole-accrual reversal service; no Phase 21 transaction entry point | Implemented `reverseCommissionInTransaction` as the Phase 14 transaction primitive, retaining the existing public entry point | Production-locked; PostgreSQL proof deferred |
| Phase 16 store-earning adjustment | Concrete whole-earning reversal service; no Phase 21 transaction entry point | Implemented `adjustStoreEarningInTransaction` as the canonical transaction primitive | Production-locked; PostgreSQL proof deferred |
| Phase 15 refund reservation/execution | Concrete payment-refund aggregate and provider/reconciliation services | Implemented a marketplace adapter over Phase 15; no second refund aggregate exists | Production-locked; provider proof deferred |
| Courier-order creation | Existing `Order` aggregate creation service, but no marketplace bridge command | Implemented a frozen-evidence canonical courier command and bound it through the Phase 21 bridge | Production-locked; migration/runtime proof deferred |
| Phase 7 dispatch eligibility | Existing driver eligibility and dispatch-assignment services | Implemented dispatch-eligibility evidence only; no driver selection is exposed | Production-locked; runtime proof deferred |
| Phase 8 assignment verification | Concrete accepted-assignment checks in pickup custody services | Implemented assignment ownership and canonical pickup composition | Production-locked; runtime proof deferred |
| Existing courier pickup transition | Concrete `completePickup` service | Invoked after Phase 21 two-party custody verification, outside the local evidence transaction | Production-locked; runtime proof deferred |
| Financial-adjustment repositories | Phase 20 snapshots/allocations and Phase 14/16/15 repositories are concrete | Implemented serializable frozen-evidence composition with reconciliation on a failed composed step | Production-locked; database proof deferred |
| Refund repositories | Phase 15 `PaymentRefund` aggregate is concrete | Added safe refund/reconciliation links; guest authority remains original-method-only | Production-locked; provider proof deferred |
| Delivery-bridge repositories | Phase 21 bridge evidence is concrete; its authority was interface-only | Bound the concrete marketplace bridge adapter and one-to-one courier reference | Production-locked; database proof deferred |
| Administrative retry routes | No Phase 21 canonical retry routes existed | Implemented guarded canonical retry/rescan routes with explicit permissions | Production-locked; API/runtime proof deferred |
| Operational processors | Initialisation, timeout and substitution expiry scripts existed | Implemented adjustment, refund, delivery and reconciliation processors using canonical services | Mutating `--apply` remains source-locked |
