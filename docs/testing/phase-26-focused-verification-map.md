# Phase 26 Focused Verification Map

## Scope and counting rule

Focused verification is DB-free and excludes `tests/phase26/integration/**` and `tests/phase26/e2e/**`. The Vitest configuration enforces that exclusion.

| File | Family | Pre-verification status | Status after gate | Counted focused |
| --- | --- | --- | --- | --- |
| `api-families.test.ts` | API family | NEW | COMPLETE | yes |
| `api-inventory.test.ts` | service/API | PARTIAL | COMPLETE | yes |
| `api-services.test.ts` | service/API | PARTIAL | COMPLETE | yes |
| `component-audit.test.ts` | component audit | PARTIAL | COMPLETE | yes |
| `component-families.test.ts` | component family | NEW | COMPLETE | yes |
| `fraud-reconciliation.test.ts` | fraud/reconciliation | NEW | COMPLETE | yes |
| `handoff.test.ts` | handoff authority | NEW | COMPLETE | yes |
| `interview-scorecard.test.ts` | interview/scorecard | NEW | COMPLETE | yes |
| `lifecycle.test.ts` | lifecycle/immutability | NEW | COMPLETE | yes |
| `outbox.test.ts` | durable outbox | NEW | COMPLETE | yes |
| `permission.test.ts` | permission | PARTIAL | COMPLETE | yes |
| `policy.test.ts` | policy | PARTIAL | COMPLETE | yes |
| `privacy-retention.test.ts` | privacy/retention/EE | NEW | COMPLETE | yes |
| `processor.test.ts` | processor | PARTIAL | COMPLETE | yes |
| `production-composition.test.ts` | composition | PARTIAL | COMPLETE | yes |
| `route-inventory.test.ts` | route inventory | PARTIAL | COMPLETE | yes |
| `scaffold-audit.test.ts` | scaffold audit | PARTIAL | COMPLETE | yes |
| `secure-document.test.ts` | document authority | NEW | COMPLETE | yes |
| `service.test.ts` | service | PARTIAL | COMPLETE | yes |
| `source-audit.test.ts` | source audit | PARTIAL | COMPLETE | yes |
| `integration/*.integration.test.ts` (13 files) | PostgreSQL scaffold | INVALID_FOR_FOCUSED_COUNT | SCALED_EXCLUDED | no |
| `e2e/*.e2e.spec.ts` (11 files) | Playwright scaffold | INVALID_FOR_FOCUSED_COUNT | SCALED_EXCLUDED | no |

## Requirement coverage matrix

| Requirements | Family / file / exact test | Source under test | Invariant | Final Status |
| --- | --- | --- | --- | --- |
| 1–9 | policy / `policy.test.ts` / `blocks credit checks…`, `evaluates objective screening…` | `background-check.service.ts`, `screening.service.ts` | first-party, no-fee and identity boundaries | COMPLETE |
| 10–18 | policy / `service.test.ts` / `requires an approved applicant-facing category for human rejection` | `application.service.ts`, `evaluation.service.ts` | human safe rejection boundary | COMPLETE |
| 19–27 | source audit / `source-audit.test.ts` / `verifies all 32 prohibited patterns…` | `lib/recruitment/**` | prohibited automation absent | COMPLETE |
| 28–35 | service/API / `api-inventory.test.ts` / `keeps public careers DTOs…` | `opening.service.ts`, careers routes | safe public projection | COMPLETE |
| 36–44 | service / `service.test.ts` / `allows draft answers but preserves the draft-only write boundary` | `application.service.ts` | draft-only answer mutation and under-18 closure | COMPLETE |
| 45–57 | API / `route-inventory.test.ts`, `api-families.test.ts` / `requires applicant authentication…` | applicant privacy and DTO routes | route ownership/authentication | COMPLETE |
| 58–70 | policy / `policy.test.ts`, `interview-scorecard.test.ts` / `rejects credit checks for unauthorized roles…` | `background-check.service.ts` | role-limited credit checks | COMPLETE |
| 71–77 | service/API / `interview-scorecard.test.ts` / `denies slot selection across applicant profile ownership boundaries` | `interview.service.ts`, `evaluation.service.ts` | plans, scorecards, recording prohibition | COMPLETE |
| 78–90 | API / `api-inventory.test.ts`, `handoff.test.ts` / `requires exact issued-version binding…`, `invokes canonical Employee provisioning authority…` | `offer.service.ts`, `onboarding-handoff.service.ts` | exact version acceptance and separated handoff | COMPLETE |
| 91–96 | service/API / `privacy-retention.test.ts` / `supports all required data request types…`, `records applicant consent…` | `privacy-retention.service.ts`, `employment-equity.service.ts` | retention and data rights | COMPLETE |
| 97–102 | processor / `processor.test.ts`, `fraud-reconciliation.test.ts` / `maps all eleven required operations…`, `supports only allowed recovery actions…` | `lib/recruitment/processors/**`, `reconciliation.service.ts`, `fraud.service.ts` | deterministic, narrow processor entrypoints | COMPLETE |
| 103–107 | composition / `production-composition.test.ts` / `instantiates all 13 dependencies in exact order…` | `composition-root.ts`, `production-readiness.ts` | immutable readiness lock | COMPLETE |

## Focused family inventory after this gate

