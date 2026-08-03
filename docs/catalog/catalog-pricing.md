# Catalog pricing

Prices are immutable versions, not product fields. Amounts are exact `Decimal(18,2)`, positive, `ZAR`, and explicitly VAT-inclusive. Start is inclusive; end is exclusive. Scheduled/active periods use a PostgreSQL exclusion constraint and service validation to reject overlap. A partial unique index permits only one active version per offer.

Draft, scheduled, active, retired, and cancelled states are supported. An active version cannot be edited; a change creates the next version. No compare-at, promotional, coupon, or campaign price exists in Phase 18. Activation is source-locked.

