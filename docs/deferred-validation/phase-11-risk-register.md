# Phase 11 Payfast deferred-validation risk register

Phase 11 is implementation complete with deep validation deferred. Phase 10 deferred risks remain open and are carried forward.

| Area | Deferred proof | Risk / likely correction surface |
|---|---|---|
| Migration | Clean bootstrap, after-Phase-10 deployment, enum/index/check/trigger behavior, historical nullable rows | PostgreSQL and generated-client alignment may require correction in Phase 11 migration/schema/types |
| Prisma | Validation, generation, drift, full typecheck | New attempt enums/fields are not generated in this workflow |
| Signature | Official sandbox acceptance and independent provider sample comparison | Order/passphrase/MD5 behavior may reveal provider-specific edge cases |
| Encoding | Sandbox acceptance for Unicode and every special-character vector | PHP `urlencode` byte compatibility remains provider-unproven |
| Configuration | Dedicated sandbox credentials, passphrase, public HTTPS origin | Runtime readiness and credential policy need deployment proof |
| Form action | Real browser POST to sandbox and provider field acceptance | Hidden field serialization/hydration/browser behavior remains unexecuted |
| Return/cancel | Auth, no-store headers, polling, no mutation in Chromium | Page/runtime behavior is code-only until E2E |
| Concurrency | Same/different key races, counter/public-ref uniqueness, crash windows | Serializable/unique winner behavior needs live PostgreSQL |
| Secrets | Server/client bundle, DOM, logs, traces, snapshots, database/static scan | Merchant Key/signature are protocol-required hidden fields; containment needs deep review |
| Production lock | Runtime configuration and all initiation/resume paths | Code/source tests exist; deployment E2E is deferred |
| Cross-module | No ledger/wallet/order/pricing/dispatch/driver effect | Source and integration scenarios exist but live invariants are deferred |
| Docker/build | Disposable runner, image, Next.js compile and runtime headers | No Docker/build command was run |
| E2E | Intercepted Chromium auto/manual form handoff and ownership | Browser was not installed or executed |
| Real sandbox | Dedicated account, actual checkout, return and externally reachable callback | No Payfast request or real-money-like flow was attempted |
| ITN / Phase 12 | Signature/source/amount verification, replay, confirmation, reconciliation | Explicitly absent; blocks production and authoritative outcomes |

No deferred item authorizes production activation, ITN processing, success inference, ledger posting, wallet/order mutation, or a migration against shared data.
