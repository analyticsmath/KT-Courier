# Integrated exact-source test evidence

## Candidate and execution boundary

All code test results below refer to the frozen integration source commit `6eed666775a30db5e7e4a70208c418072b76053b` on `integration/codex-phase1-phase2-2026-10-11`. The integration merge itself adds no application, schema, migration or domain-service source delta. The evidence JSON alongside this report records the exact observed counts; no later documentation commit is represented as tested application code.

Sanitized copies of the PostgreSQL, recovery, Paystack, targeted-browser and directed-browser JSON outputs are checked in under `test-receipts/`. The integration attestation points to those durable copies. No hosted run or GitHub artifact link exists for the integration SHA.

The persistence, Redis, recovery and browser work used the repository's disposable Compose runners with unique project/database namespaces as applicable. Browser runs created a disposable PostgreSQL database and Redis service; host-published DB and browser ingress ports were bound to `127.0.0.1`. The E2E application ran on an internal network with `KT_E2E_NETWORK_INTERNAL=true`; the harness checked that app-container egress to literal `1.1.1.1:443` was blocked before starting a browser. It used a dummy `sk_test_...` fixture, Paystack test mode, console email, deterministic route/geocode fixtures, and `KT_NETWORK_DISABLED=true`. Disposable databases and generated Compose resources were removed by the harness. Production DB/Redis, provider credentials, Cloudinary, protected production rows and customer communications were not accessed.

The default containerized Next production build exceeded this host's available build memory with heap limits of 4,096, 2,048 and 1,024 MB. To run the unchanged repository E2E runner safely, the exact-source Next standalone output was built successfully on the host, copied to a temporary Docker build context based on the disposable migrator/dependency image, and used only for the app container. Test orchestration, PostgreSQL migration/fixtures, Redis, internal networking, outbound probe and browser assertions remained the repository's existing harness. The temporary `compose.e2e.yml` override was restored byte-for-byte after the run. `compose.dev.yml`, the strict BOLA runner and recovery runner were also restored; `git diff --exit-code` verified no temporary runner/config modifications remain.

The Compose builds replaced local-only Docker tags `kt-couriers-app:latest` and `kt-couriers-migrate:latest` with test images. They were not pushed. The original image objects referenced by pre-existing containers were no longer present in the local image store and were not retagged; pre-existing containers were left running and untouched. This local Docker image-tag change is the only known environment-side residue.

## Quality and DB-free suites

| Check | Result on candidate | Evidence / detail |
|---|---|---|
| `npm ci` | PASS | Lockfile install completed. |
| `npx prisma generate`; `npx prisma validate`; `npm run migrations:check` | PASS | Client generated, schema valid, baseline plus 79 forward migrations passed safety checks; 8 archived migrations remain classified. |
| `npm run lint` | PASS | No lint errors. |
| `npx next typegen` then `npm run typecheck` | PASS | Generated route types first, then strict TypeScript check passed. |
| `npm run build` | PASS | Exact candidate host build completed; 521 static routes generated. Also completed with `NEXT_PUBLIC_E2E_DETERMINISTIC_COORDINATES=true`, `KT_NEXT_BUILD_CPUS=1`, heap 4,096 MB. |
| Full DB-free Vitest at original 15s/10s timeouts | PASS | 792 files, 3,734 passed, 0 failed, 0 skipped/todo. No Phase 2 timeout increase is retained. |
| `npm run test:coverage` | PASS | Statements 49.60%, branches 43.92%, functions 50.53%, lines 53.22%. |
| Focused payment/security/policy suites | PASS | Paystack contract 24, invariants 23, payments 343, refunds 115, unit BOLA 23, processors 23; all passed. |
| `npm audit --omit=dev --audit-level=high` | PASS | Zero production dependency vulnerabilities. |
| Full `npm audit --audit-level=high` | FAIL / known dev-tree finding | Five high advisories in the `braces@3.0.3 → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next@16.3.8` development chain. No forced major downgrade was applied. |
| Gate 4 static preflight | PASS (static only) | 11/11 required files, zero skip markers, 13 fixture scenarios. DB runtime was not granted because its database URL was the intentional invalid loopback port-1 placeholder. |

## Disposable persistence, security and recovery

