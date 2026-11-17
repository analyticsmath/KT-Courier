# KT Couriers — Pre-Commit Reconciliation & Closure Evidence (`L-05`)

**Prepared:** 16 November 2026  
**Repository:** `analyticsmath/KT-Courier`  
**Audited Base HEAD:** `f913616803818e8e92b12e983dbed9c0157050ea` (application closure commit `8f990a259efbe224ee6ddef907836356f70ed0b7`)  
**Workspace Status:** Working-tree remediation verified locally prior to commit & push; archival baseline manifests remain untouched (`docs/phase3/final-certification.json`, `docs/final-closure/final-acceptance.json`, `docs/production-closure/engineering-gates.json`).

---

## 1. Change Inventory vs Audited Base HEAD (`f9136168`)

### Application Code, Schema & Governance Modified / Added
- `prisma/schema.prisma`, `prisma/migrations/20261116120000_address_suburb_field/migration.sql` — additive nullable `Address.suburb` column keeping saved unit (`line2`) isolated from suburb/area.
- `lib/maps/google-maps.types.ts`, `lib/maps/address-normalizer.ts`, `lib/validation/address.ts`, `lib/validation/address-book.ts`, `lib/client-platform/contracts.ts`, `lib/dto/order.dto.ts` — canonical optional/nullable `suburb` contracts while preserving store pickup compatibility.
- `lib/marketplace-checkout/customer-checkout-prefill.ts`, `lib/services/addresses.service.ts`, `lib/services/customer-address-map-authority.ts`, `lib/services/customer-addresses.service.ts`, `lib/services/orders.service.ts`, `app/api/public/delivery-quotes/[id]/payment-methods/route.ts` — suburb persistence, stale map-pin reset on suburb mutation, explicit legacy-locality confirmation signals, and `suburb ?? line2` parcel COD locality checks.
- `components/public-v2/commerce/CheckoutExperience.tsx`, `components/account/AddressBookManager.tsx`, `components/forms/PublicDeliveryQuoteForm.tsx`, `components/maps/AddressAutocomplete.tsx` — preserved independent suburb prefill & confirmation banner in Precision White tokens, separate `#address_line2` and `#address_suburb` fields, `#pickup-suburb`/`#dropoff-suburb` forwarding, and React `useCallback` dependency closure.
- `lib/retention/privacy-retention.service.ts`, `app/api/private-media/[reference]/route.ts` — `DELETE /api/private-media/[reference]` (ownership / `PRIVATE_MEDIA_DELETE`, `RetentionHold`, and `DEPOSIT_PROOF_FINANCIAL_HOLD`), automated `PRIVATE_MEDIA` `DELETE` retention execution via `PrivateMediaService.requestDeletion`, and clearing `Address.suburb` + `formattedAddress` during `executeAccountAnonymisation`.
- `lib/governance/directive-code-coverage-register.ts` — added `REQ-L01-SAVED-ADDRESS-SUBURB-UNIT-ISOLATION`, `REQ-L02-COVERAGE-MATRIX-AND-HIGH-RISK`, `REQ-L03-L04-LIVE-GATEWAY-AND-LOCK-PARITY`, and `REQ-PRIV-MEDIA-DELETION-AND-RETENTION`.

### Tests, E2E Configuration & Crosswalk / Runbook Docs Modified / Added
- `tests/client-platform/l03-l04-whatsapp-sole-trader.test.ts` (new)
- `tests/ui/checkout-saved-address-suburb.test.ts` (new)
- `tests/marketplace-checkout/customer-checkout-prefill.test.ts` (extended)
- `tests/integration/l01-l02-coverage-and-suburb.integration.test.ts` (new, registered in `scripts/disposable-closure-tests.mjs`)
- `tests/integration/client-contract-gaps-postgres.integration.test.ts` (new, registered in `scripts/disposable-closure-tests.mjs`)
- `tests/e2e/checkout-saved-address-l01.spec.ts` (new, added to `chromium` project in `playwright.config.ts`; fixture map extended in `scripts/e2e-test.mjs` and `scripts/build-e2e-host-standalone.mjs`)
- `docs/production-closure/CHIEF_ARCHITECT_9SOURCE_CROSSWALK_2026-11-16.md` (new)
- `docs/production-closure/OWNER_ACCEPTANCE_HANDOFF_GUIDE_2026-11-16.md` (new)
- `docs/production-closure/PRE_COMMIT_CLOSURE_EVIDENCE_2026-11-16.md` (this record)
- `docs/production-closure/TEST_DEFERRALS.md` (updated by `node scripts/audit-release-tests.mjs`: `66` files with skip/deferral markers, `0` open release-critical placeholders)

