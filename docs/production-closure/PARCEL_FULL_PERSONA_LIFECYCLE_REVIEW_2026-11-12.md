# KT Couriers — Cross-Persona Parcel Lifecycle and Security Review
Date: 12 November 2026
Audited baseline: 7a8bd515399f3cc7d2a55d2e868fa6463b7e4b8d (main).
Status: SOURCE HARDENING VERIFIED; full commercial / real-money / field acceptance not certified.

## Governing requirements

The client's latest direct answers supersede conflicting documents; Website Developer Brief supersedes the other eight; Delivery and Access and Website & System Changes supersede the remaining six only for conflicts. Shipping & Delivery, Refund & Cancellation and Terms & Conditions were also reviewed. All nonconflicting requirements remain binding.

Guest parcel quotation precedes required customer/vendor authentication for booking. Standard is a speed; scheduled is a future collection window, not a separate tariff. Johannesburg/Pretoria are the launch locations, with future South African coverage configurable by admin. High-risk zones forbid cash. COD/deposit splits, risk, cash limits, driver commissions and merchant eligibility must be policy-controlled, not hard-coded shortcuts.

## Role-by-role code trace

| Stage | Customer | Vendor / marketplace | Driver / admin |
|---|---|---|---|
| Quote | lib/client-platform/delivery.service.ts; app/api/public/delivery-quotes | store/new-delivery/page.tsx; marketplace-delivery-quote.service.ts | Active route/region/size/weight tariff authority |
| Booking | public/delivery-quotes/[id]/book; orders.service.ts | Store workspace pickup match; marketplace checkout reservation | Single-use PricingQuote and unique Order.pricingQuoteId |
| Payment | order payment page; verified Paystack session/webhook | Customer wallet, store wallet, store-order certified funds | Signed exact-minor-unit capture, idempotent ledger posting |
| Dispatch | Paid order confirmed | MarketplaceCourierOrder bridge requires source-bound payment | dispatch-assignment.service.ts, driver/vehicle/region/capacity gates |
| Pickup | Sender contact, pickup OTP | Store parcel sender OTP; separate marketplace store handoff | pickup-custody.service.ts, assignment actor, custody and event |
| Transit | Tracking and updates | Vendor/store order tracking | delivery-execution.service.ts, location, attempted delivery and exception |
| Complete | Recipient OTP, POD and receipts | Marketplace courier projection and seller order update | OTP, proof, location, COD ready, delivery complete, driver earning |
| Finance | Cash/card/wallet/refund | Seller/driver/KT allocations and returns | COD custody ledger, bank deposit evidence, independent reconciliation |
| Oversight | Customer history and support | Store deliveries, fulfilment and support | Admin dispatch/recovery, driver compliance, claims, cash, ledger |

These trace existing code and tests, not observed real-world or provider-confirmed transactions.

## P0-A: Pickup operation replay authorization

The pickup service formerly recovered prior completed pickup-start/pickup-confirmation receipts without an explicit original-active-driver actor check, while delivery and GPS-location replay already used driver-operation replay authority. The fix invokes assertDriverReplayAuthority in both first-read and concurrent unique-key recovery paths. It verifies original assignment, order, driver profile, current user binding and active status before returning a receipt. Original custody transitions, OTP restrictions and idempotency keys remain intact.

Changed: lib/services/pickup-custody.service.ts.
Tests: tests/driver-operations/pickup-replay-authority.test.ts; existing driver-replay-authority.test.ts.

## P0-B: COD cash collection receipt replay authorization

The original COD collection request hash bound order/collector/amount but not actor identity. A replay of an existing operation ID could return a financial receipt without checking the immutable recorded actor identity, including the concurrent duplicate-key recovery path. New assertCashCollectionReplayAuthority demands original collector driver profile, matching immutable CashOnDeliveryEvent with COLLECTED event type, same COD record, original actorUserId and original request hash. This preserves valid own receipt recovery after delivery clears current-driver pointer, while rejecting foreign actors, missing evidence, event mismatches and tampering.

Changed: lib/services/cash-on-delivery.service.ts.
Tests: tests/orders/cash-on-delivery-replay-authority.test.ts; additional canonical PostgreSQL other-actor negative test in tests/integration/cod-canonical-postgres.integration.test.ts.

## Source-level regression evidence

- Targeted security tests: 5 test files, 27 passing tests.
- Related driver operations, orders, services, dispatch, payments and driver API regression: 230 files, 1,167 passing tests.
- Focused ESLint and TypeScript (after Next route type generation): passed.
- The PostgreSQL integration file was extended but was not executed against a real disposable database in this working copy; exact-new-SHA CI results must be inspected separately.
- No database migration, payment-provider setting, ledger amount or commercial activation flag was changed.

## Remaining acceptance required outside these code fixes

1. Genuine signed-provider payment for a customer parcel and vendor parcel; exact amount, currency, settlement proof, exactly one journal, wallet/split and refund handling.
2. Real vendor collection addresses with correct verification, current service/route, and independent store certification. Incomplete merchant rows stay ineligible until corrected.
3. Customer marketplace payment and store preparation/merchant handoff, then courier bridge/driver/recipient with shared customer login and address.
4. Actual approved driver, vehicle, pickup OTP, verified dropoff location and recipient OTP/POD; failed-attempt/recovery procedures.
5. Driver COD deposit to genuine business bank, upload proof, daily reconciliation and separate admin finance approval, editable per-driver cap and immutable ledger.
6. Actual multi-recipient owner notification settings and provider delivery, claims/refunds, reviewed legal/compliance requirements, disaster recovery and exact-commit source/deployment acceptance.

Unqualified production status remains NOT_READY until actual external and field acceptance is obtained. Do not fabricate address/location, approval, driver identity, provider signature, paid status, bank deposit, refund or ledger receipt.


## Dispatch funding authority hardening — follow-up

A further source review found that the newer canonical dispatch-assignment service checked order status, driver compliance and marketplace store-order readiness but lacked the explicit parcel money-readiness check present in the older assignment service. The source now enforces canonical courier payment readiness inside its serializable assignment transaction for PARCEL_DOCUMENT at initial driver offer, driver acceptance and reassignment, using getCourierPaymentReadiness(order.id, tx). This permits only source-verified ledger funds or server-classified, independently approved collectible full COD; outstanding digital payment or ledger reconciliation is rejected. A pending or failed payment is never silently treated as confirmed.

Files: lib/services/dispatch-assignment.service.ts and tests/dispatch/parcel-dispatch-funding-gate.test.ts.

Verification: 4 focused files / 26 tests passed; broader driver/orders/services/dispatch/payments/client-platform selection 278 files / 1,505 tests passed. Focused ESLint and TypeScript pass. No financial statuses, commission rates or production data were modified.

A separate lifecycle review question remains: approved full-COD direct bookings currently persist PENDING at creation while dispatch normally requires CONFIRMED. The presence of a collectible COD obligation alone does not prove that operational confirmation has occurred. Before any auto-confirm code is shipped, verify the existing confirmation mechanism and operational approval policy, and add exact database lifecycle acceptance tests. Do not automatically promote unpaid digital orders.
