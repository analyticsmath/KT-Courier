# Payfast deferred integration testing

`npm run test:integration:payfast` is a future consolidated-gate runner. It creates a uniquely named disposable Compose project, applies migrations, seeds, runs Phase 11 preflight, executes `vitest.payfast-integration.config.ts` serially, runs invariant verification, and removes only its own disposable volume. It refuses the canonical project name.

Tests inject deterministic Payfast-compatible sandbox values and inspect the locally constructed form. The adapter makes no network request. The Playwright job intercepts `https://sandbox.payfast.co.za/eng/process` and fulfills it locally, so normal CI never contacts Payfast.

Encoded scenarios cover preparation, exact amount, reservation/audit, exact fields, signed/post identity, same-key replay, attempt races, invalid/production configuration, wrong payer, return/cancel no-mutation reads, reserved ITN source behavior, secret absence, and ledger/wallet/order/pricing/dispatch/driver boundaries.

Do not run the integration/E2E jobs during the implementation-only phase. At the approved gate, first validate/generate Prisma and apply the migration only to the disposable environment. Then run focused tests, the disposable integration runner, invariant scripts, intercepted Chromium flow, full checks/build, and finally a separately approved real Payfast sandbox exercise with a dedicated account and public HTTPS callback environment.
