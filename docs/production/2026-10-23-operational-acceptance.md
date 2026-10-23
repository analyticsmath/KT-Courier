# Operational acceptance — 23 October 2026

Status: **INCOMPLETE — not a production launch sign-off.** Work remains on `main`; no Git branches were created. The site operator authorized the named customer, vendor, administrator and driver accounts as controlled test accounts, sandbox payments and explicitly labelled sample documents. No credentials are included here.

## Automated evidence

- Standard Vitest suite: **897 files passed, 4,489 tests passed**. This suite excludes database integration and browser tests; these counts must not be presented as end-to-end coverage.
- TypeScript: passed after the changes.
- Targeted ESLint: passed; the inventory generator is ignored by ESLint and separately passed `node --check`.
- Route authorization inventory: **762 API routes**, including the new store media-content and seller-document endpoints. Generation now also records direct catalog guard permission keys.
- Public color audit: passed. Replaced 375 component CSS literals with shared palette references across 20 stylesheets. A PostCSS declaration comparison verified identical resolved color values before and after replacement.
- The initial standard suite had 13 failures: four missing rating-aggregate mocks, an unindexed pair of new routes, the former disabled-email stub assertion, and seven checks affected by later public/operations redesign work. Corrected the mocks and inventory; updated design expectations against repository history and `DESIGN.md`. The retired eight-chapter homepage's former handoff travel threshold does not define the replacement homepage. The static operations illustration has a narrow two-gradient exception; other SVG/data and interface-gradient restrictions remain checked.

The integration suite requires a named disposable PostgreSQL environment with network isolation. This executor has no Docker or PostgreSQL executable; creating a network namespace returned `Operation not permitted`. The isolation requirements were retained, and integration tests were not pointed at production. Repository GitHub Actions supplies the isolated environment instead.

CI investigation found that all 20 PostgreSQL matrix jobs, Redis/recovery and recovery jobs passed for commit `a49955718eaaffe0b27b131474fe2ef0086927cd` (Production Certification run `39949086614`). Its quality job had the standard-suite failures addressed here. Its canonical browser stage failed with `PAYMENT_PREPARATION_BLOCKED`: the disposable fulfilment policy was previously activated only after payment, but the correct production precondition requires an active policy before any charge. The fixture bootstrap now creates, submits, independently approves and activates that policy through the normal service authority before test checkout. The production gate is unchanged. Fresh CI certification on the resulting commit remains required; success on an older commit is not head certification.

## Live observations accumulated during this acceptance session

| Workflow | Verified evidence | Remaining acceptance |
| --- | --- | --- |
| Customer parcel quote | Economy small-parcel Gauteng quote issued at R102.35 including VAT | Additional size, scheduling, coverage and expiry cases |
| Sandbox parcel payment | Two confirmed Paystack sandbox payments; decline/retry/success exercised | Refund and reconciliation lifecycle, email receipts |
| Customer cancellation and tracking | One paid sandbox request cancelled; exact/lowercase reference tracking checked; invalid lookup remained generic | Driver progress and final delivery tracking |
| Customer cart and saved address | Quantity increase/decrease/removal; address creation/editing | Marketplace checkout through store fulfilment |
| Vendor catalog access | Red Apples 1 kg saved with matching photograph, R29.99 price, SKU and 12 units in the sandbox stockroom; product and offer submitted for review | Admin review and publication passed; stock changes and purchase remain |
| Product schemas | Compatible v2 definitions deployed; Groceries and Fresh Produce v2 used successfully for live listing authoring | Admin review and subsequent product edits |
| Vendor product photos | Store-owned apple photo selected and saved on the matching Red Apples listing | Upload another image |
| Seller supporting documents | Public sample PDF uploaded privately, downloaded as owner, and submitted as GBG-UAT-20261023; admin review page displays the file link and effective window ending 13:30 UTC | Admin download completed in the cloud browser and extracted text matched the expected public dummy PDF. Bounded test version approved; obsolete placeholder rejection confirmed in the admin UI. |
| Email provider | Actual connection-test email accepted by the provider for the vendor account | Recipient inbox receipt remains unconfirmed |
| Lifecycle notifications | All 31 prepared templates and their recipient policies approved through the administrator UI | Separate administrator must publish; routes then need preparation, approval and activation before new-event tests |
| Driver onboarding | Driver login/readiness checked; existing licence approved; identity document and compliant vehicle missing; vehicle registration form exercised (save result unconfirmed) | Sample file intake/review, vehicle workflow and scoped dispatch/delivery tests |
| Admin operational controls | Account/store/driver dossiers and review requirements inspected | Complete commercial-policy activation, dispatch and exception workflows |

