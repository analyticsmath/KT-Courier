# KT Couriers Phase 15 Implementation Report

## 1. Executive Summary

IMPLEMENTATION COMPLETE — DEEP VALIDATION DEFERRED

Phase 15 now contains the implementation-only customer-wallet liability, refund reservation/release/completion architecture, cumulative commission clawback, provider-neutral execution, fail-closed Payfast protocol layer, reconciliation, permissions, APIs, UI, scripts, focused tests, deferred PostgreSQL/E2E scaffolding, and risk documentation. Production refund mutation and Payfast networking remain source-locked.

## 2. Prior-Defect Prevention

| Defect pattern | Phase 15 prevention | Files |
|---|---|---|
| Schema/DTO drift | Dedicated enums/models, DB exports, domain types, strict validators and safe DTO mappers were propagated together. | `prisma/schema.prisma`, `types/db.ts`, `lib/refunds/types.ts`, `lib/validation/refunds.ts`, `lib/dto/refund.dto.ts` |
| Split ledger/state commit | Transaction-aware posting receives the same Prisma transaction as refund/projection/history writes. | `refund-request.service.ts`, `refund-wallet-completion.service.ts`, `refund-provider-execution.service.ts` |
| Over-refund | Payment row locks, Decimal recalculation, exact projections, optimistic update and DB checks/triggers. | `refundable-amount.ts`, request service, migration, invariant script |
| Duplicate provider refund | Per-provider unique ID, pre-finalization conflict lookup, recovery conflict case. | schema, migration, provider execution service |
| Floating-point money | LedgerMoney/Prisma.Decimal and string DTOs only. | money, funding, commission, dashboard policies |
| Partial-refund rounding drift | Cumulative half-up target and current delta; final refund takes exact original cents. | `refund-commission-adjustment.ts` |
| Current-policy recalculation | Only persisted Phase 14 accrual/allocation amounts and account IDs are read. | request service, commission policy |
| Released commission clawback | Locked/reread allocation state and DB insert guard block downstream-released allocations. | request service, migration |
| Network inside transaction | Attempt reservation, external call and finalization are separate stages. | provider execution/reconciliation services |
| Raw banking data | No banking fields; note sanitizer, source audits and scripts detect prohibited fields/data. | note policy, Payfast modules, tests, scripts |
| Provider-fee deduction | Four exact journal policies contain no fee line and invariant audit rejects one. | ledger policy, migration, invariant script |
| Browser/admin success authority | No arbitrary transition or mark-success route/control; provider success uses the normal finalizer. | admin routes/UI, provider finalizer |
| Inaccurate reporting | Only actually run lightweight checks are recorded below; all deep validation is explicitly deferred. | this report, risk register |

## 3. Existing Refund Architecture Audit

The implementation map found one Phase 4 `PaymentRefund` placeholder: Decimal(12,2), string currency/reason/provider reference, `PaymentStatus`, metadata and optional creator. There was no runtime writer, seed record, or refund fixture. Phase 15 evolves it in place and does not create a duplicate aggregate. Unsupported pre-existing rows make the migration fail closed. Legacy physical values are renamed, retained, mapped and ignored by operational Prisma contracts.

## 4. Final Refund Architecture

`PaymentRefund` is the aggregate; `RefundExecutionAttempt` holds provider attempt identity/evidence; `RefundFundingAllocation` preserves exact reservation sources; `RefundStatusHistory` is immutable lifecycle evidence; `RefundReconciliationCase` records idempotent safe observations. Journal links and Payment projections connect aggregate state to immutable accounting.

## 5. Customer Wallet Architecture

Customer wallets receive `CUSTOMER_WALLET_AVAILABLE` and `CUSTOMER_REFUND_HELD`, both active non-negative ZAR liabilities. Provisioning uses the existing idempotent wallet/account winner-reread primitives and zero defaults. Reads use ledger account balances/entries and exact strings. Spending, transfers, withdrawal, top-up and manual adjustment are absent.

## 6. Refund Eligibility

Eligibility checks active customer ownership; `SUCCEEDED` payment; ZAR gross; successful attempt, verified webhook and success journal; remaining exact amount; incompatible active outcomes; method/reason support; safe original allocations; held/wallet account evidence; and provider reference/capability for original-method refunds. Order UI/browser return is never evidence.

