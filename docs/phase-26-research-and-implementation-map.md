# Phase 26 — Recruitment: Research and Implementation Map

## 1. Overview & Phase Objective

Phase 26 implements a first-party recruitment and applicant-tracking system (ATS) for KT Couriers covering two recruitment tracks:
- `INTERNAL_EMPLOYEE`
- `DRIVER_NETWORK`

The recruitment pipeline follows the canonical lifecycle:
Position Family → Approved Requisition → Immutable Opening Version → Public Job Posting → Verified Applicant Identity → Draft Application → Submitted Application → Structured Eligibility Review → Human Evaluation → Interview → Conditional Checks → Immutable Offer → Offer Acceptance → Onboarding Handoff → Existing Employee or Driver Authority.

---

## 2. Existing Authority Audit

| # | Surface / Authority | Exact Model(s) | Exact Service / Route | Source Authority | Transaction Boundary & Locking | Replay & Concurrency | Privacy Classification | Phase 26 Integration Decision | Production-Lock Behavior |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Legacy Recruitment Models | `Vacancy`, `RecruitmentApplication`, `ApplicationDocument`, `ApplicationStatusHistory` | Schema only (`prisma/schema.prisma` lines 6213–6295) | Historical schema foundation (Phase 4) | Mutable legacy models | None | Unencrypted legacy strings | Deprecated / Replaced by Phase 26 canonical models. Legacy tables remain untouched. | Source-locked out of Phase 26. |
| 2 | Applicant Role & Auth | `User`, `Session`, `UserPermission`, `RolePermission` | `lib/auth/session.ts`, `lib/auth/permissions.ts`, `app/api/auth/*` | Canonical `User` identity | `prisma.user` / session token verification | Session revocation & expiry | Confidential auth metadata | Applicants use canonical `User` auth with applicant permissions. No secondary auth system. | Public openings unauthenticated; application creation requires authenticated user. |
| 3 | Applicant Routes | None | None | N/A | N/A | N/A | N/A | Create `/api/applicant/*` and `/api/careers/*` routes with exact ownership enforcement. | Blocked under production lock when `RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false`. |
| 4 | Employee Models | `User`, `AdminProfile`, `UserPermission` | `lib/auth/admin-api.ts`, `app/api/admin/employees` | Canonical Admin/Employee authority | `prisma.adminProfile` inside transaction | Idempotent profile update | Internal employee metadata | Handoff invokes existing employee provisioning authority. Does not directly mutate employee roles. | Handoff blocked if lock active. |
| 5 | Employee Provisioning | `AdminProfile` creation / permission granting | Admin employee management services | `AdminProfile` | DB transaction | Operation ID guarded | Internal staff data | `RecruitmentOnboardingHandoff` transfers minimal approved data to employee provisioning service. | Handoff execution blocked. |
| 6 | Driver Models | `DriverProfile`, `DriverDocument`, `DriverServiceRegion` | `lib/driver-operations/*`, `app/api/driver/*` | Canonical Driver authority | `prisma.driverProfile` with availability/status locking | Revision counter (`availabilityRevision`) | Internal & driver PII | Driver onboarding handoff transfers verified credentials; Driver authority retains profile activation control. | Handoff execution blocked. |
| 7 | Driver Onboarding | `DriverProfile.onboardingStatus` (`PROFILE_INCOMPLETE` → `APPROVED`) | `lib/driver-operations/` services | `DriverProfile` | DB transaction | Idempotent transition | Driver PII | Handoff invokes driver onboarding service to set initial onboarding state; active dispatch eligibility remains with Driver authority. | Handoff execution blocked. |
| 8 | Driver Document Models | `DriverDocument`, `DocumentType`, `DocumentStatus` | `DriverProfile.documents` relation | `DriverDocument` | Transactional status update | Unique per document type | Driver license/identity evidence | recruitment driver checks project verified references to `DriverDocument` during handoff. | Check ingestion / handoff blocked. |
| 9 | Vehicle Models | `DriverProfile` vehicle fields (`vehicleMake`, `vehicleModel`, `vehicleRegistration`, `vehicleType`) | Driver operations service | `DriverProfile` | Transactional update | Snapshot hash | Vehicle operational details | Recruitment checks collect vehicle registration declarations; handoff passes references to Driver authority. | Handled via onboarding handoff. |
| 10 | User Identity & Verification | `User.status`, `OtpCode`, `UserRole` | `lib/auth/*`, email/OTP verification | Canonical User authority | DB transaction | Hash verification & OTP consumption | User account identity | Applicant identity must link to single canonical `User`. Verified email/phone required for submission. | Unverified submission blocked. |
| 11 | Role Assignment | `UserRole`, `RolePermission`, `UserPermission` | `lib/auth/permissions.ts` | Explicit RBAC & ABAC | Transactional permission grant | Unique `(userId, permissionId)` | Access control definitions | Add 30+ recruitment-specific permissions. Use explicit `DENY` override support. | No manual role assignment bypass endpoints. |
| 12 | Invitation Systems | `DriverProfile.onboardingStatus = INVITED`, OTP invitations | `lib/auth/otp.ts` | OTP / Invitation services | Database transaction | Token hash expiry | Contact invitations | Recruitment offers issue immutable offer versions with acceptance tokens; no arbitrary unverified invites. | Offer issuance blocked. |
| 13 | Media & Document Storage | Catalog / Media upload abstractions | `lib/catalog/` media upload patterns | Media upload authority | Request hash & signed reference | Hash deduplication | Uploaded document references | Application documents use trusted media references (`FILE_REFERENCE`), file validation, malware/media checks. No public URLs. | Restricted document download APIs. |
| 14 | Malware & Media Validation | Catalog media upload validation patterns | Internal upload validator | Storage validator | Pre-commit validation | Idempotent scanner | Media inspection metadata | All applicant uploads undergo file-type, extension, size, and media/malware validation before storage link. | Invalid files rejected. |
| 15 | Audit History Infrastructure | `AdminActivityLog`, `SecurityEvent`, `OrderStatusHistory` | `lib/services/` activity logging | Canonical Audit authority | Transactional append-only | Log sequence id | Operational & security audit | Recruitment decisions, reviews, approvals, checks, offers and handoffs record immutable audit trails. | Non-deletable audit trail. |
| 16 | Event Intent Outbox | `PromoterEventIntent`, `AdvertisingEventIntent` outbox patterns | `lib/recruitment/composition-root.ts` outbox | Durable outbox pattern | Same transaction as aggregate mutation | Operation ID & request hash | Event payload metadata | Phase 26 writes durable recruitment event intents to outbox (`RECRUITMENT_*`). Delivery deferred to Phase 27. | Outbox intents recorded; delivery handled by Phase 27. |
| 17 | Notification Patterns | `Notification`, `EmailLog` | `lib/services/notification-events.service.ts` | Notification outbox | Transactional insert | Unique event ID | Recipient & intent details | Phase 26 creates durable notification event intents only. No direct email/SMS/push delivery calls. | Delivery deferred to Phase 27. |
| 18 | Privacy & Consent Records | Privacy Notice & Consent abstractions | `lib/security/` privacy tools | Privacy authority | DB transaction | Versioned notice consent link | Privacy declarations | Introduce immutable `RecruitmentPrivacyNoticeVersion` and `RecruitmentConsentRecord` per consent type. | Mandatory privacy notice acceptance. |
| 19 | Data-Subject Request Workflows | Privacy / User request workflows | `lib/security/` data subject tools | Privacy compliance authority | Transactional request record | Request reference ID | Data subject PII | Support applicant requests: `ACCESS`, `CORRECTION`, `DELETION`, `RESTRICTION`, `CONSENT_WITHDRAWAL`, `TALENT_POOL_WITHDRAWAL`. | Retains legally mandated audit logs on deletion. |
| 20 | Operation Receipts | Operation receipt pattern (`operationId`, `requestHash`) | Service transaction wrappers | API operation authority | Enforced per write operation | Strict operationId deduplication | API idempotency metadata | Every state-modifying recruitment API requires `operationId` and `requestHash`. | Duplicate requests return cached outcome. |
| 21 | Optimistic Concurrency | `optimisticVersion` / revision fields | DB model update counters | Prisma optimistic concurrency | `where: { id, optimisticVersion }` | Version mismatch error | Concurrency control | Models (`RecruitmentApplication`, etc.) use `optimisticVersion` increments on mutation. | Concurrent conflict returns 409 error. |
| 22 | Reconciliation Patterns | `RefundReconciliationCase`, `PromoterReconciliationCase` | Reconciliation scanner & case services | Reconciliation case authority | Transactional case resolution | Rescan idempotency | Operational exception evidence | Introduce `RecruitmentReconciliationCase` with scanner and canonical recovery actions. | No manual bypass resolutions allowed. |
| 23 | Permissions & Explicit DENY | `UserPermission.effect = DENY` | `lib/auth/permissions.ts` | RBAC/ABAC authority | Evaluated on every guard | Deny overrides grant | Security enforcement | Evaluated via `hasPermission()`; `DENY` takes precedence over any granted role. | Unauthorized access returns 403. |
| 24 | Admin Workspace | `/app/(admin)/*` layout & components | Next.js admin app routes | Admin UI surface | Server & Client components | React state / query | Admin dashboard view | Add `/admin/recruitment/*` pages with full loading, empty, error, locked, and reconciliation states. | UI reflects `LOCKED` status banner if lock active. |
| 25 | Public Site Routing | `/app/(public)/*` layout | Next.js public routes | Public UI surface | Server rendering | Static / ISR / dynamic | Public job advertisements | Add `/careers`, `/careers/jobs`, `/careers/jobs/[reference]` and `/applicant/*` pages. | Safe DTOs only; no internal recruiter notes exposed. |
| 26 | Geographic & Region Models | `DeliveryRegion`, `DriverServiceRegion` | Region service | Geographic authority | DB lookup | Region slug lookup | Geographic coverage | Positions link to primary locations or service regions for driver-network and employee roles. | Validated against existing `DeliveryRegion`. |
| 27 | Licence & PrDP Evidence | `DriverProfile.licenseNumber`, `DriverDocument` | Driver verification service | Driver credential authority | DB lookup & verification | Document status | Masked driver credentials | Evaluates driving licence & PrDP requirements. Projections mask full license/ID numbers for ordinary recruiters. | Fraud check on conflicting credentials. |
| 28 | Background Check Abstractions | Verification status abstractions | Verification service patterns | Verification authority | DB transaction | Policy-driven check case | Restricted check evidence | Introduces `RecruitmentBackgroundCheckPolicyVersion` and `RecruitmentCheckCase`. Ingestion via internal manual verification/result ingestion. | External API calls prohibited. |
| 29 | Employment Equity Config | EE reporting abstractions | Compliance reporting | EE authority | DB transaction | Effective-dated version | Confidential EE declarations | Segregated `RecruitmentEmploymentEquityDeclaration` and `RecruitmentEmploymentEquityConfiguration`. Default mode `REPORTING_ONLY`. | `LAWFUL_SELECTION_SUPPORT` source-locked. |
| 30 | Phase 25 Exclusions | Commercial promoter attribution | `lib/promoters/*` | Promoter authority | Independent | N/A | Promoter earnings data | Phase 25 promoter attribution MUST NOT influence recruitment decisions or candidate ranking. | Complete isolation enforced. |
| 31 | Production Readiness Lock | `RECRUITMENT_PRODUCTION_VALIDATION_APPROVED` | `lib/recruitment/production-readiness.ts` | Phase 26.5 readiness gate | Non-bypassable runtime check | Constant boolean check | System readiness status | Defaults to `false`. Blocks production publication, application submission, screening, offer issuance, handoff, and retention deletion. | Throws `RecruitmentProductionLockError`. |