The controlled Red Apples listing is saved and submitted: product `CP-37F567A4727533C69753C2E0CFDF68D9`, offer `CO-B79D37B2BAE8C941DC3758FA7FCA14FC`. Admin product/offer approval and publication succeeded; the shop and product page showed the matching image, R29.99 price and in-stock state. The product was then suspended with reason `SANDBOX_PUBLICATION_VERIFIED_TEST_LISTING_CLOSED` to prevent further purchases. No successful live marketplace purchase is claimed.

## Deployed fixes already verified by release checks

- Marketplace quote authority resolves missing coordinates from the saved complete collection address; incomplete collection addresses receive actionable rejection.
- Parcel payment-return navigation opens courier tracking rather than marketplace checkout status. Payment origin uses the canonical `www` host.
- Missing self-notification and store-catalog default grants are repaired without overriding explicit denials or disabled grants.
- Empty product-type schemas receive compatible successor definitions. A guarded recovery handles only the exact known failed immutable-update migration, and production migration deployment succeeded.
- Administrator email diagnostics send a real provider request for an active verified account and record request/result audits. Provider acceptance is explicitly distinct from delivery.
- Store-owned catalog image previews enforce store scope, validation/checksum checks and private no-store delivery. Preview card size and accessible button labels were corrected after browser inspection.
- Seller document intake reuses private storage, enforces active ownership, same origin, rate limits, file type and size bounds, and validates file ownership/purpose/readiness on seller submission and approval. Vendor/admin download links use the authenticated private-media reader.

## Access needed to finish live acceptance

File-URL access has been enabled by the operator, and live browser control recovered. Seller PDF upload, owner download and submission succeeded. The admin private-file request returned HTTP 200; browser download-path confirmation timed out and reset the connection. A fresh tab recovered control. The bounded seller test version was approved, and the old placeholder proposal rejected. A later driver file-chooser attempt also timed out; no successful driver upload is claimed.

The notification authority requires a publisher different from the approver. The operator supplied a second existing administrator and explicitly approved granting it template-publication and route-approval permissions. Its login succeeded, but its existing 199 effective permissions did not include those actions. The employee directory was read-only despite an existing audited permission API. A narrow Super Admin form now requests only the two approved permissions, using a new explicit MERGE mode that preserves unrelated overrides. The legacy replacement behavior remains the default. The merge-preservation regression failed before the fix and passes afterward; self-edit, protected-Super-Admin and missing-manager denial tests cover both modes. Actual grant and notification activation remain pending deployment and live verification. No artificial administrator identity was created, and independent approval rules remain in force. Commercial policy approval/activation has its own independent-review requirements.

A downloaded sample PDF is test evidence only, not proof of genuine identity or legal registration. Keep test records and any resulting approvals clearly scoped to the controlled acceptance exercise. Do not claim a sample establishes real-world eligibility.

## Remaining release gates

Complete vendor product/media/inventory/moderation and seller-document round trips; activate reviewed commercial and notification configuration through authorized accounts; complete a sandbox marketplace purchase and vendor fulfilment; complete driver onboarding, dispatch, pickup, OTP/POD, tracking and delivery exceptions; verify new-event email delivery/audits; run isolated database integration and browser checks; review the final deployment and test-data disposition. Only then consider a real-customer launch decision.

