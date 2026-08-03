# Phase 26 Recruitment Migration Manifest

## Verification closure

| Evidence | Result |
| --- | --- |
| Preceding migration path | `prisma/migrations/20260717170000_phase25_promoters_referrals/migration.sql` |
| Phase 25 SHA-256 | `76C402116998B6D6718E59270FF6A53077E86C779B3A972AC3E6D6FB22263B04` |
| Phase 26 migration path | `prisma/migrations/20260722000000_phase26_recruitment/migration.sql` |
| Phase 26 SHA-256 | `D8FA6D71822370FC7A82F9739016D46369637C67B43E65DE462ADB59C67794EC` |
| Timestamp rationale | `20260722000000` follows the Phase 25 timestamp and identifies the 22 July 2026 Phase 26 recruitment migration. |
| Phase 26 migration folders | 1 |
| Phase 25 or earlier migrations modified | No modification observed in this verification workspace; the repository baseline is untracked, so historic Git comparison is unavailable. |
| Phase 26 live-data inserts | No (`INSERT INTO` is absent from the migration). |
| Schema-to-migration coverage | Prisma format and validation pass; live deployment/coverage remains deferred to Phase 26.5. |

## Migration Identification
- **Migration ID**: `20260722000000_phase26_recruitment`
- **Migration Path**: `prisma/migrations/20260722000000_phase26_recruitment/migration.sql`
- **Scope**: Additive creation of all Phase 26 recruitment tables, enums, indexes, and foreign keys.