## 7. Refund State Machine

Implemented transitions exactly match the required matrix. REQUESTED through reconciliation states retain reservation; REJECTED/CANCELLED require release; SUCCEEDED requires completion. SUCCEEDED, REJECTED and CANCELLED are terminal.

## 8. Refund Attempt State Machine

RESERVED moves only to PROCESSING. PROCESSING resolves to SUCCEEDED, FAILED or UNKNOWN. UNKNOWN may return through provider-query evidence to PROCESSING/SUCCEEDED/FAILED. Attempt numbering is allocated under refund lock; terminal attempts cannot restart.

## 9. Refund Funding Plan

`CUSTOMER_FUNDS_HELD` represents the residual customer-funds liability. `PLATFORM_COMMISSION_REVENUE` reverses original platform commission. `BENEFICIARY_COMMISSION_PAYABLE` reverses an unreleased payable. Positive ZAR funding rows link exact accounts and optional original accrual/allocation, and their sum equals the refund.

## 10. Commission Adjustment

For each original allocation the implementation calculates the cumulative half-up target, subtracts prior active adjustment, omits zero delta, and caps the result to remaining original allocation. The final full cumulative refund uses the exact original amount. Released/downstream-linked allocations block reservation and require reconciliation.

## 11. Reservation Journal

`REFUND_RESERVE` debits every exact funding source and credits customer refund-held for the requested amount. Identity/idempotency are `refund:<reference>:reserve` and `...:reserve:v1`. Metadata contains only safe references/method/reason.

## 12. Release Journal

`REFUND_RELEASE` debits refund-held and credits the exact stored funding rows. Cancellation/rejection never recalculate policy. A unique release link, immutable allocations and DB journal evidence prevent a second or altered release.

## 13. Wallet Credit Journal

`REFUND_WALLET_CREDIT` debits refund-held and credits wallet-available. This is liability reclassification: no cash movement, revenue recognition, payment status or order status change.

## 14. External Refund Journal

`REFUND_EXTERNAL_PAYOUT` debits refund-held and credits platform cash clearing after authoritative provider success and locked cash sufficiency. No provider/bank/refund fee is posted or deducted.

## 15. Refund Request Transaction

After bounded input/preflight hashing, a Serializable transaction resolves replay, locks Payment, verifies projection evidence, recalculates remaining, locks/rereads original commission rows, computes deltas, locks sorted accounts, posts reserve, creates aggregate/funding evidence, updates the reserved projection and appends history. A failure rolls back every write and operation-key consumption.

## 16. Cancellation and Rejection

Both paths lock Refund then Payment and sorted accounts, resolve operation replay, ensure REQUESTED/UNDER_REVIEW, validate held/funding evidence, post the exact inverse, decrement reserved projection, record actor/time/status and append immutable transition plus release history.

## 17. Approval and Dual Control

Review and approval lock refund/payment evidence and move no money. The customer cannot review/approve/reject administratively. Completion requires a processor different from both customer and approver; SUPER_ADMIN has no bypass.

## 18. Provider Refund Orchestration

A short Serializable stage creates RESERVED then PROCESSING evidence. The bounded adapter call occurs without DB locks. A second Serializable transaction locks Refund, Attempt, Payment and accounts to finalize success, failure, processing or unknown atomically. There is no blind retry.

## 19. Payfast Refund Adapter

The create architecture pins `POST https://api.payfast.co.za/refunds/<pf_payment_id>`, rejects redirects, applies orchestration timeout, normalizes safe evidence and supports deterministic injected transport only. Sandbox and production network execution are inactive. Query capabilities remain false because authoritative path/status semantics were not repository-visible.

## 20. Payfast API Authentication

Headers are `merchant-id`, `version: v1`, one reused ISO timestamp and lowercase MD5 signature. Header/query/body/passphrase fields are validated, combined, alphabetically sorted and PHP-compatible URL encoded. Checkout/ITN signers are not reused; secrets/signature bases are not stored or logged.

## 21. Payfast Refund Amount

Exact Decimal validation is implemented, but the protocol unit is deliberately `UNRESOLVED`. Repository-visible material did not prove rands, cents or integer minor units. Production serialization throws; deterministic tests may inject an explicit serializer. Authoritative Payfast protocol evidence is required before activation.