## Current-head CI checkpoint

For `10682d3a074e97b4f08efe74e59b6fdd87c35c01`, Production Certification run `39957281363` has passed quality, all 20 PostgreSQL groups, Redis/recovery and recovery. Its browser job has passed store earning reversal, canonical store PostgreSQL acceptance with verified Paystack source, and the new-vendor five-product media/cart/chat/delivery scenario. Directed acceptance, withdrawal finance and canonical offline Paystack stages subsequently passed. The final Phase 1 full Chromium stage completed with 141 passed and 4 failed out of 145; later Phase 1 stages were not started. Three assertions referred to the retired homepage/navigation and one inspected undecoded lazy images. The updated checks target the current editorial homepage/native dialog and exercise rendered images after scrolling them into view. Fresh browser evidence remains required. Regular CI run `39957281353` completed with 10 successful jobs and 18 optional jobs skipped. Skipped optional jobs are not counted as passes. The certification run failed at the final browser stage; it is not a launch certification.

A live catalog review exposed missing presentation labels for canonical `PENDING`, `PENDING_VALIDATION`, `PUBLISHED` and `WITHDRAWN` states. Added explicit labels while preserving the neutral fallback for unknown values. The existing commerce closure suite passed all 8 tests after this display-only change.

The operator subsequently authorized extending the temporary Paystack sandbox through **2026-10-23 16:30 UTC**. Railway accepted that expiry update and deployment `31bf0332-f3d9-4c17-a360-8e1bd5a5ec13` succeeded. The original seller approval remains expired and the test product suspended; any new live purchase needs a fresh bounded seller submission plus normal commercial-policy authority.

Driver fleet-form inspection found twelve visible labels without input associations in registration, compliance-document and photo forms. Added stable IDs/`htmlFor` associations and descriptive form names. ESLint and TypeScript checks passed. Browser file attachment continued timing out after the native chooser opened; no successful driver file upload or compliant vehicle approval is claimed.


## Independent activation and upgraded permission registry

Store fulfilment policy `sopolicy_78128bd362bc4cf69f98f5508499bb40` was submitted and approved by the Super Admin, then independently activated by the existing web administrator. The live UI confirmed ACTIVE. The digital payment configuration also shows Active for all businesses/all provinces.

The scoped notification grant exposed an upgraded-database defect: the canonical registry has 431 keys but the live database had only 209, so the existing permission endpoint rejected the two requested canonical keys as unknown. Commit `937b205e396d451054752eef184152e39d37bd14` repairs only requested missing canonical entries after actor authorization; it creates no role defaults and preserves unrelated overrides. Unknown keys remain rejected without writes. All 4,491 tests across 897 files pass; TypeScript and focused ESLint pass. Railway deployment `1b973128-974c-4785-a988-18ab8b364657` succeeded. Live retry raised the second administrator from 199 to 201 effective permissions. All 31 approved templates were published by that administrator, all 31 routes prepared by the Super Admin, all 31 routes approved by the second administrator, and activation actions completed by the Super Admin. The final live UI confirmed 31 PUBLISHED templates, 31 ACTIVE routes, zero remaining activation buttons and no error alert. Actual new-event delivery and recipient inbox receipt still require evidence.


The cloud vendor upload of a clearly marked sample PDF succeeded, returning private reference `PMO-a8d6814d-6feb-459c-a030-c7b2eb7d16e6`. The seller form's device-local effective-time fields caused ambiguity over the authorized 16:30 UTC expiry; automatic review blocked submission. The form now labels effective times as UTC and parses those values explicitly in UTC. Eight regression cases cover multiple device time zones and malformed/offset inputs. The seller proposal has not yet been submitted with this new evidence.