---

## 2. Post-Edit Verification Results Observed

All code, Prisma schema, and vitest/Playwright edits were finalized prior to running the suites below:

| Check | Command | Scope & Exact Result |
|---|---|---|
| Full Unit & Component Suite | `npm run test:coverage` | **1,152 files / 5,757 tests passed, 0 failed, 0 skipped** (`204.88s`; Coverage `55.13%` Stmts / `58.56%` Lines) |
| Full Disposable PostgreSQL Closure | `npm run test:integration:closure:host` | **126 migrations applied cleanly; 56 files / 309 tests passed, 0 skipped** (`291.35s`; `HOST_CLOSURE_PASSED`) |
| ESLint | `npm run lint` | **0 errors** (2 pre-existing warnings in `PublicDeliveryQuoteForm.tsx` & `store-checkout-engine-proof.service.ts`) |
| TypeScript & Next Typegen | `npm run typecheck` | **0 errors** (`next typegen && tsc --noEmit`) |
| Migration Chain Safety | `npm run migrations:check` | **Passed** (`Active baseline: 20260710010000_initial_baseline; incremental migrations: 125; archived migrations: 8`) |
| CI Workflow & Browser Plan | `node --test scripts/production-certification-workflow.test.mjs scripts/phase1-browser-plan.test.mjs` | **18 passed, 0 failed, 0 skipped** |
| Release Test Placeholder Audit | `node scripts/audit-release-tests.mjs` | **`{"files":66,"openCriticalPlaceholders":0}`** |
| Production Next.js Build | `npm run build` | **Passed** (`Compiled successfully in 32.8s`, `551/551` static pages generated) |
| Filtered Chromium E2E (Host App + Disposable Docker Postgres/Redis) | `playwright test tests/e2e/checkout-saved-address-l01.spec.ts tests/e2e/marketplace-checkout-customer.spec.ts tests/e2e/anonymous-courier-quote.spec.ts --project=chromium` | **7 passed, 0 failed, 0 skipped** (`1.1m`; covers `1440px` and `390px` viewports against host `startServer` + disposable Docker Postgres/Redis with `E2E_ROUTE_PROVIDER=deterministic`, `KT_E2E_GEOCODE_FIXTURES`, `USE_HOST_COOKIE=false`) |
| Full Docker Containerized E2E Build (`npm run test:e2e`) | `npm run test:e2e -- tests/e2e/checkout-saved-address-l01.spec.ts --project=chromium` | **Blocked on local workstation Docker VM RAM limit**: host Docker Desktop VM provides `3,788,718,080` bytes (`3.53 GiB`) RAM, causing `Dockerfile` BuildKit `next build` (`--max-old-space-size=4096`) to fail with `ResourceExhausted: cannot allocate memory`, while `scripts/build-e2e-host-standalone.mjs` requires a clean committed SHA. Full containerized E2E and full Engineering Certification (`26/26` CI jobs and the full `--project=chromium` suite) must execute on GitHub Actions CI after commit. |

---

## 3. Infrastructure & Governance Notes for Commit & Release

1. **GitHub Branch Protection (`L-05`)**: Read-only check on `analyticsmath/KT-Courier` `main` observed `protected: false`. Enable branch protection on `main` requiring pull requests and passing GitHub Actions **CI** + **Engineering Certification** checks tied to the exact commit SHA before owner live switch activation.
2. **Railway Parity (`L-04`)**: Ensure `web`, `operations`, and `query-storefront-categories` deploy from the committed SHA and reconcile worker responsibility plus missing `GOOGLE_MAPS_SERVER_KEY` / `KT_OWNER_*` variables on `operations`. Keep `admin-replacement-inspection` scaled down / quarantined.
3. **Production Flags Unchanged**: Public checkout (`CHECKOUT_PUBLIC_ENABLED`), live Paystack charge switches, tax toggles (VAT OFF), and promotional/ad/promoter/recruitment/subscription/API/reporting source locks were NOT altered and remain fail-closed.