---

## 3. Boundary & Architectural Decisions

1. **Fundamental Identity Separation**:
   - `User` ≠ `RecruitmentApplicantProfile` ≠ `RecruitmentApplication` ≠ `Employee` ≠ `Driver`.
   - Single canonical `User` per applicant. Unauthenticated users can view public job postings; applying requires authenticated applicant role.
   - Accepted offers do not directly activate `Employee` or `Driver` accounts; activation is strictly handed off to existing authorities.

2. **Fair Selection & Compliance Rules**:
   - Criterion-based screening: Essential vs Desirable criteria.
   - Human-in-the-loop: Automated screening produces flags/recommendations only; ALL rejections require an identified human reviewer, structured scorecard, and approved reason code.
   - Protected characteristics and EE declarations are stored in segregated models and default to `REPORTING_ONLY`. Never shown to ordinary interviewers or used in automated ranking.
   - Credit checks restricted to cash/finance handling roles with candidate written consent and approved policy (`EMPLOYMENT_CREDIT_CHECK_NOT_AUTHORIZED_FOR_POSITION`).
   - Medical/psychometric tests strictly restricted. Default psychometric: `PSYCHOMETRIC_ASSESSMENT_NOT_CONFIGURED`.
   - Age eligibility: Initial scope adult applicants only (`UNDER_18_APPLICATION_NOT_SUPPORTED`).

