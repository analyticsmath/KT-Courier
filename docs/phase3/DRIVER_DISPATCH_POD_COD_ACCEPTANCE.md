# Driver, dispatch, proof of delivery and cash custody

Dispatch and driver work remains governed by canonical assignment, driver profile, delivery proof and COD custody records. Existing exact-source selections include `test:integration:dispatch`, `test:integration:driver-operations`, the driver-earnings and closure PostgreSQL suites, `tests/e2e/driver-canonical-delivery.spec.ts` and `tests/e2e/cod-custody-remittance.spec.ts`.

Phase 3 adds assignment status notifications only when an `OrderAssignmentEvent` matches the current assignment, order and active driver profile. Payloads are reconstructed from those rows. A status message does not imply that a delivery, COD remittance or payout completed. Finance and operational policy activation remains owner-controlled.

No physical phone, camera, GPS, driver acceptance or real cash-custody run was performed. Production COD rows and payouts were not inspected or modified. See [finance](FINANCE_AND_PROVIDER_CERTIFICATION.md), [device acceptance](DEVICE_ACCEPTANCE.md) and [the release blockers](GO_NO_GO.md).
