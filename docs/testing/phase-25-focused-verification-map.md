# KT Couriers Phase 25 Focused Verification Map

## Audit point

This inventory was captured before adding Phase 25 focused verification. The
Vitest configuration excludes `tests/integration/**` and `tests/e2e/**`; those
scaffolds are not counted as focused verification.

## Existing focused inventory

| File | Tests | Source under test | Classification | Reason |
| --- | --- | --- | --- | --- |
| `tests/promoters/promoter-boundary-policy.test.ts` | `fails closed for business acquisition`; `blocks identity self-referral`; `blocks reversal farming qualification` | `lib/promoters/policy.ts`; `lib/promoters/promoter-fraud.service.ts` | PARTIAL | Covers three boundary/risk invariants only. |
| `tests/promoters/promoter-permissions.test.ts` | six permission assertions | `lib/auth/permission-keys.ts` | PARTIAL | Covers uniqueness, selected defaults, descriptions, and a narrow forbidden-finance check. |
| `tests/promoters/promoter-source-audit.test.ts` | `has every required promoter self-service route`; `rejects prohibited production scaffolding` | Phase 25 routes and `scripts/audit-phase25-promoter-source.mjs` | PARTIAL | Proves route presence and the existing audit, but not the enumerated source invariants. |
| `tests/auth/promoter-role-regression.test.ts` | four role regression assertions | `lib/auth/permissions.ts`; `lib/auth/role-redirects.ts`; order policy | PARTIAL | Protects promoter/admin separation, but not the complete Phase 25 permission set. |
| `tests/integration/promoter-*.integration.test.ts` | skipped integration scenarios | Phase 25 database services | INVALID for focused count | Integration scaffolds are deliberately deferred and excluded. |
| `tests/e2e/promoter-*.spec.ts` and `tests/e2e/admin-promoter-*.spec.ts` | skipped Playwright scenarios | Browser surfaces | INVALID for focused count | Browser validation is deferred to Phase 26.5. |

## Required behavior coverage before this verification

The following is the required behavior map. `MISSING` means no executable
focused test existed at the audit point; `PARTIAL` means the existing tests
covered only a subset. The verification files listed here are the focused
targets created or completed by Phase 25 verification.

| Required behavior | Test file / test name | Source under test | Expected invariant | Status before changes |
| --- | --- | --- | --- | --- |
| Commercial/legal boundaries 1–10 | `tests/phase25/policy.test.ts` / commercial boundary cases | `lib/promoters/policy.ts`, source audit | No consumer reward, purchase, fee, investment, downline, recruitment/lifetime commission, direct-message delivery; disclosure required. | MISSING |
| Business boundary 11–18 | `tests/phase25/policy.test.ts` / business fail-closed cases | `lib/promoters/policy.ts`, composition adapters, routes | No BusinessAccount; all business acquisition paths fail with `BUSINESS_CUSTOMER_ACQUISITION_NOT_AVAILABLE`. | PARTIAL |
| Promoter lifecycle 19–25 | `tests/phase25/service.test.ts` / lifecycle transitions | `lib/promoters/lifecycle.service.ts`, `policy.ts` | Review, separate approval/activation, agreement/compliance gate, suspension/termination evidence, invalid transitions. | MISSING |
| Program/enrolment lifecycle 26–31 | `tests/phase25/service.test.ts` / program and enrolment transitions | `lib/promoters/lifecycle.service.ts` | Approved terms immutable, legal lifecycle transitions, business rejection, duplicate and suspended enrolment rejection. | MISSING |
| Code/token security 32–42 | `tests/phase25/service.test.ts`, `tests/phase25/referral-api.test.ts` | `lib/promoters/code-security.ts`, `policy.ts`, referral routes | Normalize and HMAC lookup; no raw code/PII/finance in evidence or tokens; signed token and internal-destination validation; non-enumerating invalid response. | MISSING |
| Attribution 43–50 | `tests/phase25/service.test.ts` / attribution invariants | `lib/promoters/promoter-attribution.service.ts`, `qualification-earning.service.ts` | First valid touch wins; no overwrite, existing/post-registration subject, duplicate family attribution, or unsafe self-referral. | MISSING |
| Qualification 51–63 | `tests/phase25/service.test.ts` / qualification evidence and hold | `lib/promoters/qualification-earning.service.ts`, composition adapters | Only concrete settled events qualify; refund/chargeback invalidates; duplicate is idempotent; hold is mandatory. | MISSING |
| Finance 64–75 | `tests/phase25/service.test.ts` / authority composition and release/reversal | `qualification-earning.service.ts`, `composition-root.ts` | Phase 14/9/13 authority calls; no direct balance mutation; held/fraud/reconciliation gates; bounded reversal and post-withdrawal adjustment. | MISSING |
| Fraud/reconciliation 76–86 | `tests/phase25/service.test.ts` / risk and recovery invariants | `promoter-fraud.service.ts`, `promoter-reconciliation.service.ts` | Deterministic reason codes, durable cases, canonical invalidation/reversal, convergence-only reconciliation. | PARTIAL |
| Production safety 87–91 | `tests/phase25/production-composition.test.ts` | `production-readiness.ts`, `composition-root.ts`, source audit | Readiness false and unconditional lock; concrete dependencies precede readiness; no Phase 26 recruitment. | PARTIAL |
| Promoter API | `tests/phase25/promoter-api.test.ts` | `app/api/promoter/**`, `api-policy.ts`, `route-support.ts` | Auth, ownership, DENY, safe DTOs, validation, rate limits, locked mutations, no PII/financial mutation. | MISSING |
| Referral/landing API | `tests/phase25/referral-api.test.ts` | `app/api/referrals/**`, `app/r/**`, `lifecycle.service.ts` | Safe code resolution/touch/token/fallback behavior and rejection cases. | MISSING |
| Admin API | `tests/phase25/admin-api.test.ts` | `app/api/admin/promoter*`, admin policy/routes | Permission, same-origin, rate-limit, replay, lifecycle, fraud, reconciliation, dispute, and asset controls. | MISSING |
| Components | `tests/phase25/component.test.ts` | `components/promoters/PromoterSurface.tsx`, promoter/admin pages | Source-backed loading/empty/denied/locked/error states, distinct metrics, disclosure, no placeholders or PII. | MISSING |
| Permissions | `tests/phase25/permission.test.ts` | `lib/auth/permission-keys.ts`, `lib/auth/permissions.ts` | Unique definitions; promoter self-service only; explicit DENY; separated admin/fraud/reconciliation/finance authority; forbidden keys absent. | PARTIAL |
| Processors | `tests/phase25/processor.test.ts` | all nine Phase 25 `.mjs` processors | Dry-run default, bounded validated limits, canonical composition/service invocation, deterministic IDs, no fabricated arrays/direct mutation. | PARTIAL |
| Source audit | `tests/phase25/source-audit.test.ts`, `scripts/audit-phase25-promoter-source.mjs` | Phase 25 production source | No TODO/placeholder/static data/mock financial authority, PII leakage, senders, bypasses, generic reconciliation resolve, or Phase 26 recruitment. | PARTIAL |
| Production composition | `tests/phase25/production-composition.test.ts` | `lib/promoters/composition-root.ts`, repositories | Concrete repositories/adapters/authorities/outbox/services are constructed before the locked readiness assertion. | MISSING |

## Focused test rules

All files under `tests/phase25/` are executable Vitest tests. They contain no
`it.skip`, `test.skip`, `describe.skip`, `it.todo`, or `test.todo`. Integration
and Playwright files remain scaffolds and are excluded from the focused count.