| Selection | Result | Exact evidence |
|---|---|---|
| `npm run test:integration:closure` | PASS | 178/178 PostgreSQL-backed tests, no failures/skips/todos; `test-receipts/postgres.json` (56 Vitest suite records). Safe loopback DB ingress plus internal app network; test/provider traffic disabled. |
| Strict PostgreSQL BOLA matrix | PASS | 10/10 role/tenant object-authorization cases. Temporary IPv4-only loopback ingress and runner host adjustment were restored; no BOLA test assertions or source changed. |
| `npm run test:integration:redis-rate-limit` | PASS | 7/7 against a disposable Redis service; strict network isolation retained. |
| `npm run test:integration:migration-upgrade` | PASS | 62 historic migration proofs and 18 forward migrations (80 total); schema status up to date. Confirmed the historical trigger rejects status mutation before the Phase 1 change and still rejects commercial price mutation afterward. |
| `npm run recovery:drill` | PASS | Disposable dump/restore and historical upgrade passed; fixture row counts and hashes matched; ledger invariants passed; `protectedProductionDataTouched=false` in `test-receipts/recovery.json`. This is not a production RTO or backup certification. |
| `npm run test:e2e -- --project=chromium --phase2-canonical` | PASS | 41/41 canonical PostgreSQL cases across 19 test files, zero failures/pending/todo, 989.26 seconds; `test-receipts/phase2-canonical-vitest.json`. |
| Canonical Paystack DB/browser acceptance | PASS | Disposable identity probe emitted `PAYSTACK_POSTGRES_IDENTITY_VERIFIED`; real PostgreSQL signed-intake/Verify selection 2/2 and browser selection 9/9. Receipts: `paystack-postgres-receipt.json` and `paystack-postgres-vitest.json`. No live provider call. |

## Browser acceptance and execution limitation

The dedicated Phase 2/3 selection defined in `.github/workflows/production-certification.yml` uses 18 spec-file arguments and resolves to 42 tests across 13 Playwright test source files. Its first exact-selection invocation reached the harness's fixed 15-minute Playwright timeout after 24 passing results were emitted; there were no reported assertion failures, but the final count report was not flushed. We then ran the same complete file selection without exclusions in seven fresh invocations, still through `scripts/certification-command.mjs` and the repository's disposable E2E harness. All seven exact-SHA receipts pass, with one worker, zero retries, zero failures, zero skips and zero flaky tests:

| Batch | Test files | Passed | Duration |
|---:|---|---:|---:|
| 1 | anonymous quote, catalog inventory upload, COD custody/remittance, customer identity | 8/8 | 282.98 s |
| 2 | customer wallet/refunds, driver canonical delivery | 4/4 | 537.82 s |
| 3 | customer/store/driver avatar lifecycle, refund finance admin | 8/8 | 407.28 s |
| 4 | store branding, store-order accessibility | 6/6 | 358.44 s |
| 5 | store-order admin, customer, handoff | 6/6 | 438.73 s |
| 6 | store-order merchant, positive substitution, substitution | 6/6 | 492.11 s |
| 7 | transactional notifications, trusted parcel classification | 4/4 | 372.84 s |
| **Total** | **All 18 workflow file arguments / 13 Playwright source files** | **42/42** | **2,890.21 s summed across sequential runs** |

Each receipt is `test-receipts/test-e2e-phase2-3-directed-batch-NN.json`; all record code SHA `6eed666775a30db5e7e4a70208c418072b76053b`. `test-e2e.json` is the last batch's ordinary wrapper output, not a fabricated aggregate. The machine attestation computes the 42-case aggregate only from the seven verified receipts.

The seven-stage Phase 1 browser plan selected 139 Chromium cases. Its six targeted stages passed: storefront variant 1/1, product detail 4/4, catalog 1440px 2/2, catalog both widths 4/4, employee 1440px 1/1, employee both widths 2/2; each had zero skips/flaky results. The plan's single full Chromium process reached its configured 20-minute wrapper timeout after printing passing output for the first 84 cases, before Playwright flushed its JSON report. The stage report therefore records `FAIL` with null final counts, correctly reflecting a timeout rather than a complete single-process pass. The 55 remaining discovered tests were then executed through four fresh invocations of the same guarded E2E harness (14, 10, 15 and 16 cases); all four returned pass, with zero failures/skips/flaky. Thus all 139 selected test cases emitted passing results across the initial run and bounded remainder runs, while the official single-process stage remains timed out/incomplete. Do not read this as a clean `full-chromium` stage artifact.

Selected browser journeys included guest quote ownership and authenticated booking resume, customer identity and wallet/refund views, trusted parcel classification, marketplace/store checkout, inventory CSV replay, employee RBAC, private avatar/media lifecycle, store order/handoff/substitution, synthetic driver delivery/POD/location and COD custody/remittance, Paystack signature/Verify mismatch cases, and responsive 1440/390 layouts. Responsive browser assertions are not human visual, 320/768/200%-zoom, screen-reader, physical-device or real GPS/camera acceptance.

## Exact-source and hosted-CI limits

All local results are bound to code SHA `6eed666775a30db5e7e4a70208c418072b76053b`. The documentation commit that records them is not a new application candidate and should not be substituted for a future source change without rerunning the affected gates. No hosted workflow was run on this integration SHA. No branch was pushed and no draft PR was opened because `vercel.json` forwards every route to the production Railway origin, so an automatically created preview cannot be proven isolated. Phase 1's GitHub runs remain prior-SHA evidence only.

The `engineering-gates.json` statuses remain unchanged. Client tariffs/coverage/COD/commission, notification templates and provider acceptance, full marketplace/driver/operator acceptance, human visual/accessibility/device review, actual Cloudinary, sanitized real legacy extract, protected production-row review, hosted exact-source CI, preview isolation and deployment approvals remain open or externally blocked as detailed in the gate and handoff records.