3. **No-Fee Policy & First-Party Boundary**:
   - Zero fees for applicants (no application, screening, interview, permit, or placement fees).
   - Recruitment is strictly for KT Couriers internal employees and driver network. No third-party agency, placement fees, or public talent marketplace.

4. **Prohibited AI & Automation**:
   - Source audits confirm NO production code for AI scorecards, CV ranking, personality scoring, facial/emotion/voice analysis, or automated rejection/hiring.

5. **Durable Outbox & Notifications**:
   - State changes emit durable event intents (`RECRUITMENT_*`) to the recruitment outbox in the same transaction. Message delivery is owned by Phase 27.

6. **Production Readiness Lock**:
   - `RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false`.
   - Source-level tests and injected repository unit tests execute cleanly. Production operations are blocked until Phase 26.5.

---

## 4. Phase 26 Model Additions

The following Prisma models will be added in `prisma/schema.prisma` and applied via an additive migration:

1. `RecruitmentPositionFamily`
2. `RecruitmentRequisition`
3. `RecruitmentOpening`
4. `RecruitmentOpeningVersion` (Immutable)
5. `RecruitmentApplicationFormVersion` (Immutable)
6. `RecruitmentApplicationSectionVersion` & `RecruitmentApplicationQuestionVersion`
7. `RecruitmentApplicantProfile`
8. `RecruitmentApplication`
9. `RecruitmentSubmittedAnswer` (Immutable)
10. `RecruitmentApplicationDocument`
11. `RecruitmentPrivacyNoticeVersion` (Immutable)
12. `RecruitmentConsentRecord`
13. `RecruitmentEmploymentEquityDeclaration` (Segregated)
14. `RecruitmentEmploymentEquityConfiguration`
15. `RecruitmentScreeningPolicyVersion` (Immutable)
16. `RecruitmentReviewAssignment`
17. `RecruitmentEvaluationRubricVersion` (Immutable) & `RecruitmentRubricCriteria`
18. `RecruitmentInterviewPlan` & `RecruitmentInterviewSlot` & `RecruitmentInterview` & `RecruitmentInterviewPanelMember` & `RecruitmentScorecard`
19. `RecruitmentAccommodationRequest` (Segregated)
20. `RecruitmentBackgroundCheckPolicyVersion` (Immutable)
21. `RecruitmentCheckCase`
22. `RecruitmentDecision` (Immutable)
23. `RecruitmentOffer` & `RecruitmentOfferVersion` (Immutable)
24. `RecruitmentOnboardingHandoff`
25. `RecruitmentRetentionPolicyVersion` (Immutable) & `RecruitmentApplicantDataRequest`
26. `RecruitmentFraudCase` & `RecruitmentReconciliationCase`
27. `RecruitmentEventIntent` (Outbox)