## 22. Idempotency and Concurrency

Creation and attempt keys bind canonical SHA-256 request hashes. Transition operation IDs bind immutable history. Matching replays return existing evidence; changed payloads conflict. Payment/refund/attempt/allocation/account locks, optimistic versions, unique keys and deferred projection checks prevent cumulative and concurrent over-refund.

## 23. Unknown Outcomes

Timeout, network ambiguity, malformed/unreviewed provider semantics, post-success application failure, provider-ID conflict and insufficient cash preserve held funds, set UNKNOWN/reconciliation evidence, and open a case. They do not retry, release, wallet-credit, or reduce cash again.

## 24. Reconciliation

Cases cover every required reason and use OPEN/MONITORING/RESOLVED/CLOSED. The service queries a reviewed provider outside transactions, resolves through the normal finalizer, and scans stale attempts, projection mismatches, journal/funding mismatch and commission mismatch. The standalone scanner observes stale/unknown attempts. No manual success bypass exists.

## 25. Production Activation

`REFUND_PRODUCTION_VALIDATION_APPROVED = false` is a source constant with no environment bypass. Customer creation, wallet/external completion and provider query/create execution are blocked by default. Payfast additionally reports its own inactive production-validation state.

## 26. Permissions

Added `customer_wallets.read`, `refunds.read`, `refunds.review`, `refunds.approve`, `refunds.process`, `refunds.reconcile`, `refund_provider_status.read`, and `finance_refunds.read`. Explicit user DENY is checked before SUPER_ADMIN behavior in refund API/page helpers. Maker-checker remains service-level and cannot be permission-bypassed.

## 27. Customer APIs

| Endpoint | Contract |
|---|---|
| `GET /api/customer-wallet` | Active customer, owner-safe exact balances |
| `GET /api/customer-wallet/transactions` | Active customer, strict paging, journal-backed DTO |
| `GET /api/refunds` | Active customer, strict filters, owned list |
| `POST /api/refunds` | Same-origin/rate/body/schema/operation controls; production locked |
| `GET /api/refunds/[publicReference]` | Awaited params and owner-scoped detail |
| `POST /api/refunds/[publicReference]/cancel` | Same-origin/rate/strict operation and exact release |

## 28. Finance APIs

| Endpoint | Permission/purpose |
|---|---|
| `GET /api/admin/refunds` | `refunds.read` list |
| `GET /api/admin/refunds/[id]` | `refunds.read` safe evidence detail |
| `POST .../review` | `refunds.review` |
| `POST .../approve` | `refunds.approve` |
| `POST .../reject` | `refunds.review` and release |
| `POST .../complete-wallet` | `refunds.process` |
| `POST .../start-provider-refund` | `refunds.process` |
| `POST .../query-provider-status` | `refund_provider_status.read` plus reconciliation control |
| `GET /api/admin/refund-reconciliation` | `refunds.reconcile` list |
| `GET /api/admin/refund-reconciliation/[id]` | `refunds.reconcile` detail |

All mutations share authentication, explicit DENY, same-origin, strict JSON/body limit, rate limit, operation ID and safe error handling. There is no DELETE, arbitrary-state or mark-success route.

## 29. Customer UI

`/account/wallet`, wallet transactions, `/account/refunds`, and refund detail show exact headings, ZAR strings, payment/refund references, method/reason/status/progress/cancellation and lock explanation. Internal account IDs, commission details, provider secrets and hashes are excluded. Wallet spending is not implemented.

## 30. Finance UI

Refund and reconciliation list/detail pages expose safe identity, amount/remaining value, funding, original commission references, journal references, attempts, actors and cases. Controls are permission-aware and production-locked. There is no amount/account editor, banking/credential input or mark-success button.

## 31. Finance Dashboard

Exact metrics include wallet/refund-held liabilities; requested, approved and processing counts/amounts; successful wallet/external totals; current UTC-month refunded amount; open cases; oldest pending; commission clawbacks; and remaining refundable liabilities. Decimal aggregation is used throughout.

## 32. Prisma Schema

