# Operational acceptance — 23 October 2026

Status: **INCOMPLETE — not a production launch sign-off.** Work remains on `main`; no Git branches were created. The site operator authorized the named customer, vendor, administrator and driver accounts as controlled test accounts, sandbox payments and explicitly labelled sample documents. No credentials are included here.

## Automated evidence

- Standard Vitest suite: **897 files passed, 4,485 tests passed**. This suite excludes database integration and browser tests; these counts must not be presented as end-to-end coverage.
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
| Vendor catalog access | Fixed missing catalog permission grants; inventory location saved | Complete realistic product save, review, publication, stock changes and purchase |
| Product schemas | Insert-only compatible v2 definitions deployed; original immutable definitions preserved | Complete the live authoring round trip |
| Vendor product photos | Private previews loaded and showed actual store-owned apple photos | Finish listing with a matching product identity; upload another image |
| Seller supporting documents | Owner upload and owner/admin download controls implemented, deployed and covered by focused authority tests | Upload the sample, download as owner/admin, submit and review the proposal |
| Email provider | Actual connection-test email accepted by the provider for the vendor account | Recipient inbox receipt remains unconfirmed |
| Lifecycle notifications | All 31 prepared templates and their recipient policies approved through the administrator UI | Separate administrator must publish; routes then need preparation, approval and activation before new-event tests |
| Driver onboarding | Driver login/readiness checked; existing licence approved; identity document and compliant vehicle missing | Sample file intake/review, vehicle workflow and scoped dispatch/delivery tests |
| Admin operational controls | Account/store/driver dossiers and review requirements inspected | Complete commercial-policy activation, dispatch and exception workflows |

The realistic grocery listing remains an unsaved browser draft. Its details and photograph must agree before submission. No successful catalog save or marketplace purchase is claimed in this report.

## Deployed fixes already verified by release checks

- Marketplace quote authority resolves missing coordinates from the saved complete collection address; incomplete collection addresses receive actionable rejection.
- Parcel payment-return navigation opens courier tracking rather than marketplace checkout status. Payment origin uses the canonical `www` host.
- Missing self-notification and store-catalog default grants are repaired without overriding explicit denials or disabled grants.
- Empty product-type schemas receive compatible successor definitions. A guarded recovery handles only the exact known failed immutable-update migration, and production migration deployment succeeded.
- Administrator email diagnostics send a real provider request for an active verified account and record request/result audits. Provider acceptance is explicitly distinct from delivery.
- Store-owned catalog image previews enforce store scope, validation/checksum checks and private no-store delivery. Preview card size and accessible button labels were corrected after browser inspection.
- Seller document intake reuses private storage, enforces active ownership, same origin, rate limits, file type and size bounds, and validates file ownership/purpose/readiness on seller submission and approval. Vendor/admin download links use the authenticated private-media reader.

## Access needed to finish live acceptance

File-URL access has been enabled by the operator. Browser setup can respond, but subsequent browser commands have timed out; live tab control must be restored before further account operations can be certified.

The notification authority requires a publisher different from the approver. Only one administrator login has been supplied. A second existing authorized administrator is needed for normal publication/activation; no artificial administrator identity was created and the approval rule was not removed. Commercial policy approval/activation has its own independent-review requirements.

A downloaded sample PDF is test evidence only, not proof of genuine identity or legal registration. Keep test records and any resulting approvals clearly scoped to the controlled acceptance exercise. Do not claim a sample establishes real-world eligibility.

## Remaining release gates

Complete vendor product/media/inventory/moderation and seller-document round trips; activate reviewed commercial and notification configuration through authorized accounts; complete a sandbox marketplace purchase and vendor fulfilment; complete driver onboarding, dispatch, pickup, OTP/POD, tracking and delivery exceptions; verify new-event email delivery/audits; run isolated database integration and browser checks; review the final deployment and test-data disposition. Only then consider a real-customer launch decision.
