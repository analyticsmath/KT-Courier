# Authoritative Store Settlement Snapshot

The snapshot is immutable upstream evidence, not a client calculation. It identifies an opaque `MARKETPLACE_ORDER` subject, subject reference, settlement reference/version, store and store wallet, verified payment, calculation version, and canonical authoritative time.

Exact financial fields are:

- `sellerSettlementBasisAmount`
- `attributedCommissionAmount`
- `netStoreEarningAmount`
- `currency = ZAR`
- ordered commission allocation evidence

The required equation is:

`sellerSettlementBasisAmount - attributedCommissionAmount = netStoreEarningAmount`

Commission charge rows must total the attributed commission exactly. An allocation may occur only once in one snapshot, must relate to the verified payment subject through the existing commission accrual, and cannot cause `storeAttributedAmount` to exceed its original allocation amount.

One opaque subject may produce independent snapshots for several stores. Uniqueness is per subject, store, and settlement version; no marketplace/order-item tables are introduced. The snapshot excludes customer PII, bank/card details, raw provider data, secrets, client formulas, balances, and mutable order/payment status.

Phase 20 is expected to supply marketplace evidence; Phase 21 is expected to supply lifecycle and release eligibility. Production mutation remains locked until those integrations receive consolidated validation.