Added refund method/status/reason/funding/attempt/failure/history/reconciliation enums; evolved PaymentRefund; added allocation, attempt, history and case models; Payment projections; User/Ledger/Commission relations; customer account purposes and four journal types. Prisma expresses uniqueness/relations/indexes; migration checks/triggers protect financial shape and immutability.

## 33. Migration

Prepared `prisma/migrations/20260717070000_phase15_customer_wallet_refunds/migration.sql`. It was not executed. It fails closed on placeholder rows, retains/renames legacy fields, adds columns before indexes/relations, and creates amount/state/journal/projection/commission checks plus immutable/delete guards. No prior migration was edited.

## 34. Seed

The existing idempotent permission-definition loop now includes all Phase 15 permissions. Account purposes are schema values provisioned explicitly for active customers; no wallet balance, refund, attempt, completed journal, provider ID, reconciliation resolution or Payfast credential is seeded.

## 35. Scripts and Invariants

`phase15-refund-preflight.mjs` checks placeholder rows/fields, success evidence, ZAR, duplicates, over-refund, journals, downstream releases, wallet conflicts, provider activity and banking data. `verify-refund-invariants.mjs` checks all required amount/projection/journal/funding/commission/direction/no-mutation/no-fee/no-banking/duplicate/unknown/lock invariants. `scan-refund-reconciliation.mjs` observes stale/unknown attempts. `refund-integration-test.mjs` owns a uniquely named disposable Compose project and deterministic provider environment. None was executed.

## 36. Unit and Policy Tests Written

| Group | Files/coverage |
|---|---|
| State | refund and attempt full transition matrices |
| Eligibility/money | evidence, ownership, exact parsing, remaining/one-cent over-refund |
| Funding/commission | residual funding, platform/beneficiary deltas, cumulative/final rounding, released block |
| Ledger | reserve/release/wallet/external directions and no fee |
| Control | idempotency hash, dual control, reconciliation, wallet canonical shape, production lock |
| Source/UI | no order/payment/balance/fee mutation; headings/privacy/no forbidden controls |

All 16 required files are present. Only the four focused files listed in section 43 were executed.

## 37. Payfast Tests Written

| File area | Coverage |
|---|---|
| Config/signature | pinned host, inactive sandbox/network, exact headers/timestamp/sort/passphrase/encoding/fixed vector |
| Amount/request | unresolved-unit fail-close, exact injected vectors, full/partial body, bounded safe fields |
| Response/adapter/query | safe parsing/raw exclusion, redirect/abort boundary, deterministic transport, UNKNOWN query |
| Source audit | no banking fields, arbitrary host, direct network client or checkout/ITN signer reuse |

All eight required Payfast files are present; only the signature test was included in the focused execution.

## 38. Service Tests Written

Eight required service files plus a reusable complete transaction surface cover Payment/Refund/Attempt/Commission/Account locks, journal/entry writes, projections, funding, history, reconciliation, winner reread, commit and rollback observability. Tests assert the canonical source transaction boundaries; they were not executed in this pass.

## 39. API Tests Written

All 12 required API files cover auth/ownership, exact permissions and DENY-aware helpers, same-origin/rate/body/schema/operation controls, string money, strict rejection of accounting/provider input, awaited params, safe DTOs and absence of DELETE/arbitrary success authority. They were not executed.

## 40. PostgreSQL Integration Scenarios Written

| Scenario family | Encoded invariants |
|---|---|
| Request/concurrency | full, partial, multiple, final cents, one-cent over, concurrent cap, replay/conflict |
| Commission/release | platform, beneficiary, final exact, downstream block, cancellation, rejection |
| Completion | wallet reclassification, rollback, maker-checker |
| Provider | success, definite failure, unknown, query, duplicate success/ID, cash insufficiency, post-success failure |
| Cross-module/security | immutable evidence, no payment/order mutation, no fee, no banking, production lock |

All seven required deferred files/config are present and were not run.

## 41. E2E Scenarios Written

Customer scaffolding covers exact Wallet/Refunds headings, balances/history, full/partial validation, production lock, cancellation/status and privacy. Finance scaffolding covers Refunds, review/approval/separate processor, provider fixture/unknown reconciliation, funding, DENY and forbidden controls. Both specs are deferred/skipped and were not executed.

## 42. Files Changed

