# Phase 3 — production provider and controlled-release checkpoint

**Observed 2026-10-27 11:35 UTC.** Read-only acceptance inspection; last deployed/CI baseline `4779b8a9426ff78520ab5dead8e2c314bebb6586`. Any later commit requires its own exact-commit T4 release evidence. This is **not** commercial go-live permission, an approved financial receipt, or an operator signature.

## Existing evidence retained (do not re-test blindly)

- GitHub CI run 40488165023: **SUCCESS** at the baseline SHA.
- Production Certification run 40488164958: **FAILURE**. Twenty-three component jobs passed; the full Chromium job failed six of 154 cases (148 passed) due to a public media fixture with a declared READY image but fabricated, missing bytes. The prior attempt to stage bundled media did not address that separately created object. Browser run artifacts/logs are the historical authoritative record; do not mark these six green without a new exact-SHA run.
- Vercel production READY; Railway web and worker SUCCESS at baseline SHA; Railway production PostgreSQL and Redis are online. Public `/`, `/shop`, `/quote`, `/api/health`, `/api/ready` and `/api/catalog/media/CMA-CAT-GROCERIES` returned HTTP 200 from `www.ktcouriers.com` without mutations. Public health does not establish transaction readiness.
- **Correction candidate:** `tests/e2e/catalog-inventory-upload.spec.ts` no longer creates a fake READY image with placeholder SHA/length. It uses the authenticated normalized upload, real stored bytes, public delivery response and exact byte count/checksum assertion, while keeping the fixture's real publication and pause/resume paths. `tests/e2e-runner/public-media-fixture-evidence.test.ts` adds a fail-first source regression. No production image policy or data changed. Exact-SHA Chromium certification remains **NOT_RUN** until the new commit executes.

## P3-01 External providers — read-only observed facts

- **Email:** the connected Resend account reports `ktcouriers.com` **verified**, sending **enabled**, EU-West region. It reports **zero webhooks**. Domain verification and API-key variable presence do **not** prove verified recipient inbox delivery, bounce/suppression/retry evidence, or approved notification template/event-route publication. Do not invent them.
- **Railway variable inventory:** production `web` (87 variable names) and worker (94 names) include Resend, Paystack, Maps, Cloudinary, protected media storage, database/Redis, notification encryption and payment-mode variable **names**. Connected OAuth redacts all values: no key validity, Paystack test/live setting, approved cash ceilings or signed webhook receipt is asserted. No variable was edited.
- **Cloudinary:** connected account returned existing authenticated-type media asset metadata. This proves stored assets are discoverable, not that every customer/vendor/driver upload, privacy restriction, or retention lifecycle is accepted on genuine devices. No asset was uploaded or deleted during this inspection.
- **Maps/Paystack:** presence of configured names is not proof of live geocoding results, charge/refund, webhook identity, source-of-funds or external settlement. No real checkout was attempted.

## P3-02 through P3-05 — owner/operator authority still separate

- **Finance:** a named authorized finance administrator must privately enter genuine KT beneficiary banking details and independent reviewers must approve 100% personal-parcel COD scope, exposure, custody, deposit limits, remittance timing, commission/VAT and withdrawals. The preexisting 50/50 store policy does not authorize 100% personal-parcel cash collection. Preserve payment, refund, payout, COD and settlement locks until approved real-money acceptance. Never paste banking details into this file.
- **Operations:** actual driver/licence/vehicle/coverage readiness and vendor packing/stock facts need independently reviewed records, followed by a controlled real shipment, GPS/OTP/POD and delivery exception evidence. Synthetic accounts are valid for software QA, but cannot validate real roads, cash or identities.
- **Legal:** public physical/business address, privacy/terms/refunds/POPIA review and authorized business/legal sign-offs require genuine organization evidence. `info@ktcouriers.com` is not a physical address. No legal acceptance is claimed.
- **Release:** exact current code SHA must pass CI, all mandatory browser/PostgreSQL/Redis/security/recovery jobs, deployment parity and `/api/ready`; collect encrypted/restricted provider/finance logs under the existing real-money runbook. Historical accepted code coverage remains valid for unchanged behavior; complete-source CI is required after code changes.

**Disposition:** engineering fixture remediation in progress; provider setup partially verified; launch **BLOCKED_EXTERNAL** for human/legal/finance/road/provider proofs. No protected production row, cash, deposit, payment, webhook, provider configuration, store status or legal record was modified by this checkpoint.
