# Phase 6 — Pricing Engine v1

## Phase 7.5 closure status

**PASS — CLOSED.** Pricing rule precedence is deterministic through specificity, priority, effective date, revision, and ID; an equal-precedence overlap is rejected or fails closed. Quote input hashes cover all price-affecting normalized fields, quote consumption atomically checks input identity and ownership, and order pricing is immutable. The pricing integration suite exercises happy paths, rule conflict and revision behavior, quote expiry/use races, and replay rejection. See [Phase 7.5 closure](phase-7.5-phase6-phase7-closure.md).

Pricing is server authoritative. A client requests a quote with delivery inputs; the server calculates a trusted route, selects exactly one eligible ZAR rule, uses Prisma Decimal arithmetic, stores an immutable quote and returns only a customer-safe breakdown. Orders require a quote ID and consume it atomically.

Calculation version: `pricing-engine-v1`. All money is `Decimal(12,2)` and all rate/distance/weight values are `Decimal(12,4)`. Monetary rounding is round-half-up at each line item and VAT. No native floating point calculation is used in the calculator.

Formula order: base fee; distance after included kilometres rounded up to the rule increment; configured rule surcharge; one high-risk surcharge (the greater applicable origin/destination value); optional vehicle surcharge; weight surcharge; visible minimum-charge adjustment; and VAT. VAT is disabled by seeded default. Rule prices are VAT exclusive. Enabling VAT requires business and legal confirmation of VAT registration.

Rule selection filters active, non-archived, effective, ZAR rules by delivery type, destination region/global fallback, vehicle, weight and maximum distance. Specific region/vehicle/weight/type candidates outrank generic rules, then priority and revision apply. Equal precedence fails closed as ambiguous.

Quotes expire after the `pricing.quote_ttl_minutes` setting (15 minutes seeded). They store the normalized input hash, route distance/duration/provider, rule revision snapshot, region/tax snapshots, line items, totals, calculation version, and ownership. A quote is active, used once, expired, or cancelled. Input hashes deliberately omit display-only text. The order transaction claims an active quote with a conditional update; competing requests cannot create a second order.

`POST /api/pricing/quotes` (and the compatibility `POST /api/orders/estimate`) requires an authenticated customer/store, same-origin request, valid mapped addresses, and is rate limited. It returns strings for every monetary field and never exposes the full internal rule snapshot. `POST /api/orders` strictly requires `pricingQuoteId`; submitted totals, route distances, rates and taxes are rejected by schema validation.

The order copies the quote totals and an immutable pricing snapshot. Historical orders must use this snapshot, never current rules. Rule removal is archival, preserving quoted historical evidence. Payment, wallets, refunds, commissions, promotions, surge/dynamic traffic, marketplace checkout, multi-currency and tax invoices are intentionally deferred.
