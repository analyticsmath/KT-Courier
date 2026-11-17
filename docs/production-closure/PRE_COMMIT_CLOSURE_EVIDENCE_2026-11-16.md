# KT Couriers — Reconciliation & Closure Evidence Ledger (`L-05`)

**Prepared:** 16 November 2026 (Updated with Certified Commit & Expanded Local Proofs: 17 November 2026)  
**Repository:** `analyticsmath/KT-Courier`  
**Original Audited Base HEAD:** `f913616803818e8e92b12e983dbed9c0157050ea` (code baseline `8f990a259efbe224ee6ddef907836356f70ed0b7`)  
**Committed & Certified Remote `origin/main` HEAD:** `08c375d0ab92b88d25761a481a75e8a48a216d06` (`"finalized"`)  
**Current Working Tree Scope:** `08c375d0ab92` plus 5 locally verified follow-up test/doc additions (`tests/integration/l01-l02-coverage-and-suburb.integration.test.ts`, `tests/e2e/checkout-saved-address-l01.spec.ts`, and the 3 closure docs under `docs/production-closure/`); archival baseline manifests remain untouched (`docs/phase3/final-certification.json`, `docs/final-closure/final-acceptance.json`, `docs/production-closure/engineering-gates.json`).

---

## 1. Change Inventory (`f9136168` → `08c375d0ab92` → Working Tree)

### Committed in `08c375d0ab92b88d25761a481a75e8a48a216d06` (`35` files)
- `prisma/schema.prisma`, `prisma/migrations/20261116120000_address_suburb_field/migration.sql` — additive nullable `Address.suburb` column keeping saved unit (`line2`) isolated from suburb/area.
- `lib/maps/google-maps.types.ts`, `lib/maps/address-normalizer.ts`, `lib/validation/address.ts`, `lib/validation/address-book.ts`, `lib/client-platform/contracts.ts`, `lib/dto/order.dto.ts` — canonical optional/nullable `suburb` contracts while preserving store pickup compatibility.
- `lib/marketplace-checkout/customer-checkout-prefill.ts`, `lib/services/addresses.service.ts`, `lib/services/customer-address-map-authority.ts`, `lib/services/customer-addresses.service.ts`, `lib/services/orders.service.ts`, `app/api/public/delivery-quotes/[id]/payment-methods/route.ts` — suburb persistence, stale map-pin reset on suburb mutation, explicit legacy-locality confirmation signals, and `suburb ?? line2` parcel COD locality checks.
- `components/public-v2/commerce/CheckoutExperience.tsx`, `components/account/AddressBookManager.tsx`, `components/forms/PublicDeliveryQuoteForm.tsx`, `components/maps/AddressAutocomplete.tsx` — preserved independent suburb prefill & confirmation banner in Precision White tokens, separate `#address_line2` and `#address_suburb` fields, `#pickup-suburb`/`#dropoff-suburb` forwarding, and React `useCallback` dependency closure.
- `lib/retention/privacy-retention.service.ts`, `app/api/private-media/[reference]/route.ts` — `DELETE /api/private-media/[reference]` (ownership / `PRIVATE_MEDIA_DELETE`, `RetentionHold`, and `DEPOSIT_PROOF_FINANCIAL_HOLD`), automated `PRIVATE_MEDIA` `DELETE` retention execution via `PrivateMediaService.requestDeletion`, and clearing `Address.suburb` + `formattedAddress` during `executeAccountAnonymisation`.
- `lib/governance/directive-code-coverage-register.ts`, `playwright.config.ts`, `scripts/build-e2e-host-standalone.mjs`, `scripts/disposable-closure-tests.mjs`, `scripts/e2e-test.mjs`, `docs/production-closure/TEST_DEFERRALS.md`, plus initial unit/jsdom/PG/Playwright specs (`tests/client-platform/l03-l04-whatsapp-sole-trader.test.ts`, `tests/ui/checkout-saved-address-suburb.test.ts`, `tests/marketplace-checkout/customer-checkout-prefill.test.ts`, `tests/integration/l01-l02-coverage-and-suburb.integration.test.ts`, `tests/integration/client-contract-gaps-postgres.integration.test.ts`, `tests/e2e/checkout-saved-address-l01.spec.ts`).

