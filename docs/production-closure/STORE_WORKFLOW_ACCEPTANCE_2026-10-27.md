# Store workflow acceptance — 27 October 2026

This record distinguishes implemented behavior, automated checks and live acceptance. It does not certify all store workflows for launch.

## Corrections in this change

- Single-item stock receipt form uses product/SKU and assigned stock-location names, then the existing server dry-run/apply endpoint. CSV remains available for bulk receipts. Both paths retain ownership, integer, version and reservation checks.
- Changing manual receipt inputs invalidates the earlier preview. Invalid quantities do not send requests. An unconfirmed apply locks replacement inputs and exposes retry with the identical operation ID, preventing a second receipt when the first response was lost. Keep the page open for this recovery; reload persistence is not implemented.
- Receipt previews show product and location names rather than requiring an owner to interpret internal references.
- Offer details link directly to product photos/packaging and stock receipts.
- Catalog language explains the owner's work. Product, review and publication statuses have separate labels.
- Saved private-product photos remain visible on the product page after reload, through the existing authenticated media endpoint.
- Product CSV browser tests were absent from both the Chromium allow-list and directed certification selection. They are now included in both; directed acceptance requires 47 discovered cases instead of 44. This corrects a coverage gap, not a claim that the new cases have already passed.

## Local validation

- TypeScript: passed using the repository's configured 8 GiB typecheck command.
- Changed-file ESLint and whitespace checks: passed.
- Inventory component/parser/template suites: 15 tests passed, including review-before-apply, positive whole-unit constraints, changed-input invalidation and identical retry after an unconfirmed apply.
- Browser-plan discovery and workflow selection: 9 tests passed, including all 47 directed cases.
- Full Vitest attempt did not complete in this workspace and was interrupted. Do not count it as passed.
- Actual PostgreSQL and browser execution for this change must be verified through fresh exact-commit certification.

## Existing live evidence

- Vendor CSV invalid-row rejection, saved-preview reload/resume and one-row private product creation passed in Tolvyn. Product CP-A56CCD7F3517221056235076E17DAE28 remains private and unsubmitted. Photo, offer CO-569D7CA3965E8216313C5A6ADB749724 and ZAR 99.00 draft price were saved and are visible from the admin record.
- Admin suspend and reactivate passed; Tolvyn was restored ACTIVE. Both transitions and a read-only support session appeared in the activity log under the real admin identity.
- Coupon draft remains DRAFT and inactive. Admin coupon navigation and draft-neutral heading corrections deployed and the sidebar link was observed live.
- These synthetic records are not products authorised for customer sale, proof of real stock, valid legal identity or commercial approval.

## Remaining store launch blockers

- Live owner session is currently signed out; owner-side verification of this release and remaining settings/employee/order workflows is pending. A sign-in tab is prepared.
- Stock CSV transport has not passed a live device test; template download automation timed out. Isolated browser receipt checks remain required.
- Tolvyn identity TOLVYN-QA-V1 explicitly declares QA simulation and invalid registration. Genuine seller evidence must be independently reviewed; do not approve the fixture as real.
- No approved commission configuration exists for the test store. Real commercial values and independent approval/activation are required for marketplace settlement.
- Current-release vendor onboarding, payment, settlement, refund and payout acceptance remains required. Provider configuration or mocked fixtures alone does not prove provider acceptance.
- Runtime production readiness reported 13 global launch blockers, 20 ready checks and 3 policy exclusions when inspected; this is broader than store-only scope and is not a readiness percentage.
- Human usability testing has not occurred. Browser automation proves the exercised behaviors, not that real owners find every action without help.

## Settings correction follow-up

The settings API emits validation as `{ error, fields }`, while StoreProfileForm was reading `{ message, errors }`. Corrected the response contract so server field errors render beside their fields and input values survive failure. Optional phone/email now submit blank values when deliberately cleared. Existing store contact fields populate defaults when the separate store profile is missing, avoiding accidental removal during an unrelated save. Whitespace-only business/contact names are rejected after trimming. Pending saves lock inputs and reject duplicate submission; success remains visible until another edit and refreshes the page's saved identity.

Updated focused validation: 18 tests pass across four receipt/profile suites. New profile tests exercise real API error shape, preserved invalid input, optional clearing, pending duplicate prevention and whitespace rejection. TypeScript and changed-file ESLint pass. Live owner settings save/reload remains pending sign-in; do not infer it from component tests.