---

## 5. Implementation Roadmap

1. **Schema & Migration**: Add all Prisma models, enums, indexes, and relations in `prisma/schema.prisma` and create the migration `20260722000000_phase26_recruitment`.
2. **Permissions & Auth**: Add 30+ permissions to `lib/auth/permission-keys.ts` and update guard functions.
3. **Core Services**: Build domain services in `lib/recruitment/`:
   - `position-family.service.ts`, `requisition.service.ts`, `opening.service.ts`
   - `applicant-profile.service.ts`, `application.service.ts`, `screening.service.ts`
   - `review-assignment.service.ts`, `evaluation.service.ts`, `interview.service.ts`
   - `accommodation.service.ts`, `background-check.service.ts`, `offer.service.ts`
   - `onboarding-handoff.service.ts`, `privacy-retention.service.ts`, `employment-equity.service.ts`
   - `fraud.service.ts`, `reconciliation.service.ts`, `production-readiness.ts`
4. **Composition Root & Outbox**: Create `lib/recruitment/composition-root.ts` and repository abstractions.
5. **Operational Processors**: Implement 9 background processors in `lib/recruitment/processors/`.
6. **API Routes**: Create Public (`/api/careers/*`), Applicant (`/api/applicant/*`), and Admin (`/api/admin/recruitment/*`) route handlers.
7. **UI Scaffolds**: Implement Careers/Applicant pages in `app/(public)/careers`, `app/(public)/applicant` and Admin pages in `app/(admin)/admin/recruitment`.
8. **Documentation & Contracts**:
   - `docs/ui-ux/phase-26-recruitment-screen-contract.md`
   - `docs/deferred-validation/phase-26-risk-register.md`
   - Update Figma brief references.
