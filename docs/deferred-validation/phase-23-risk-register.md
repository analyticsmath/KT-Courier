# Phase 23 Risk Register (Deferred to Phase 26.5)

## Concurrent Budget Reservation Races
High traffic checkouts could cause race conditions around budget limits. Mitigation: implement strict atomic DB locks during reservation.

## HMAC Key Rotation
Current HMAC mechanism needs an organized strategy for key rotation without breaking existing valid codes.

## Stacking Policy Edge Cases
Combining store-level discounts with platform-level subsidies and subscription discounts may result in negative totals or complex distribution.

## Refund Restoration Timing
When an order is refunded, the redemption must be gracefully reversed and budget appropriately incremented if the campaign is still active.

## Cross-timezone Date Boundaries
Campaign `startsAt` and `endsAt` boundaries may face edge cases if targeting different geographic zones, though ZAR implies primarily local processing.