| Area | Files and purpose |
|---|---|
| Map/schema/migration | `docs/phase-15-implementation-map.md`; `prisma/schema.prisma`; `prisma/migrations/20260717070000_phase15_customer_wallet_refunds/migration.sql`; `types/db.ts`; `lib/ledger/types.ts` |
| Domain | `lib/refunds/{errors,types,refund-state-machine,refund-attempt-state-machine,refund-money-policy,refundable-amount,refund-eligibility-policy,refund-commission-adjustment,refund-funding-policy,refund-ledger-policy,refund-ledger-evidence,refund-idempotency,refund-dual-control,refund-reconciliation-policy,customer-wallet-policy,refund-production-readiness,refund-note-policy}.ts` |
| Provider | `lib/refunds/providers/{refund-provider-adapter,refund-provider-registry,refund-provider-result}.ts`; `lib/refunds/providers/payfast/{payfast-refund-config,payfast-api-signature,payfast-refund-amount,payfast-refund-request,payfast-refund-response,payfast-refund-adapter}.ts` |
| Services/contracts | `lib/services/{customer-wallet,refund-request,refund-finance-review,refund-wallet-completion,refund-provider-execution,refund-reconciliation,refund-query,finance-dashboard}.service.ts`; `lib/dto/refund.dto.ts`; `lib/validation/refunds.ts` |
| Auth/security/navigation | `lib/auth/permission-keys.ts`; `lib/refunds/{api-policy,page-permission,admin-mutation-route}.ts`; `lib/security/rate-limit.ts`; `lib/constants/navigation.ts` |
| Customer API/UI | `app/api/customer-wallet/{route,transactions/route}.ts`; `app/api/refunds/route.ts`; `app/api/refunds/[publicReference]/{route,cancel/route}.ts`; `app/(account)/account/wallet/{page,transactions/page}.tsx`; `app/(account)/account/refunds/{page,[publicReference]/page}.tsx`; `components/refunds/{RefundRequestForm,CancelRefundButton}.tsx` |
| Finance API/UI | `app/api/admin/refunds/route.ts`; `app/api/admin/refunds/[id]/{route,review/route,approve/route,reject/route,complete-wallet/route,start-provider-refund/route,query-provider-status/route}.ts`; `app/api/admin/refund-reconciliation/{route,[id]/route}.ts`; `app/api/admin/finance/route.ts`; `app/(admin)/admin/refunds/{page,[id]/page}.tsx`; `app/(admin)/admin/refund-reconciliation/{page,[id]/page}.tsx`; `app/(admin)/admin/finance/page.tsx`; `components/refunds/FinanceRefundActions.tsx` |
| Scripts/config/CI | `scripts/{phase15-refund-preflight,verify-refund-invariants,scan-refund-reconciliation,refund-integration-test}.mjs`; `package.json`; `vitest.refund-integration.config.ts`; `playwright.config.ts`; `.github/workflows/ci.yml` |
| Tests | 16 `tests/refunds/*.test.ts`; 8 `tests/refunds/payfast/*.test.ts`; 8 required `tests/services/refund-*.test.ts`/wallet test plus `refund-service-test-mocks.ts`; 12 `tests/api/*refund*.test.ts`/wallet tests plus `refund-api-source.ts`; `tests/integration/refund-{fixtures,request,concurrency,commission-adjustment,wallet-completion,provider-execution,reconciliation,invariants}*`; two refund E2E specs |
| Documentation | `docs/phase-15-customer-wallet-refunds.md`; finance refund accounting/state/commission/wallet-security/reconciliation guides; `docs/payments/payfast-refund-api.md`; `docs/testing/refund-integration.md`; Phase 15 risk register; this report |

The exact policy/provider test files are `tests/refunds/refund-state-machine.test.ts`, `refund-attempt-state-machine.test.ts`, `refund-eligibility-policy.test.ts`, `refundable-amount.test.ts`, `refund-money-policy.test.ts`, `refund-funding-policy.test.ts`, `refund-commission-adjustment.test.ts`, `refund-ledger-policy.test.ts`, `refund-idempotency-hash.test.ts`, `refund-dual-control.test.ts`, `refund-reconciliation-policy.test.ts`, `customer-wallet-policy.test.ts`, `refund-production-readiness.test.ts`, `refund-source-audit.test.ts`, `refund-admin-ui-contract.test.ts`, `refund-customer-ui-contract.test.ts`, and `tests/refunds/payfast/payfast-refund-{config,amount,request,response,adapter,query,source-audit}.test.ts` plus `payfast-api-signature.test.ts`.

