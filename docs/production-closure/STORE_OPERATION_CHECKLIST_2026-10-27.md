# Store operation checklist — 27 October 2026

Purpose: complete and verify store-owner functionality and its admin handoffs. Status is evidence-specific; a page loading is not an end-to-end pass. Record new defects before correcting them.

| Area | Required operations | Current verification / work |
| --- | --- | --- |
| Account lifecycle | Register business, duplicate account recovery, OTP, resend, login, reset | Code and existing tests to audit; do not accept terms or create unrelated identities for testing |
| Store access | Approval, pending onboarding, suspension, reactivation, restrictions | Live admin suspension/reactivation/audit passed; owner restriction view still to test |
| Store settings | Identity/contact save, validation, clear optional fields, persisted reload | API error contract and clearing corrected; live invalid-name correction/save/reload passed |
| Collection | Save/update pickup, address validation, delivery prefill | Existing pickup saved; edit/prefill regression to test |
| Branding/legal | Avatar/logo/cover, private documents, submission, feedback | Existing branding and private QA proposal recorded; genuine legal approval is separate |
| Team | Invite, accept, module permissions, disable, remove | Existing isolated browser lifecycle coverage; inspect live owner controls without inviting unrelated people |
| Product authoring | Create, category/type, variants, photos, edit, validation | Live draft/CSV creation and saved-photo gallery passed; offer links and inventory read-back passed |
| Offers | SKU, price, location, review, packaging, publication, stopping sales | Live draft offer/price passed; missing pause/resume identified and implemented with review-preserving guards, projection withdrawal/rebuild, retry and cache invalidation |
| Stock | Locations, single receipt, CSV, preview, apply, concurrent/retry behavior | Single receipt applied to private QA product: invalid zero blocked, preview 0+2, reload showed 2; file chooser transport not yet proven live |
| Courier deliveries | Quote, address serviceability, request, pickup override, repeat, tracking | Saved pickup and Maps destination selection passed; live Economy quote R102.35 for 1 kg small parcel; no booking/payment made |
| Marketplace orders | Accept/reject, prep, substitutions, cancel, handoff | Isolated coverage exists; live test order needed for runtime acceptance |
| Finance | Earnings, destinations, withdrawals, refunds, settlement | Zero-balance/empty states to inspect; no unauthorised money movement |
| Growth | Coupons, targets/limits, review, inactive commercial programs | Draft save and admin visibility passed; no funded/active QA coupon |
| Communications | Notifications, messages, support, review replies | Inspect discoverability, validation and error states; do not contact unrelated users |
| Usability | Mobile, keyboard, labels, pending/failure/recovery, saved state | Apply checks to consequential actions; do not claim human testing occurred |
| Release | Types/lint/unit, PostgreSQL, browser discovery/execution, deployment | b57ba8c deployed web+worker; CI found an outdated missing-media test fixture, now corrected; fresh certification still required |

## Confirmed defects already corrected

- Catalog CSV initially metadata-only; actual bounded preview/apply and saved-preview continuation were implemented.
- Product draft continuation lacked photo/offer setup; added setup and offer price navigation.
- Product image picker included branding assets; excluded them.
- Coupon whole-number constraints prevented valid save; corrected and saved a live inactive draft.
- Admin coupon review lacked sidebar navigation; added permission-gated link.
- Draft promotion was labelled submitted; corrected neutral heading.
- Saved-photo selection message implied saved images were missing; count and gallery added.
- Single stock receipt required internal-reference CSV; added named entry/review and protected retry.
- Settings ignored the API's field-error contract and could not clear optional contacts; corrected, protected pending saves and rejected whitespace names.
- Product CSV browser test was excluded from Chromium discovery and directed certification; registered it and made 47 cases mandatory.

## Open runtime prerequisites

Genuine seller evidence, approved commission terms and current-release provider/settlement acceptance remain genuine prerequisites. Do not mark synthetic identity, stock or product fixtures as real commercial approval. These are distinct from coding defects.

## New defects corrected after this checklist was created

- Listing availability had no owner pause control or resume endpoint. Added both with existing ownership, same-origin, permission, version, operation receipt and state-machine checks. Resume only accepts PAUSED, preserves publication state and validates/rebuilds an already published snapshot; it cannot activate submitted, draft, suspended or rejected offers. Pause/archive immediately withdraw public projections and queue cache invalidation. The event consumer acknowledges intentional withdrawal instead of endlessly retrying an ineligible projection.
- The published-product packaging test fixture omitted the real service's media array, causing both CI failures after the photo gallery addition. Updated the fixture to reflect the service contract.

Validation: 104 focused authentication/listing/settings/inventory tests across 20 suites passed, TypeScript and changed-file ESLint passed. Added PostgreSQL pause/resume, rollback and projection retention cases to the existing storefront withdrawal integration suite, and mobile browser pause/resume assertions. These new DB/browser cases are pending exact-release certification; discovery is not execution.

Live QA stock is synthetic and belongs only to the private unsubmitted product. The two-unit receipt is not evidence of physical goods for sale. No QA product, coupon, identity or commission arrangement was commercially activated.

## Admin continuation after sign-in

- Confirmed the live Super Admin session and store directory/status filters.
- Opened Tolvyn's submitted offer through the admin list. Product approval and offer/publication state remain separate. An empty publication reason was rejected with a readable validation message; no QA product was published.
- Opened the seller review. The proposal explicitly contains synthetic, invalid registration evidence. Approval and rejection require evidence review; no false identity attestation was made.
- Opened store-specific commission preparation. The store and marketplace subject were preselected, and rate/effective dates require explicit commercial input. No rate was invented or activated.
- Opened an audited read-only support session with a QA reason. Business profile, deliveries, team, campaigns, reviews and membership empty states rendered correctly without ownership or permission changes.

### Fresh verification evidence

For main commit 42a3e42d1c0e404dab87925e399253c8648ff7db:
- CI quality, build/typecheck/lint, migration, authorization, financial/security and cross-module jobs passed.
- Production Certification PostgreSQL catalog, storefront, store orders, checkout, earnings, refunds, withdrawals, auth and permission jobs passed.
- Directed Chromium execution: 46 passed, one failed. All three product CSV cases passed at 320, 390 and 1440 pixels, including file/paste, validation, saved preview, apply/replay, photo persistence, offer continuation and tenant denial.
- The single failure was invalid lifecycle test setup: ACTIVE offers require published product state and an active current price in PostgreSQL. Replaced the impossible private ACTIVE fixture with independently staged canonical price, publication snapshot and ready media in the disposable test database. Follow-up commits 02557b6 and 2d525e4; their fresh CI/browser execution remains pending. These commits change test fixtures, not production activation requirements.
- Railway web and worker deployment of 42a3e42 succeeded.

### Remaining acceptance requirements

This is not a declaration of full production readiness. A genuine seller identity, an agreed independently approved commission policy, exact-release payment/settlement/refund/payout acceptance and the resulting withdrawal gate clearance remain outstanding. The live Tolvyn QA offer remains SUBMITTED/DRAFT, its CSV product remains private DRAFT, and all QA promotion/identity evidence remains commercially inactive.