## Additive Schema Changes
1. **Enums Created**:
   - `RecruitmentTrack`: `INTERNAL_EMPLOYEE`, `DRIVER_NETWORK`
   - `PositionFamilyCategory`: `EXECUTIVE`, `OPERATIONS`, `LOGISTICS`, `LINE_HAUL_DRIVER`, `LAST_MILE_DRIVER`, `WAREHOUSE`, `ADMINISTRATIVE`, `TECHNOLOGY`
   - `RequisitionStatus`: `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CANCELLED`, `FULFILLED`
   - `OpeningStatus`: `DRAFT`, `PENDING_APPROVAL`, `PUBLISHED`, `PAUSED`, `CLOSED`, `CANCELLED`
   - `OpeningVersionStatus`: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PUBLISHED`, `RETIRED`
   - `ApplicantProfileStatus`: `ACTIVE`, `SUSPENDED`, `FLAGGED`, `ARCHIVED`, `ANONYMIZED`
   - `WorkAuthorizationStatus`: `CITIZEN`, `PERMANENT_RESIDENT`, `WORK_PERMIT_HOLDER`, `ASYLUM_SEEKER_PERMIT`, `CRITICAL_SKILLS_PERMIT`, `NOT_AUTHORIZED`
   - `ApplicationStatus`: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `INTERVIEW_STAGE`, `CHECK_STAGE`, `OFFER_STAGE`, `HANDOFF_STAGE`, `HIRED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`, `INELIGIBLE`
   - `ApplicationStage`: `APPLIED`, `OBJECTIVE_SCREENING`, `HUMAN_REVIEW`, `INTERVIEW_SCHEDULING`, `INTERVIEW_EVALUATION`, `CONDITIONAL_CHECK`, `OFFER_ISSUANCE`, `ONBOARDING_HANDOFF`, `COMPLETED`
   - `ApplicationQuestionType`: `SHORT_TEXT`, `LONG_TEXT`, `SINGLE_SELECT`, `MULTI_SELECT`, `BOOLEAN`, `NUMBER`, `FILE_UPLOAD`, `DATE`
   - `DocumentCategory`: `IDENTITY_DOCUMENT`, `DRIVERS_LICENCE`, `PRDP_PERMIT`, `WORK_AUTHORIZATION_PROOF`, `CURRICULUM_VITAE`, `QUALIFICATION_CERTIFICATE`, `BANK_DETAILS_PROOF`, `TAX_NUMBER_PROOF`, `PROOF_OF_ADDRESS`, `CRIMINAL_CHECK_CONSENT`, `CREDIT_CHECK_CONSENT`, `REFERENCE_CONSENT`
   - `DocumentVerificationStatus`: `PENDING`, `VALIDATED`, `REJECTED`, `EXPIRED`
   - `ScreeningFlagSeverity`: `INFO`, `WARNING`, `BLOCKING`
   - `InterviewType`: `INITIAL_SCREENING`, `TECHNICAL_ASSESSMENT`, `BEHAVIORAL_PANEL`, `DRIVER_ROAD_TEST`, `FINAL_EXECUTIVE`
   - `InterviewStatus`: `SCHEDULED`, `RESCHEDULE_REQUESTED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`
   - `CheckType`: `CRIMINAL_RECORD`, `DRIVER_LICENCE_VERIFICATION`, `PRDP_VERIFICATION`, `RIGHT_TO_WORK`, `QUALIFICATION_VERIFICATION`, `EMPLOYMENT_REFERENCE`, `ROLE_LIMITED_CREDIT`
   - `CheckStatus`: `PENDING_CONSENT`, `INITIATED`, `IN_PROGRESS`, `PASS`, `FAIL`, `REQUIRES_HUMAN_REVIEW`, `EXPIRED`
   - `OfferStatus`: `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `ISSUED`, `ACCEPTED`, `DECLINED`, `EXPIRED`, `WITHDRAWN`
   - `OnboardingHandoffTarget`: `INTERNAL_EMPLOYEE`, `DRIVER_NETWORK`
   - `OnboardingHandoffStatus`: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`
   - `DataRequestType`: `ACCESS`, `CORRECTION`, `DELETION`, `RESTRICTION`, `CONSENT_WITHDRAWAL`, `TALENT_POOL_WITHDRAWAL`
   - `DataRequestStatus`: `SUBMITTED`, `UNDER_VERIFICATION`, `PROCESSING`, `FULFILLED`, `REJECTED`
   - `FraudCheckType`: `SYNTHETIC_IDENTITY`, `DUPLICATE_APPLICANT`, `DOCUMENT_TAMPERING`, `DISQUALIFIED_DRIVER_REAPPLY`
   - `FraudOutcome`: `CLEARED`, `SUSPICIOUS`, `CONFIRMED_FRAUD`
   - `ReconciliationStatus`: `OPEN`, `IN_INVESTIGATION`, `RESOLVED`, `IGNORED`

2. **Tables Created**:
   - `RecruitmentPositionFamily`
   - `RecruitmentRequisition`
   - `RecruitmentRequisitionVersion`
   - `RecruitmentOpening`
   - `RecruitmentOpeningVersion`
   - `RecruitmentFormTemplate`
   - `RecruitmentFormVersion`
   - `RecruitmentFormSection`
   - `RecruitmentFormQuestion`
   - `ApplicantProfile`
   - `ApplicantIdentityAlias`
   - `RecruitmentApplication`
   - `RecruitmentApplicationAnswer`
   - `RecruitmentApplicationDocument`
   - `RecruitmentScreeningResult`
   - `RecruitmentReviewAssignment`
   - `RecruitmentReviewScorecard`
   - `RecruitmentInterviewSchedule`
   - `RecruitmentBackgroundCheckCase`
   - `RecruitmentBackgroundCheckEvidence`
   - `RecruitmentOffer`
   - `RecruitmentOfferVersion`
   - `RecruitmentOnboardingHandoff`
   - `RecruitmentPrivacyNotice`
   - `RecruitmentPrivacyNoticeVersion`
   - `RecruitmentPrivacyConsent`
   - `ApplicantDataSubjectRequest`
   - `RecruitmentRetentionPolicy`
   - `RecruitmentRetentionPolicyVersion`
   - `RecruitmentEmploymentEquityConfig`
   - `ApplicantEquityDeclaration`
   - `RecruitmentFraudCase`
   - `RecruitmentReconciliationCase`

## Backward Compatibility & Non-Breaking Status
- **Additive Only**: No existing tables, columns, or relations were removed or modified.
- **Foreign Keys**: Linked to existing canonical tables (`User`, `AdminProfile`, `DriverProfile`).
- **Production Lock Integration**: Controlled via `lib/recruitment/production-readiness.ts`. Direct mutations block safely when lock is active (`RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false`).