The exact service/API support and test files are `tests/services/refund-service-test-mocks.ts`, `customer-wallet.service.test.ts`, `refund-request.service.test.ts`, `refund-finance-review.service.test.ts`, `refund-wallet-completion.service.test.ts`, `refund-provider-execution.service.test.ts`, `refund-reconciliation.service.test.ts`, `refund-query.service.test.ts`, `refund-finance-dashboard.service.test.ts`; `tests/api/refund-api-source.ts`, `customer-wallet.test.ts`, `customer-wallet-transactions.test.ts`, `refunds.test.ts`, `refund-detail.test.ts`, `refund-cancel.test.ts`, `admin-refunds.test.ts`, `admin-refund-detail.test.ts`, `admin-refund-review.test.ts`, `admin-refund-approve.test.ts`, `admin-refund-wallet-complete.test.ts`, `admin-refund-provider-execution.test.ts`, and `admin-refund-reconciliation.test.ts`.

The exact deferred files are `tests/integration/refund-fixtures.ts`, the seven required `refund-{request,concurrency,commission-adjustment,wallet-completion,provider-execution,reconciliation,invariants}.integration.test.ts` files, `tests/e2e/customer-wallet-refunds.spec.ts`, and `tests/e2e/refund-finance-admin.spec.ts`. Documentation files are `docs/phase-15-implementation-map.md`, `docs/phase-15-customer-wallet-refunds.md`, `docs/finance/refund-accounting.md`, `refund-state-machine.md`, `refund-commission-adjustment.md`, `customer-wallet-security.md`, `refund-reconciliation.md`, `docs/payments/payfast-refund-api.md`, `docs/testing/refund-integration.md`, `docs/deferred-validation/phase-15-risk-register.md`, and this report.

## 43. Lightweight Checks Actually Run

| Command | Result |
|---|---|
| `npx prisma format` | Passed; schema formatted. |
| `npx prisma validate` | Passed; schema valid. |
| `npx vitest run tests/refunds/refund-state-machine.test.ts tests/refunds/refund-commission-adjustment.test.ts tests/refunds/refund-ledger-policy.test.ts tests/refunds/payfast/payfast-api-signature.test.ts` | Passed: 4 files, 15 tests. |
| `npx eslint "lib/refunds/**/*.ts" "lib/services/customer-wallet.service.ts" "lib/services/refund-request.service.ts" "lib/services/refund-finance-review.service.ts" "lib/services/refund-wallet-completion.service.ts" "lib/services/refund-provider-execution.service.ts" "lib/services/refund-reconciliation.service.ts" "lib/services/refund-query.service.ts" "lib/services/finance-dashboard.service.ts"` | Initial run failed with 14 explicit-any errors and 2 unused-parameter warnings; fixes were applied, then the exact command passed. |
| `npx eslint "app/api/refunds/**/*.ts" "app/api/customer-wallet/**/*.ts" "app/api/admin/refunds/**/*.ts" "app/api/admin/refund-reconciliation/**/*.ts" "components/refunds/**/*.tsx" "app/(account)/account/refunds/**/*.tsx" "app/(account)/account/wallet/**/*.tsx" "app/(admin)/admin/refunds/**/*.tsx" "app/(admin)/admin/refund-reconciliation/**/*.tsx"` | Passed. |
| `npx eslint "lib/refunds/**/*.ts" "lib/services/customer-wallet.service.ts" "lib/services/refund-request.service.ts" "lib/services/refund-finance-review.service.ts" "lib/services/refund-wallet-completion.service.ts" "lib/services/refund-provider-execution.service.ts" "lib/services/refund-reconciliation.service.ts" "lib/services/refund-query.service.ts" "lib/services/finance-dashboard.service.ts" "scripts/phase15-refund-preflight.mjs" "scripts/verify-refund-invariants.mjs" "scripts/scan-refund-reconciliation.mjs" "scripts/refund-integration-test.mjs"` | Passed after final service/script edits. |
| `npx eslint "lib/refunds/refund-note-policy.ts" "app/(admin)/admin/refunds/[id]/page.tsx" "tests/refunds/refund-state-machine.test.ts" "tests/refunds/refund-commission-adjustment.test.ts" "tests/refunds/refund-ledger-policy.test.ts" "tests/refunds/payfast/payfast-api-signature.test.ts"` | Passed. |
| `npx eslint "lib/services/refund-request.service.ts" "lib/services/refund-provider-execution.service.ts" "lib/services/refund-reconciliation.service.ts" "lib/services/customer-wallet.service.ts" "lib/refunds/refund-note-policy.ts" "app/(admin)/admin/refunds/[id]/page.tsx"` | Passed after final boundary fixes. |
| `npx eslint "lib/services/refund-request.service.ts"` | Passed after the final release-evidence hardening edit. |
| `git diff --check` | Passed (exit 0); Git emitted existing LF-to-CRLF working-copy warnings. |