### Additional Working-Tree Improvements Above `08c375d0ab92` (Awaiting Follow-up Commit)
- `tests/integration/l01-l02-coverage-and-suburb.integration.test.ts` — added Jhb internal quote, route-unavailable (`503`) failure, explicit-region Gauteng denial (`409`), and admin Western Cape province rollout assertions.
- `tests/e2e/checkout-saved-address-l01.spec.ts` — added `320px` viewport coverage, zero horizontal overflow checks across `/checkout`, `/account/addresses`, and `/quote`, and `#address_line2` / `#address_suburb` field assertions.
- `docs/production-closure/CHIEF_ARCHITECT_9SOURCE_CROSSWALK_2026-11-16.md` — upgraded to the 12-column executable matrix across all 9 source documents plus Nov 5 recording / sole-trader reproduction matrix.
- `docs/production-closure/OWNER_ACCEPTANCE_HANDOFF_GUIDE_2026-11-16.md` — aligned `AC-01`..`AC-11` cleanly to `T-15` roles and `T-13` `320px/390px/1440px` checks.
- `docs/production-closure/PRE_COMMIT_CLOSURE_EVIDENCE_2026-11-16.md` — this updated evidence record.

---

## 2. Remote Certification & Deployment Parity on Exact SHA `08c375d0ab92b88d25761a481a75e8a48a216d06`

- **GitHub Engineering Certification (`26/26` jobs passed, `35m4s`):** https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308
  - `recovery`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757228529
  - `quality`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757228808
  - `browser`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757228848
  - `redis-and-recovery`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757228932
  - `postgres (test:integration:orders)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757228818
  - `postgres (test:integration:pricing)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229093
  - `postgres (test:integration:dispatch)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229100
  - `postgres (test:integration:payment-foundation)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229160
  - `postgres (test:integration:cross-module)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229167
  - `postgres (test:integration:ledger)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229170
  - `postgres (test:integration:driver-operations)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229192
  - `postgres (test:integration:auth)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229204
  - `postgres (test:integration:store-earnings)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229212
  - `postgres (test:integration:withdrawals)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229215
  - `postgres (test:integration:refunds)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229222
  - `postgres (test:integration:closure)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229263
  - `postgres (test:integration:catalog)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229290
  - `postgres (test:integration:storefront)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229293
  - `postgres (test:integration:driver-earnings)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229323
  - `postgres (test:integration:permissions)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229334
  - `postgres (test:integration:store-orders)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229341
  - `postgres (docker:gate4)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229357
  - `postgres (test:integration:marketplace-checkout)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229380
  - `postgres (docker:migration-smoke)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133757229494
  - `Phase 2 automated engineering verification (not live launch approval)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133771348075
  - `Release authorization status (informational)`: https://github.com/analyticsmath/KT-Courier/actions/runs/43998746308/job/133771473864
- **GitHub CI (`10` passed, `18` deliberately skipped, `9m11s`):** https://github.com/analyticsmath/KT-Courier/actions/runs/43998746117
- **Commit Deployment Statuses on `08c375d0ab92b88d25761a481a75e8a48a216d06`:**
  - `Vercel`: `success` (`https://www.ktcouriers.com/api/health` = `200`, `/api/ready` = `200`, `database: "reachable"`, `redis.status: "HEALTHY"`)
  - `KT Courier Production - web`: `success` (`https://web-production-9f8bb.up.railway.app/api/health` = `200`)
  - `KT Courier Production - operations`: `success`
  - `KT Courier Production - query-storefront-categories`: `success`

---

## 3. Local Post-Edit Verification Results Observed on Current Working Tree

All application code, Prisma schema, and vitest/Playwright test edits were finalized prior to running the suites below:

