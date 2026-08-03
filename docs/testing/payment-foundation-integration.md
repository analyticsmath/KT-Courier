# Payment foundation integration testing

The deferred command is:

```text
npm run test:integration:payment-foundation
```

The runner creates a uniquely named `kt-couriers-phase10-payment-disposable-*` Compose project, chooses a process-specific database/port, refuses the canonical project name, migrates and seeds twice, runs payment preflight, runs only `vitest.payment-foundation-integration.config.ts`, verifies invariants, and removes only that disposable project/volume in `finally`.

The suite encodes exact order amount preparation, same-key concurrency/conflict, attempt reservation and stable merchant references, requires-action, processing, definite failure, timeout UNKNOWN, malformed response, same-key provider replay, retry race, rollback, immutable history/identity boundaries, and absence of ledger/order/webhook/refund effects. The fake adapter is injected, deterministic, and network-free.

Admin browser coverage is in `tests/e2e/payment-foundation-admin.spec.ts` under the grep title `read-only payment foundation admin`. It creates test-only zero-state records, verifies exact headings/tables, filters, ZAR, pagination, attempts/history, PayFast readiness, explicit DENY, role denial, absence of mutation controls and visible secret material. It is not part of the implementation-only checks.

Do not point the runner at a retained/canonical database. Do not remove the unique-name assertion or replace its cleanup with a broad Compose/database deletion.

