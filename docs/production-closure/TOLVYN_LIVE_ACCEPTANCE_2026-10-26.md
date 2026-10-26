# Tolvyn live vendor and administrator acceptance — 26 October 2026

This register records observed actions, not complete launch certification.

## Confirmed live

- Signed-in vendor: Tolvyn Tech Accessories; account active, pickup saved.
- Created synthetic product `CP-65732148E4AC066DD2E0A20E4ECE6A0E` and offer `CO-0BF66B6E2E7125F252824E2C9D7C330E`, price R99.00, zero stock. Submitted both for review.
- Created active primary stock location `Tolvyn QA Stockroom`.
- Reproduced product save failure when the image picker offered branding assets. Fixed purpose filtering; live retest shows only the valid product image.
- Reproduced disabled first-stock-receipt template for tracked items without levels. Fixed location fallback; live retest shows the template enabled.
- Reproduced coupon draft default usage counts rejected by native browser validation (minimum 0.01 with integer step). Fixed integer minimum. Live save still needs retest under vendor login.
- Authenticated Super Admin inspected the store dossier and seller submission.
- Product approval and offer approval each succeeded with explicit QA reason codes. Product remains unpublished; no publication action was invoked. No checkout, payment or settlement was performed.
- Admin attention queue showed resolved cases ahead of outstanding submissions. Fixed query to select OPEN, UNDER_REVIEW and NEEDS_CHANGES before the dashboard takes six rows, preserving priority and oldest-first order. Full history remains available.

## Open acceptance

- Seller submission is explicitly synthetic (`QA-REG-NOT-VALID-0001`); it remains pending, not represented as verified legal identity.
- Store commission plan does not exist; no live deductions or financial policy were activated.
- Packaging measurements are synthetic fixtures, not approved real shipping facts.
- Stock receipt template download/application and resulting inventory must still be tested through the browser.
- Coupon save/review, advertisements, employee invitation lifecycle, refunds and complete purchase-to-delivery journey remain unaccepted in this live account.
- Vendor product CSV import is explicitly unavailable in both page and application service. This is unfinished engineering work, not a missing client decision.
- Exact-release deployment/CI and responsive admin retests remain separate from local unit results.

## Verification

- Baseline after coupon fix: 4,856 tests / 978 suites passed.
- Attention-query correction: 4,858 tests / 979 suites passed; lint and TypeScript passed.
- Product status labels use separate product, review and publication terms; existing product-page regression, lint and TypeScript checked separately.

Do not infer commercial launch approval, real seller verification, or complete Phase 2 acceptance from these results.