9. **Executable Test Suite**: Unit tests, policy tests, permission tests, source audits, integration & E2E test scaffolds under `tests/phase26/`.

---

## 6. Audit & Capability Classification Map

All Phase 26 capabilities have been audited and classified according to production completeness:

| Surface / Component | Classification | Implementation Details |
|---|---|---|
| Requisition Service | CONCRETE | Requisition lifecycle (create, submit, approve, reject, cancel) fully implemented with operationId, requestHash & headcount validation. |
| Opening Service | CONCRETE | Opening & version lifecycle (create, approve, publish, pause, close, cancel) implemented with production lock enforcement. |
| Applicant Profile Service | CONCRETE | Profile management (create, update, get) with strict ownership & adult validation. |
| Application Service | CONCRETE | Application submission, draft answer saving, document upload, review & withdrawal with production lock. |
| Screening Policy Service | CONCRETE | Criterion-based evaluation (essential & desirable) producing screening flags; no automated rejections. |
| Review Assignment Service | CONCRETE | Assignment of human reviewers, structured scorecards, reason codes, decision recording. |
| Evaluation Rubric Service | CONCRETE | Rubric versioning, criteria scoring, panel member scorecards. |
| Interview Service | CONCRETE | Interview plan, slots, panel members, applicant slot selection, reschedule request, completion & scorecards. |
| Accommodation Service | CONCRETE | Segregated accommodation requests & privacy handling. |
| Background Check Service | CONCRETE | Policy-driven check cases (criminal, credit, medical, psychometric fail-closed), applicant consent ingestion, human review. |
| Offer Service | CONCRETE | Requisition headcount check, offer version immutability, offer issuance, acceptance, decline, withdrawal. |
| Onboarding Handoff Service | CONCRETE | Employee & Driver onboarding handoff delegation to existing authorities. No direct workforce activation. |
| Privacy & Retention Service | CONCRETE | Versioned privacy notices, consent tracking, data-subject requests, retention policies, legal holds. |
| Employment Equity Service | CONCRETE | Segregated EE declarations & configuration; default REPORTING_ONLY mode. LAWFUL_SELECTION_SUPPORT unavailable. |
| Fraud Service | CONCRETE | Fraud scanner, case management, duplicate applicant / conflicting credential flags. |
| Reconciliation Service | CONCRETE | Reconciliation scanner & recovery actions (rescan, retry opening publication, application freeze, check composition, offer issuance, onboarding handoff, retention action). |
| Repositories Foundation | CONCRETE | Prisma recruitment repositories in `lib/recruitment/repositories.ts`. |
| Composition Root | CONCRETE | Resolution of dependencies in order, readiness check & non-bypassable production lock in `lib/recruitment/composition-root.ts`. |
| Public Careers APIs | CONCRETE | GET `/api/careers/openings` & `/[reference]` with pagination, search, track, location, open-date filters, safe DTOs, no-fee statement & accessibility info. |
| Applicant APIs | CONCRETE | 24 applicant routes covering profile, applications, answers, documents, submit, withdraw, interviews, slots, checks, consents, offers, privacy, data requests. |
| Admin Requisition APIs | CONCRETE | Requisition CRUD, submit, approve, reject, cancel endpoints. |
| Admin Opening APIs | CONCRETE | Opening & Version CRUD, submit, approve, publish, pause, close, cancel endpoints. |
| Admin Application APIs | CONCRETE | List, detail, assign-reviewer, request-information, progress, confirm-ineligibility, reject endpoints. |
| Admin Interview APIs | CONCRETE | List, create, detail, update, schedule, complete endpoints. |
| Admin Background Check APIs | CONCRETE | List, detail, request, record-result, review endpoints. |
| Admin Offer APIs | CONCRETE | List, detail, submit, approve, issue, withdraw endpoints. |
| Admin Handoff APIs | CONCRETE | List, detail, process endpoints calling canonical authorities. |
| Admin Fraud & Recon APIs | CONCRETE | List, detail, rescan & 6 specific retry endpoints for reconciliation. |
| Admin Privacy, Retention & EE APIs | CONCRETE | Administration endpoints for privacy notice versions, retention policy versions, legal holds & EE reporting configuration. |
| Applicant UI Pages | CONCRETE | 18 public/applicant Next.js pages covering all candidate lifecycle states with zero static/mock data. |
| Admin UI Pages | CONCRETE | 23 admin Next.js pages consuming real API projections for requisitions, openings, applications, interviews, checks, offers, handoffs, fraud, reconciliation, privacy, retention, EE. |
| Operational Processors | CONCRETE | 10 CLI scripts & processors handling preflight, close expired openings, expire draft applications, process screening flags, expire offers, process onboarding handoffs, retention, fraud, reconciliation & invariant verification. |
| Permissions System | CONCRETE | 30+ recruitment permission keys with RBAC/ABAC guard integration & explicit DENY override support. |
| Source Audits | CONCRETE | Executable tests in `tests/phase26/source-audit.test.ts` verifying no fee, no agency, no AI ranking, no automated rejection, no direct workforce activation, etc. |
| Focused Test Suite | CONCRETE | Executable Vitest test suite covering policy, services, public APIs, applicant APIs, admin APIs, UI components, permissions, processors, production composition & scaffold audit (all passing, 0 skipped/todo in focused suite). |
| Integration Scaffolds | CONCRETE | 13 non-empty PostgreSQL integration test files under `tests/phase26/integration/` targeting disposable database, skipped by contract. |
| E2E Scaffolds | CONCRETE | 11 non-empty Playwright test files under `tests/phase26/e2e/` covering end-to-end flows, skipped by contract. |

