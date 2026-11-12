# KT Couriers — Cross-Role Paystack Integration Acceptance Root Cause
Date: 12 November 2026
Audited baseline: main 3f3519fb19a824ac3ae54231f219339775ddcf77

## Source-level and production certification finding
GitHub Production Certification run 43238931825 had one failed browser job and all other configured engineering jobs passed. The canonical isolated PostgreSQL browser stage reported 42 failures, including CHECKOUT_REVIEW_REQUIRED 422, absent disposable SystemSetting rows, and cascading failures in COD, marketplace, refunds and driver handover.

## Common cause
The real Paystack adapter now correctly permits a first-time merchant reference initialization only following typed PAYSTACK_TRANSACTION_NOT_FOUND. The isolated disposable Paystack provider instead threw a generic Error('Synthetic provider transaction not found.') when a first-time reference had no database row. This generic error was previously swallowed but is now correctly propagated, preventing the fixture from recording the initial provider transaction and causing downstream browser/integration failures. These 42 failures must not be described as 42 separate confirmed domain defects.

## Narrow code repair
The disposable provider's absent-reference branch now throws the same typed PaymentError('PAYSTACK_TRANSACTION_NOT_FOUND', ...) contract as PaystackClient. The disposable identity controls are preserved: E2E-only runtime, exact local PostgreSQL database/user, offline networking, test provider secret and namespace-owned contacts. The real provider, payment processing, ledger, webhook verification, COD and driver state machines remain unchanged.

Tests: tests/unit/disposable-paystack-verify-contract.test.ts establishes typed missing-reference behavior and rejection under an invalid runtime. The existing disposable provider policy tests also remain enforced.

## Verification boundary
Focused: 3 test files / 42 tests passed. Next.js route typing, TypeScript and focused ESLint passed. Full source regression results and latest exact-commit CI must be recorded separately. Docker is not present on the isolated computer, so real disposable PostgreSQL + Chromium proof depends on the exact-SHA GitHub Production Certification job. No production settings or financial rows were changed, and live commercial acceptance remains a separate operator/customer action.