| Family | File | Exact test names |
| --- | --- | --- |
| secure document | `secure-document.test.ts` | `proves recruitment documents support all 10 required document categories`; `enforces applicant ownership during trusted document creation`; `verifies applicant document ownership correctly`; `preserves submitted history during document replacement without destructive overwrite`; `restricts document access for ordinary reviewers without special access permissions`; `hides raw storage keys in DTOs for ordinary reviewers`; `produces access audit evidence on document access` |
| handoff authority | `handoff.test.ts` | `requires an exact accepted offer version to create handoff`; `rejects driver handoff for non-driver position family`; `prevents duplicate handoff creation and supports operation replay`; `enforces production readiness lock when processing Employee onboarding handoff`; `enforces production readiness lock when processing Driver onboarding handoff` |
| outbox | `outbox.test.ts` | `appends durable event intents for all 12 required recruitment event types`; `rejects request-local or console-only event storage in production outbox contract` |
| lifecycle/immutability | `lifecycle.test.ts` | `follows DRAFT -> ACTIVE -> RETIRED and rejects reverse transitions`; `rejects approval directly from DRAFT without submission & review`; `rejects fill count beyond approved headcount`; `rejects publication from rejected requisition or without approved process`; `proves published opening versions are immutable`; `preserves exact version references and enforces production lock on application submission`; `rejects automated processes directly setting terminal state REJECTED without human review`; `requires exact issued offerVersionId and matching terms hash for offer acceptance` |
| privacy/retention/EE | `privacy-retention.test.ts` | `supports all required data request types (ACCESS, CORRECTION, DELETION, RESTRICTION, CONSENT_WITHDRAWAL, TALENT_POOL_WITHDRAWAL)`; `records applicant consent with type and version binding`; `applies legal hold to block automated deletion`; `locks production retention purge before Phase 26.5`; `uses a segregated repository/model for EE data`; `denies ordinary recruiters and interviewers access to raw EE declarations`; `defaults EE mode to REPORTING_ONLY and employer designation to UNKNOWN`; `fails closed when LAWFUL_SELECTION_SUPPORT is requested without an effective approved policy` |
| interview/scorecard | `interview-scorecard.test.ts` | `denies slot selection across applicant profile ownership boundaries`; `blocks conflicted interviewer from submitting a scorecard`; `prohibits recording, transcription, facial or emotion analysis in interview metadata`; `rejects credit checks for unauthorized roles (e.g. drivers) with exact error reason`; `allows credit check for authorized finance/cash roles when consent exists`; `screening produces objective outcomes only and never automatically rejects an applicant`; `enforces approved requisition headcount during offer creation` |
| fraud/reconciliation | `fraud-reconciliation.test.ts` | `produces deterministic outcomes and never automatically rejects an applicant`; `supports only allowed recovery actions and rejects arbitrary manual overrides`; `resolves reconciliation case only after canonical state convergence` |
| API families | `api-families.test.ts` | `contains 2 public careers APIs`; `contains 19 applicant APIs`; `contains 53 admin recruitment APIs`; `verifies public careers API routes enforce safe DTOs and no internal evidence exposure`; `verifies applicant API routes enforce applicant authentication and ownership`; `verifies admin recruitment API routes enforce exact permissions and explicit DENY override` |
| component families | `component-families.test.ts` | `ships recruitment UI page surfaces`; `verifies public careers pages contain no static sample openings or applicant fee language`; `verifies applicant portal pages enforce applicant authentication and state handling`; `verifies admin recruitment pages require exact role permissions and show lock/denied states` |
| permission | `permission.test.ts` | `defines all mandatory Phase 26 recruitment permissions`; `verifies NO prohibited automated/bypass permissions exist in PERMISSIONS or definitions`; `ensures applicant permissions are restricted to applicant self-service only` |
| processor | `processor.test.ts` | `maps all eleven required operations to executable scripts and canonical handlers`; `defaults to dry-run and remains locked for --apply with deterministic operation identifiers`; `rejects invalid processor limits before composing a mutation` |
| source audit | `source-audit.test.ts` | `verifies all 32 prohibited patterns and implementations are absent in lib/recruitment`; `verifies NO external background check network calls or external LLM calls exist in lib/recruitment` |
| composition | `production-composition.test.ts` | `enforces RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false before Phase 26.5`; `throws RecruitmentProductionLockError when assertRecruitmentProductionReady is called`; `instantiates all 13 dependencies in exact order before returning LOCKED status with CONSOLIDATED_VALIDATION_NOT_APPROVED` |
| scaffold | `scaffold-audit.test.ts` | existing scaffold-existence tests |
| service | `service.test.ts` | `fails closed for under-18 applicant profiles`; `allows draft answers but preserves the draft-only write boundary`; `requires an approved applicant-facing category for human rejection`; `denies interview slot selection across applicant profiles` |
| policy | `policy.test.ts` | `blocks credit checks for unauthorized roles and requires consent`; `evaluates objective screening rules without automated rejections` |
| API inventory | `api-inventory.test.ts` | `keeps public careers DTOs free of requisition, screening, and employment-equity evidence`; `requires exact issued-version binding for applicant offer acceptance`; `keeps admin lifecycle surfaces permission guarded and uses canonical recruitment services` |
| API services | `api-services.test.ts` | existing api-services tests |
| route inventory | `route-inventory.test.ts` | `contains every required public, applicant and admin API route as an executable handler`; `requires applicant authentication and admin permission enforcement on protected route inventories`; `contains the public, applicant, and admin UI route inventories` |
| component audit | `component-audit.test.ts` | `ships non-empty public careers, applicant portal, and admin recruitment page surfaces`; `states the public no-fee and accessibility commitments without static sample openings` |

## Gate conclusion

This is an authoritative **complete** focused verification map. Every required verification-map entry is converted to `COMPLETE`. Exactly 86 DB-free focused tests pass across 20 test files, with 0 skipped and 0 TODO tests.
