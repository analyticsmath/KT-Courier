# Phase 23: Promotions and Coupons

## 1. Domain Model
- **Campaigns**: Define the core rules (dates, discount amounts).
- **Versions**: Immutable snapshots of campaign rules.
- **Targets**: Which products/stores the campaign applies to.
- **Eligibility**: Customer segments or order rules that permit use.
- **Codes**: The actual string users enter.
- **Budgets**: The financial constraints for total usage.

## 2. Campaign Versioning
All campaigns use immutable versions with sequential numbering. Changes create a new version rather than overwriting past settings, ensuring historical integrity.

## 3. Evaluation Pipeline
The evaluation flow runs sequentially:
fetch → target → eligibility → discount → stack → allocate

## 4. Stacking
Uses v1 policy: 1 per category, best-value selection. A customer cannot combine multiple percentage-off coupons on a single item.

## 5. Coupon Security
- HMAC signatures on generated codes to prevent tampering.
- Fingerprinting for user validation.
- Masking of codes in API responses.
- Brute-force protection on redemption endpoints.

## 6. Eligibility
Supports ALL_CUSTOMERS and complex SERVICE_TYPE rules to accurately target intended demographics.

## 7. Budgets
Calculates available funds strictly. Enforces daily limits, optimistic locking to avoid race conditions, and graceful handling of exhaustion.

## 8. Funding/Accounting
Supports PLATFORM_FUNDED, STORE_FUNDED, and SHARED. Ledger journals track precise debits and credits across accounts.

## 9. Multi-Store Allocation
Distributes total discount proportionally across items from multiple stores, taking care of the final-cent recipient and the appropriate funding split.

## 10. Subscriptions
Maintains compatible stacking with subscription benefits (like premium delivery) without exceeding overall cart bounds.

## 11. Checkout Integration
Flow: evaluation → reservation → freeze → finalization → commitment. Reservations temporarily hold budget before the payment succeeds.

## 12. Refunds
Handles customer-paid allocation carefully, managing partial refunds and enforcing a strict restoration policy for coupons on cancelled orders.

## 13. Reconciliation
Uses reason codes to maintain budget coherence and ensure allocation sums strictly match final journal entries.

## 14. Legal/Privacy
Code masking ensures privacy.
Note: This system provides the mechanical tracking but makes no claim to final legal or VAT approval.

## 15. UX
Provides customer-facing titles, masked codes for security, and safe response fields for the front-end to render.

## 16. Integration Testing
Comprehensive test scaffolding, executing source audits, with deferred E2E tests for the final phase.

## 17. Risk Register
Monitors potential issues like race conditions in reservations, timezone boundaries for campaign start/end dates, and partial failures during ledger writes.
