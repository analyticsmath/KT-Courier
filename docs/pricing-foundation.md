# Pricing Foundation — Phase 1.7

## Overview

Phase 1.7 implements a simple rule-based pricing engine. Prices are estimates only — no payment processing in Phase 1.

## Pricing Rule Model

`PricingRule` fields:
- `name` — descriptive label (e.g., "Base Same-Day Delivery")
- `type` — `PricingRuleType` enum: `FLAT`, `PARCEL_SIZE`, `REGION`, `DISTANCE`, `VEHICLE_TYPE`, `CUSTOM`
- `deliveryType` — optional `DeliveryType` enum; if set, the rule only matches orders of that delivery type
- `amount` — `Decimal` base fee in `currency`
- `currency` — ISO 4217 code, defaults to `"ZAR"`
- `active` — boolean; only active rules are used for estimates
- `regionId` — optional link to `DeliveryRegion` (Phase 1: stored but not used in matching)
- `description` — optional human-readable note

## Estimate Logic

`estimateDeliveryPrice()` in `lib/services/pricing.service.ts`:

1. Loads active pricing rules ordered by `deliveryType` ascending, then `createdAt`
2. Finds the **first** rule where `rule.deliveryType === input.deliveryType` (or `rule.deliveryType === null` as fallback)
3. If no rule matches: returns `total: 0`, `currency: "ZAR"`, with a `"No matching rule found"` breakdown entry
4. Returns `PriceEstimateDto`: `{ total, currency, baseFee, parcelAdjustment, breakdown[], matchedRuleId }`

Phase 1 estimate is a flat fee only — `parcelAdjustment` is always 0. Parcel-count-based pricing is reserved for Phase 2.

**Critical**: The server always calculates the price estimate. The client never submits a trusted price. The `priceEstimate` field on `Order` is set from the server-calculated value during order creation.

## Pricing Audit Log

`PricingAuditLog` records every estimate applied to an order:
- Created after the order creation transaction (non-blocking, silently catches errors)
- Fields: `orderId`, `ruleId` (nullable), `amount`, `currency`, `breakdown` (JSON)
- Enables future pricing audits, rule change impact analysis, and dispute resolution

`createPricingAuditLog()` in `lib/services/pricing.service.ts`.

## Admin Management

Admins manage pricing rules at `/admin/pricing` via:
- **List**: `GET /api/admin/pricing/rules` — all rules (active + inactive) ordered active-first
- **Create**: `POST /api/admin/pricing/rules` — creates active rule
- **Update**: `PATCH /api/admin/pricing/rules/[id]` — updates name, amount, deliveryType, etc.
- **Deactivate**: `DELETE /api/admin/pricing/rules/[id]` — soft delete (sets `active: false`, not a real delete)

All admin mutations require `ADMIN` or `SUPER_ADMIN` role and are recorded in `AdminActivityLog`.

## Public Estimate Endpoint

`POST /api/orders/estimate` — accessible to `CUSTOMER` and `STORE` roles.

Request: `{ deliveryType: DeliveryType, parcelCount: number }`

Returns: `PriceEstimateDto` — the estimate shown on the DeliveryRequestForm review step.

## Seeded Rules

Development seed data includes one rule per delivery type:

| Rule name | Delivery type | Amount |
|-----------|---------------|--------|
| Base Same-Day Delivery | SAME_DAY | ZAR 75.00 |
| Scheduled Delivery | SCHEDULED | ZAR 60.00 |
| Business Account Delivery | BUSINESS | ZAR 55.00 |
| Parcel / Document Delivery | PARCEL_DOCUMENT | ZAR 50.00 |

## Deferred Items (Out of Phase 1 scope)

- Distance-based pricing
- Vehicle type pricing
- Per-parcel surcharges
- Region-specific rates (regionId stored but not used in matching)
- Surge pricing / time-based rates
- Discount codes / store account pricing tiers
- Invoice generation
- Payment provider integration
