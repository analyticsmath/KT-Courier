# Personalized delivery rates — role-specific launch behavior

The client documents specify editable delivery fees, service/parcel rates and admin-configurable pricing. The subsequent owner instruction additionally requests that administrators assign bespoke delivery rates to individual customers and stores. No numerical bespoke discounts were provided, so the platform never invents them.

## Versioned, authoritative model
- Admins with `pricing.manage` can create a customer- or store-scoped ZAR tariff for Economy, Standard or Express and one parcel class.
- Each draft specifies a positive base fee and/or per-kilometre rate, an optional minimum charge, its effective period and an audit reason. Admins explicitly activate or deactivate the version; conflicting active intervals in the same identity/service/size are blocked transactionally.
- A signed-in customer or authorized store requesting a quote receives the applicable active tariff. Unauthenticated quotes remain available at general public rates; no identity is trusted from browser-supplied identifiers.
- The road route, delivery-zone checks, risk surcharge, active commercial surcharges, tax calculation and frozen quotation all remain server-controlled.
- The accepted quote freezes the exact tariff version and customer/store scope. Booking rejects a personalized quote that is no longer owned by the authenticated customer or chosen store; expiry and single-use checks remain unchanged.
- Driver compensation, COD, refunds, general store catalogue pricing and marketplace checkout are **not** modified by a bespoke courier tariff. It does not authorize a payment or driver cash collection.
