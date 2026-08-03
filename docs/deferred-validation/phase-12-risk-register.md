# Phase 12 Deferred Validation Risk Register

Status: `CORRECTION COMPLETE — DEEP VALIDATION DEFERRED`.

| Area | Deferred proof | Risk until proved |
|---|---|---|
| Migration | Clean bootstrap, canonical-chain deployment, placeholder-row blocker, null-only legacy compatibility constraint, and rollback plan | SQL ordering, enum/trigger/index behavior, legacy-column compatibility, or existing-data incompatibility may surface only in PostgreSQL |
| Prisma | Generate, schema drift, typecheck | Generated client and new relation/query types are unproved |
| Production build | Next.js production compilation and route packaging | Runtime/module boundary issues are unproved |
| Raw-body handling | Actual Next.js Node Route Handler streaming, content length, timeout, UTF-8 | Framework/runtime stream behavior may differ from pure Request tests |
| Reverse proxy | Real header deletion/rewrite, single hop, direct-access prevention | Client spoofing is possible if deployment violates the contract |
| Source IP | Current official Payfast hostname set, A/AAAA, TTL and actual delivery sources | Legitimate delivery may retry or an incorrect official-host assumption may reject |
| Signature | Official sandbox ITN variables, encoder and passphrase compatibility | Pure fixed vectors do not prove provider compatibility |
| Amount | Live Payfast gross/fee/net formatting | Provider formatting could reveal an unsupported but valid representation |
| Server confirmation | Real TLS, redirect, canonical ordered confirmation body, timeout and `VALID` response | Mocked fetch does not prove query-validation compatibility or official canonical-body acceptance |
| Concurrency | Duplicate, conflict, serialization and deadlock tests in live PostgreSQL | Exact-once behavior is designed but not live-proved |
| Ledger atomicity | Live rollback after journal/entries and projection locks | Transaction-double tests cannot prove PostgreSQL rollback/projection behavior |
| Credential rotation | Operational nonterminal-attempt drain and monitoring procedure | Rotation could strand attempts in reconciliation |
| Public callback | Reachable HTTPS route, no redirect, correct proxy source | Payfast delivery cannot be assumed until deployed |
| Security | Logs/traces/bundles/database inspection, abuse/load tests | Secret/raw-evidence absence and rate bounds need runtime proof |
| Production lock | Deployed fail-closed readiness and code-gate proof | Misdeployment must not bypass inactive production configuration |
| E2E | Customer/admin Chromium flows, permissions, accessibility and secret safety | UI behavior is scaffolding only |
| Cross-module | Live no-order/dispatch/driver/pricing mutation proof | Source audits are not a database execution proof |
| CI | Deferred jobs on clean runners | Runner/container/environment assumptions are unproved |

## Carried Phase 10 risks

Clean migration deployment, Prisma generation/typecheck/build, live idempotency and serializable races, immutable history/trigger behavior, permission enforcement, admin/customer E2E, and cross-module payment/order boundaries remain unresolved until the consolidated run.

## Carried Phase 11 risks

Official Payfast checkout signature/form compatibility, sandbox form handoff, HTTPS callback URLs, Merchant credentials, production lock behavior, credential rotation, return/cancel non-authority, browser secret safety, and real provider interaction remain unresolved. Phase 12 does not weaken or claim closure of those risks.

## Exit criteria

Close risks only with recorded commands/results from an architect-authorized disposable environment, official Payfast sandbox evidence, reviewed reverse-proxy configuration, database invariant output, production build, and controlled browser run. Production activation still requires a reviewed code change to the consolidated approval constant.