| Check | Command | Scope & Exact Result |
|---|---|---|
| Full Disposable PostgreSQL Closure | `npm run test:integration:closure:host` | **126 migrations applied cleanly; 56 files / 309 tests passed, 0 failed, 0 skipped** (`137.17s`; `HOST_CLOSURE_PASSED`) |
| Full Unit & Component Suite | `npm run test:coverage` | **1,152 files / 5,757 tests passed, 0 failed, 0 skipped** (`151.93s`; Coverage `55.13%` Stmts / `58.56%` Lines) |
| Filtered Chromium E2E (Host Server + Disposable Docker Postgres/Redis) | `playwright test tests/e2e/checkout-saved-address-l01.spec.ts tests/e2e/vendor-onboarding-v005-v008.spec.ts tests/e2e/marketplace-checkout-customer.spec.ts tests/e2e/anonymous-courier-quote.spec.ts --project=chromium` | **10 passed, 0 failed, 0 skipped** (`1.3m`; covers `1440px`, `390px`, `320px`, zero horizontal overflow, `/account/addresses`, `/checkout`, `/quote`, and `V-005..V-008` sole-trader onboarding/media upload/certification with `E2E_ROUTE_PROVIDER=deterministic`, `KT_E2E_GEOCODE_FIXTURES`, `USE_HOST_COOKIE=false`) |
| ESLint | `npm run lint` | **0 errors** (2 pre-existing warnings in `PublicDeliveryQuoteForm.tsx` & `store-checkout-engine-proof.service.ts`) |
| TypeScript & Next Typegen | `npm run typecheck` | **0 errors** (`next typegen && tsc --noEmit`) |
| Migration Chain Safety | `npm run migrations:check` | **Passed** (`Active baseline: 20260710010000_initial_baseline; incremental migrations: 125; archived migrations: 8`) |
| CI Workflow & Browser Plan | `node --test scripts/production-certification-workflow.test.mjs scripts/phase1-browser-plan.test.mjs` | **18 passed, 0 failed, 0 skipped** |
| Release Test Placeholder Audit | `node scripts/audit-release-tests.mjs` | **`{"files":66,"openCriticalPlaceholders":0}`** |
| Production Next.js Build | `$env:KT_NEXT_BUILD_CPUS="2"; npm run build` | **Passed** (`Compiled successfully in 17.3s`, TypeScript `16.1s`, `551/551` static pages generated in `3.4s`; note: unconstrained 11-worker default hit local Windows virtual commit limit before `KT_NEXT_BUILD_CPUS=2`, and Next.js `16.4.2` emitted a security vulnerability upgrade advisory once on first run) |
| Full Docker Containerized E2E Build (`npm run test:e2e`) | `npm run test:e2e -- tests/e2e/checkout-saved-address-l01.spec.ts --project=chromium` | **Blocked on local workstation Docker VM RAM limit**: host Docker Desktop VM provides `3,788,718,080` bytes (`3.53 GiB`) RAM, causing `Dockerfile` BuildKit `next build` to fail with `cannot allocate memory` at both `4096 MB` and `2560 MB` heap caps; remotely verified in CI Linux runner under `browser` (`43998746308`). |

---

## 4. Remaining Actions Outside Code Scope

1. **Commit & Push the 5 Follow-up Test/Doc Additions** (or merge via PR) if you want `tests/integration/l01-l02-coverage-and-suburb.integration.test.ts`, `tests/e2e/checkout-saved-address-l01.spec.ts`, and the 3 updated markdown documents synchronized to `origin/main` (triggering a fresh certification run on the new SHA).
2. **GitHub Branch Protection (`L-05`)**: Enable branch protection on `main` (`protected: false` observed) requiring pull requests and passing **CI** + **Engineering Certification** checks.
3. **Railway Parity (`L-04`)**: Reconcile worker responsibility between `operations` and `query-storefront-categories` and align missing `GOOGLE_MAPS_SERVER_KEY` / `KT_OWNER_*` variables on `operations`. Keep `admin-replacement-inspection` scaled down / quarantined.
4. **Coverage Policy Decision (`L-02`)** & **Controlled Owner Acceptance (`T-15`)**: Confirm intended region policy (`gauteng-province-wide` vs explicit city/radius `regionIds`) and run `AC-01`..`AC-11` using owner-managed test personas (`CHECKOUT_PUBLIC_ENABLED` and VAT switches remain OFF until approved).
5. **Next.js Security Advisory**: During `npm run build` (`16.4.2`), Next.js reported a known security vulnerability advisory (`next upgrade --agent=security ...`), held pending owner authorization.