## 44. Validation Deferred

No package installation/update/audit, Docker operation, database start, migration, seed, Prisma generation, full typecheck/test/coverage, production build, browser E2E, Payfast request, CI execution, commit or push was performed.

## 45. Deferred Validation Risks

Migration deployment/drift, generated-client/typecheck, persisted cumulative rounding, row-lock races, original commission/downstream behavior, ledger rollback, wallet privacy/projection, official Payfast signature/unit/status/query behavior, real network ambiguity, permission/DENY/maker-checker, build/UI and cross-module runtime proof remain deferred. Full detail is in `docs/deferred-validation/phase-15-risk-register.md`.

## 46. New Dependencies

None. Existing Prisma Decimal, Vitest, Playwright, Zod and Node crypto/runtime capabilities are reused.

## 47. Bugs Found and Fixed

| Bug/root cause | Fix | Evidence |
|---|---|---|
| Commission allocations were read before an authoritative lock. | Added ascending `FOR UPDATE` and post-lock reread before delta planning. | request service/source test |
| Release operation replay reached terminal-state failure. | Added history-key replay/conflict resolution before transition checks. | request service |
| Completion trusted reserve link/held aggregate without exact journal proof. | Added pure reserve-evidence validator and used it in wallet/external finalizers; added DB journal trigger. | ledger evidence module/migration |
| Provider-success recovery lacked row locks and could repeat a conflicting provider ID. | Added Refund/Attempt locks, conflict lookup, safe ID omission and typed reconciliation/history. | provider execution service |
| Reconciliation service scanned only stale/projection evidence. | Added journal/funding and cumulative commission/downstream scans. | reconciliation service |
| Customer wallet reads tolerated noncanonical account rows. | Added category/status/negative checks and stricter transaction account query. | wallet service |
| Refund query mapper used explicit `any`. | Added bounded structural row types/unknown boundaries. | clean file-scoped ESLint rerun |
| Deferred integration runner did not own a database lifecycle. | Added uniquely named Compose project, isolated URLs/volume, migration/seed/test and safe cleanup gate. | integration script |

## 48. Architect Review Items

1. Supply authoritative current Payfast evidence for refund amount units and a fixed production request vector.
2. Select and document the official Payfast refund query endpoint/status mapping and multiple-partial/idempotency capabilities.
3. Review the migration’s fail-closed response if any environment contains legacy `PaymentRefund` rows.
4. Approve the consolidated validation plan/results before changing the source production lock.

## 49. Progression Readiness

READY FOR ARCHITECT IMPLEMENTATION REVIEW

## 50. Final Confirmation

- Implementation-only workflow followed.
- No packages downloaded; no Docker; no migration/seed; no database/volume changed.
- No full tests, coverage, build, browser, Payfast request or CI run.
- No prior migration changed; no commit/push performed.
- No real refund executed; no raw bank/card data stored.
- No direct wallet balance mutation and no wallet spending implemented.
- No over-refund path, fee deduction or current-policy commission recalculation was introduced.
- Released allocations block automatic clawback; unknown outcomes remain held.
- No refund service changes Payment or Order status.
- Production refunds and Payfast networking remain locked.
- No secrets were exposed.
