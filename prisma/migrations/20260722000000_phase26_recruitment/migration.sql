-- Phase 26 — Recruitment, Fair Selection & Workforce Onboarding Migration Script

-- Create Enums
CREATE TYPE "RecruitmentTrack" AS ENUM ('INTERNAL_EMPLOYEE', 'DRIVER_NETWORK');
CREATE TYPE "RecruitmentPositionFamilyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "RecruitmentRequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'FILLED', 'CLOSED');
CREATE TYPE "RecruitmentOpeningStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'PAUSED', 'CLOSED', 'CANCELLED', 'ARCHIVED');
CREATE TYPE "RecruitmentVersionStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'RETIRED');
CREATE TYPE "RecruitmentLocationPolicy" AS ENUM ('ON_SITE', 'HYBRID', 'REMOTE', 'SERVICE_REGION');
CREATE TYPE "RecruitmentCompensationDisplayPolicy" AS ENUM ('EXACT', 'RANGE', 'HIDDEN');
CREATE TYPE "RecruitmentQuestionType" AS ENUM ('SHORT_TEXT', 'LONG_TEXT', 'SINGLE_SELECT', 'MULTI_SELECT', 'BOOLEAN', 'DATE', 'NUMBER', 'ADDRESS_REGION', 'LICENCE_TYPE', 'FILE_REFERENCE', 'CONSENT', 'DECLARATION');
CREATE TYPE "RecruitmentQuestionClassification" AS ENUM ('IDENTITY', 'CONTACT', 'WORK_AUTHORIZATION', 'EXPERIENCE', 'QUALIFICATION', 'ROLE_ELIGIBILITY', 'DRIVER_CREDENTIAL', 'AVAILABILITY', 'ACCOMMODATION', 'EMPLOYMENT_EQUITY', 'CONSENT');
CREATE TYPE "RecruitmentProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RESTRICTED');
CREATE TYPE "RecruitmentWorkAuthorizationStatus" AS ENUM ('CITIZEN', 'PERMANENT_RESIDENT', 'CRITICAL_SKILLS_WORK_PERMIT', 'GENERAL_WORK_PERMIT', 'ASYLUM_SEEKER_PERMIT', 'SPONSORSHIP_REQUIRED', 'UNAUTHORIZED');
CREATE TYPE "RecruitmentAgeEligibilityStatus" AS ENUM ('VERIFIED_ADULT', 'UNDER_18_APPLICATION_NOT_SUPPORTED');
CREATE TYPE "RecruitmentApplicationState" AS ENUM ('DRAFT', 'SUBMITTED', 'COMPLETENESS_REVIEW', 'ELIGIBILITY_REVIEW', 'HUMAN_REVIEW', 'INTERVIEW', 'CONDITIONAL_CHECKS', 'OFFER_APPROVAL', 'OFFERED', 'OFFER_ACCEPTED', 'ONBOARDING_HANDOFF', 'COMPLETED', 'WITHDRAWN', 'INELIGIBLE_PENDING_CONFIRMATION', 'REJECTED', 'OFFER_DECLINED', 'OFFER_EXPIRED', 'OPENING_CANCELLED', 'DUPLICATE', 'FRAUD_REVIEW', 'RECONCILIATION_REQUIRED');
CREATE TYPE "RecruitmentConsentType" AS ENUM ('APPLICATION_PROCESSING_NOTICE_ACKNOWLEDGEMENT', 'REFERENCE_CHECK', 'BACKGROUND_CHECK', 'CREDIT_CHECK', 'TALENT_POOL', 'EMPLOYMENT_EQUITY_DECLARATION', 'ACCOMMODATION_PROCESSING');
CREATE TYPE "RecruitmentConsentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED');
CREATE TYPE "RecruitmentEEDeclarationStatus" AS ENUM ('DECLARED', 'DECLINED_TO_STATE', 'WITHDRAWN');
CREATE TYPE "RecruitmentEEUseMode" AS ENUM ('REPORTING_ONLY', 'LAWFUL_SELECTION_SUPPORT');
CREATE TYPE "RecruitmentEmployerDesignationStatus" AS ENUM ('UNKNOWN', 'NON_DESIGNATED', 'DESIGNATED');
CREATE TYPE "RecruitmentScreeningOutcome" AS ENUM ('PASS', 'REVIEW_REQUIRED', 'POTENTIAL_INELIGIBILITY', 'INCOMPLETE');
CREATE TYPE "RecruitmentReviewAssignmentType" AS ENUM ('INITIAL_REVIEW', 'HIRING_MANAGER_REVIEW', 'TECHNICAL_REVIEW', 'DRIVER_OPERATIONS_REVIEW', 'COMPLIANCE_REVIEW', 'OFFER_APPROVAL');
CREATE TYPE "RecruitmentReviewAssignmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CONFLICT_DECLARED', 'CANCELLED');
CREATE TYPE "RecruitmentRubricCriteriaCategory" AS ENUM ('ESSENTIAL_REQUIREMENT', 'DESIRABLE_REQUIREMENT', 'EXPERIENCE', 'ROLE_KNOWLEDGE', 'OPERATIONAL_JUDGEMENT', 'COMMUNICATION', 'SAFETY', 'DRIVER_CREDENTIAL_READINESS');
CREATE TYPE "RecruitmentDecisionType" AS ENUM ('PROGRESS', 'HOLD', 'REQUEST_INFORMATION', 'CONFIRM_INELIGIBILITY', 'REJECT', 'APPROVE_OFFER', 'CANCEL');
CREATE TYPE "RecruitmentInterviewType" AS ENUM ('PHONE', 'VIDEO', 'IN_PERSON', 'PRACTICAL', 'DRIVING_ASSESSMENT', 'TECHNICAL', 'PANEL');
CREATE TYPE "RecruitmentInterviewStatus" AS ENUM ('PLANNED', 'SLOTS_OFFERED', 'SCHEDULED', 'RESCHEDULE_REQUESTED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "RecruitmentScorecardDecision" AS ENUM ('STRONG_RECOMMEND', 'RECOMMEND', 'NEUTRAL', 'DO_NOT_RECOMMEND');
CREATE TYPE "RecruitmentAccommodationStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED_PROVIDED', 'CANNOT_ACCOMMODATE_SAFELY', 'WITHDRAWN');
CREATE TYPE "RecruitmentCheckType" AS ENUM ('IDENTITY', 'WORK_AUTHORIZATION', 'QUALIFICATION', 'EMPLOYMENT_REFERENCE', 'DRIVING_LICENCE', 'PROFESSIONAL_DRIVING_PERMIT', 'VEHICLE_DOCUMENT', 'ROLE_RELATED_CRIMINAL', 'ROLE_RELATED_CREDIT', 'ROLE_REQUIRED_MEDICAL_FITNESS', 'APPROVED_PSYCHOMETRIC');
CREATE TYPE "RecruitmentCheckCaseStatus" AS ENUM ('NOT_REQUIRED', 'CONSENT_REQUIRED', 'READY', 'REQUESTED', 'IN_PROGRESS', 'PASSED', 'REVIEW_REQUIRED', 'FAILED', 'EXPIRED', 'CANCELLED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "RecruitmentMedicalPolicyStatus" AS ENUM ('REQUIREMENT_SATISFIED', 'REVIEW_REQUIRED', 'REQUIREMENT_NOT_SATISFIED', 'EXPIRED');
CREATE TYPE "RecruitmentOfferStatus" AS ENUM ('DRAFT', 'UNDER_APPROVAL', 'APPROVED', 'ISSUED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN', 'SUPERSEDED');
CREATE TYPE "RecruitmentHandoffTargetType" AS ENUM ('EMPLOYEE', 'DRIVER');
CREATE TYPE "RecruitmentHandoffStatus" AS ENUM ('PENDING', 'READY', 'PROCESSING', 'COMPLETED', 'FAILED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "RecruitmentDataRequestType" AS ENUM ('ACCESS', 'CORRECTION', 'DELETION', 'RESTRICTION', 'CONSENT_WITHDRAWAL', 'TALENT_POOL_WITHDRAWAL');
CREATE TYPE "RecruitmentDataRequestStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'FULFILLED', 'REJECTED', 'CANCELLED');
CREATE TYPE "RecruitmentFraudOutcome" AS ENUM ('PASS', 'REVIEW', 'BLOCK_SUBMISSION', 'BLOCK_DECISION', 'BLOCK_OFFER', 'BLOCK_HANDOFF');
CREATE TYPE "RecruitmentReconciliationReason" AS ENUM ('OPENING_WITHOUT_APPROVED_REQUISITION', 'PUBLISHED_MUTABLE_OPENING_VERSION', 'APPLICATION_WITHOUT_FROZEN_VERSION', 'APPLICATION_SUBMITTED_INCOMPLETE', 'DECISION_WITHOUT_HUMAN_REVIEWER', 'REJECTION_WITHOUT_SCORECARD', 'INTERVIEW_WITHOUT_APPROVED_PLAN', 'CHECK_WITHOUT_POLICY', 'CHECK_WITHOUT_REQUIRED_CONSENT', 'OFFER_WITHOUT_APPROVAL', 'OFFER_EXCEEDS_APPROVED_HEADCOUNT', 'ACCEPTANCE_VERSION_MISMATCH', 'HANDOFF_WITHOUT_ACCEPTED_OFFER', 'EMPLOYEE_HANDOFF_MISMATCH', 'DRIVER_HANDOFF_MISMATCH', 'RETENTION_POLICY_MISMATCH', 'SPECIAL_INFORMATION_ACCESS_VIOLATION', 'APPLICATION_FAILURE');
CREATE TYPE "RecruitmentReconciliationStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED');

-- Create Tables & Indexes
CREATE TABLE "RecruitmentPositionFamily" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "recruitmentTrack" "RecruitmentTrack" NOT NULL,
  "departmentCode" TEXT,
  "status" "RecruitmentPositionFamilyStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentPositionFamily_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentPositionFamily_publicReference_key" ON "RecruitmentPositionFamily"("publicReference");
CREATE UNIQUE INDEX "RecruitmentPositionFamily_code_key" ON "RecruitmentPositionFamily"("code");
CREATE INDEX "RecruitmentPositionFamily_recruitmentTrack_idx" ON "RecruitmentPositionFamily"("recruitmentTrack");
CREATE INDEX "RecruitmentPositionFamily_status_idx" ON "RecruitmentPositionFamily"("status");

CREATE TABLE "RecruitmentRequisition" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "positionFamilyId" TEXT NOT NULL,
  "recruitmentTrack" "RecruitmentTrack" NOT NULL,
  "requestedHeadcount" INTEGER NOT NULL DEFAULT 1,
  "departmentCode" TEXT,
  "hiringManagerUserId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "locationPolicy" "RecruitmentLocationPolicy" NOT NULL,
  "primaryLocation" TEXT,
  "relationshipClassification" TEXT NOT NULL,
  "compensationCurrency" TEXT DEFAULT 'ZAR',
  "compensationMinimum" DECIMAL(12,2),
  "compensationMaximum" DECIMAL(12,2),
  "businessJustification" TEXT NOT NULL,
  "status" "RecruitmentRequisitionStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "rejectionReason" TEXT,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentRequisition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentRequisition_publicReference_key" ON "RecruitmentRequisition"("publicReference");
CREATE UNIQUE INDEX "RecruitmentRequisition_operationId_key" ON "RecruitmentRequisition"("operationId");
CREATE INDEX "RecruitmentRequisition_positionFamilyId_idx" ON "RecruitmentRequisition"("positionFamilyId");
CREATE INDEX "RecruitmentRequisition_status_idx" ON "RecruitmentRequisition"("status");
CREATE INDEX "RecruitmentRequisition_recruitmentTrack_idx" ON "RecruitmentRequisition"("recruitmentTrack");

CREATE TABLE "RecruitmentOpening" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "positionFamilyId" TEXT NOT NULL,
  "status" "RecruitmentOpeningStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentOpening_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentOpening_publicReference_key" ON "RecruitmentOpening"("publicReference");
CREATE UNIQUE INDEX "RecruitmentOpening_currentVersionId_key" ON "RecruitmentOpening"("currentVersionId");
CREATE INDEX "RecruitmentOpening_requisitionId_idx" ON "RecruitmentOpening"("requisitionId");
CREATE INDEX "RecruitmentOpening_status_idx" ON "RecruitmentOpening"("status");

CREATE TABLE "RecruitmentOpeningVersion" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "openingId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "RecruitmentVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "publicTitle" TEXT NOT NULL,
  "publicSummary" TEXT NOT NULL,
  "responsibilities" TEXT NOT NULL,
  "essentialCriteria" TEXT NOT NULL,
  "desirableCriteria" TEXT NOT NULL,
  "recruitmentTrack" "RecruitmentTrack" NOT NULL,
  "relationshipClassification" TEXT NOT NULL,
  "locationPolicy" "RecruitmentLocationPolicy" NOT NULL,
  "primaryLocation" TEXT,
  "serviceRegions" JSONB,
  "scheduleDescription" TEXT,
  "compensationDisplayPolicy" "RecruitmentCompensationDisplayPolicy" NOT NULL DEFAULT 'HIDDEN',
  "compensationMinimum" DECIMAL(12,2),
  "compensationMaximum" DECIMAL(12,2),
  "currency" TEXT DEFAULT 'ZAR',
  "applicationOpensAt" TIMESTAMP(3),
  "applicationClosesAt" TIMESTAMP(3),
  "applicationFormVersionId" TEXT NOT NULL,
  "screeningPolicyVersionId" TEXT NOT NULL,
  "evaluationRubricVersionId" TEXT NOT NULL,
  "backgroundCheckPolicyVersionId" TEXT NOT NULL,
  "privacyNoticeVersionId" TEXT NOT NULL,
  "retentionPolicyVersionId" TEXT NOT NULL,
  "employmentEquityPolicyReference" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentOpeningVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentOpeningVersion_publicReference_key" ON "RecruitmentOpeningVersion"("publicReference");
CREATE UNIQUE INDEX "RecruitmentOpeningVersion_openingId_versionNumber_key" ON "RecruitmentOpeningVersion"("openingId", "versionNumber");

CREATE TABLE "RecruitmentApplicationFormVersion" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "RecruitmentVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "recruitmentTrack" "RecruitmentTrack" NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  CONSTRAINT "RecruitmentApplicationFormVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentApplicationFormVersion_publicReference_key" ON "RecruitmentApplicationFormVersion"("publicReference");
CREATE UNIQUE INDEX "RecruitmentApplicationFormVersion_versionNumber_key" ON "RecruitmentApplicationFormVersion"("versionNumber");

CREATE TABLE "RecruitmentApplicationSectionVersion" (
  "id" TEXT NOT NULL,
  "formVersionId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "displayOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentApplicationSectionVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecruitmentApplicationQuestionVersion" (
  "id" TEXT NOT NULL,
  "sectionVersionId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "promptText" TEXT NOT NULL,
  "helpText" TEXT,
  "questionType" "RecruitmentQuestionType" NOT NULL,
  "classification" "RecruitmentQuestionClassification" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL,
  "options" JSONB,
  "validationRules" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentApplicationQuestionVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentApplicationQuestionVersion_sectionVersionId_questionKey_key" ON "RecruitmentApplicationQuestionVersion"("sectionVersionId", "questionKey");

CREATE TABLE "RecruitmentApplicantProfile" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "legalName" TEXT NOT NULL,
  "preferredName" TEXT,
  "primaryEmailReference" TEXT NOT NULL,
  "primaryPhoneReference" TEXT,
  "city" TEXT,
  "province" TEXT,
  "workAuthorizationStatus" "RecruitmentWorkAuthorizationStatus" NOT NULL,
  "ageEligibilityStatus" "RecruitmentAgeEligibilityStatus" NOT NULL DEFAULT 'VERIFIED_ADULT',
  "profileStatus" "RecruitmentProfileStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentApplicantProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentApplicantProfile_publicReference_key" ON "RecruitmentApplicantProfile"("publicReference");
CREATE UNIQUE INDEX "RecruitmentApplicantProfile_userId_key" ON "RecruitmentApplicantProfile"("userId");

CREATE TABLE "RecruitmentApplication" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "applicantProfileId" TEXT NOT NULL,
  "openingId" TEXT NOT NULL,
  "openingVersionId" TEXT NOT NULL,
  "applicationFormVersionId" TEXT NOT NULL,
  "status" "RecruitmentApplicationState" NOT NULL DEFAULT 'DRAFT',
  "currentStage" TEXT NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "offerAcceptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "currentDecisionId" TEXT,
  "optimisticVersion" INTEGER NOT NULL DEFAULT 1,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentApplication_publicReference_key" ON "RecruitmentApplication"("publicReference");
CREATE UNIQUE INDEX "RecruitmentApplication_operationId_key" ON "RecruitmentApplication"("operationId");

CREATE TABLE "RecruitmentSubmittedAnswer" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "questionKey" TEXT NOT NULL,
  "answerValue" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentSubmittedAnswer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentSubmittedAnswer_applicationId_questionKey_key" ON "RecruitmentSubmittedAnswer"("applicationId", "questionKey");

CREATE TABLE "RecruitmentApplicationDocument" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "documentCategory" TEXT NOT NULL,
  "mediaReference" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSizeBytes" INTEGER NOT NULL,
  "validationStatus" TEXT NOT NULL DEFAULT 'VALIDATED',
  "expiryDate" TIMESTAMP(3),
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentApplicationDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecruitmentPrivacyNoticeVersion" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "RecruitmentVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "purpose" TEXT NOT NULL,
  "dataCategories" JSONB NOT NULL,
  "recipientCategories" JSONB NOT NULL,
  "retentionSummary" TEXT NOT NULL,
  "crossBorderTransferSummary" TEXT,
  "applicantRights" TEXT NOT NULL,
  "complaintInformation" TEXT NOT NULL,
  "effectiveFrom" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentPrivacyNoticeVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentPrivacyNoticeVersion_publicReference_key" ON "RecruitmentPrivacyNoticeVersion"("publicReference");
CREATE UNIQUE INDEX "RecruitmentPrivacyNoticeVersion_versionNumber_key" ON "RecruitmentPrivacyNoticeVersion"("versionNumber");

CREATE TABLE "RecruitmentConsentRecord" (
  "id" TEXT NOT NULL,
  "applicantProfileId" TEXT NOT NULL,
  "applicationId" TEXT,
  "consentType" "RecruitmentConsentType" NOT NULL,
  "noticeVersionId" TEXT,
  "status" "RecruitmentConsentStatus" NOT NULL DEFAULT 'PENDING',
  "acceptedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "evidence" JSONB,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentConsentRecord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentConsentRecord_operationId_key" ON "RecruitmentConsentRecord"("operationId");

CREATE TABLE "RecruitmentEmploymentEquityDeclaration" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "applicantProfileId" TEXT NOT NULL,
  "applicationId" TEXT,
  "declarationStatus" "RecruitmentEEDeclarationStatus" NOT NULL DEFAULT 'DECLARED',
  "populationGroup" TEXT,
  "gender" TEXT,
  "disabilityDeclaration" BOOLEAN DEFAULT false,
  "citizenshipCategory" TEXT,
  "useMode" "RecruitmentEEUseMode" NOT NULL DEFAULT 'REPORTING_ONLY',
  "policyReference" TEXT,
  "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentEmploymentEquityDeclaration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentEmploymentEquityDeclaration_publicReference_key" ON "RecruitmentEmploymentEquityDeclaration"("publicReference");

CREATE TABLE "RecruitmentEmploymentEquityConfiguration" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "employerDesignationStatus" "RecruitmentEmployerDesignationStatus" NOT NULL DEFAULT 'UNKNOWN',
  "sectorClassification" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveUntil" TIMESTAMP(3),
  "approvedPolicyReference" TEXT,
  "reportingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "selectionSupportEnabled" BOOLEAN NOT NULL DEFAULT false,
  "approvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentEmploymentEquityConfiguration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentEmploymentEquityConfiguration_publicReference_key" ON "RecruitmentEmploymentEquityConfiguration"("publicReference");

CREATE TABLE "RecruitmentScreeningPolicyVersion" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "RecruitmentVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "openingTrack" "RecruitmentTrack" NOT NULL,
  "rules" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  CONSTRAINT "RecruitmentScreeningPolicyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentScreeningPolicyVersion_publicReference_key" ON "RecruitmentScreeningPolicyVersion"("publicReference");
CREATE UNIQUE INDEX "RecruitmentScreeningPolicyVersion_versionNumber_key" ON "RecruitmentScreeningPolicyVersion"("versionNumber");

CREATE TABLE "RecruitmentReviewAssignment" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "assignmentType" "RecruitmentReviewAssignmentType" NOT NULL,
  "status" "RecruitmentReviewAssignmentStatus" NOT NULL DEFAULT 'PENDING',
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "conflictDeclared" BOOLEAN NOT NULL DEFAULT false,
  "conflictDetails" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentReviewAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentReviewAssignment_publicReference_key" ON "RecruitmentReviewAssignment"("publicReference");

CREATE TABLE "RecruitmentEvaluationRubricVersion" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "RecruitmentVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "recruitmentTrack" "RecruitmentTrack" NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  CONSTRAINT "RecruitmentEvaluationRubricVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentEvaluationRubricVersion_publicReference_key" ON "RecruitmentEvaluationRubricVersion"("publicReference");
CREATE UNIQUE INDEX "RecruitmentEvaluationRubricVersion_versionNumber_key" ON "RecruitmentEvaluationRubricVersion"("versionNumber");

CREATE TABLE "RecruitmentRubricCriteria" (
  "id" TEXT NOT NULL,
  "rubricVersionId" TEXT NOT NULL,
  "category" "RecruitmentRubricCriteriaCategory" NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 1,
  "displayOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentRubricCriteria_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecruitmentInterviewPlan" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "openingVersionId" TEXT NOT NULL,
  "interviewType" "RecruitmentInterviewType" NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "scorecardVersionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentInterviewPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentInterviewPlan_publicReference_key" ON "RecruitmentInterviewPlan"("publicReference");

CREATE TABLE "RecruitmentInterviewSlot" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "openingId" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3) NOT NULL,
  "locationOrUrl" TEXT,
  "maxApplicants" INTEGER NOT NULL DEFAULT 1,
  "bookedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentInterviewSlot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentInterviewSlot_publicReference_key" ON "RecruitmentInterviewSlot"("publicReference");

CREATE TABLE "RecruitmentInterview" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "interviewPlanId" TEXT NOT NULL,
  "slotId" TEXT,
  "interviewType" "RecruitmentInterviewType" NOT NULL,
  "status" "RecruitmentInterviewStatus" NOT NULL DEFAULT 'PLANNED',
  "scheduledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "locationOrUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentInterview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentInterview_publicReference_key" ON "RecruitmentInterview"("publicReference");

CREATE TABLE "RecruitmentInterviewPanelMember" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "interviewerUserId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'PANEL_MEMBER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentInterviewPanelMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentInterviewPanelMember_interviewId_interviewerUserId_key" ON "RecruitmentInterviewPanelMember"("interviewId", "interviewerUserId");

CREATE TABLE "RecruitmentScorecard" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "interviewerUserId" TEXT NOT NULL,
  "decision" "RecruitmentScorecardDecision" NOT NULL,
  "structuredRatings" JSONB NOT NULL,
  "freeformEvidence" TEXT NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentScorecard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentScorecard_publicReference_key" ON "RecruitmentScorecard"("publicReference");
CREATE UNIQUE INDEX "RecruitmentScorecard_interviewId_interviewerUserId_key" ON "RecruitmentScorecard"("interviewId", "interviewerUserId");

CREATE TABLE "RecruitmentAccommodationRequest" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "stage" TEXT NOT NULL DEFAULT 'APPLICATION',
  "requestedDetail" TEXT NOT NULL,
  "status" "RecruitmentAccommodationStatus" NOT NULL DEFAULT 'REQUESTED',
  "providedNotes" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentAccommodationRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentAccommodationRequest_publicReference_key" ON "RecruitmentAccommodationRequest"("publicReference");

CREATE TABLE "RecruitmentBackgroundCheckPolicyVersion" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "RecruitmentVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "recruitmentTrack" "RecruitmentTrack" NOT NULL,
  "identityCheckRequired" BOOLEAN NOT NULL DEFAULT true,
  "workAuthorizationCheckRequired" BOOLEAN NOT NULL DEFAULT true,
  "qualificationCheckRequired" BOOLEAN NOT NULL DEFAULT false,
  "referenceCheckRequired" BOOLEAN NOT NULL DEFAULT false,
  "criminalCheckPolicy" TEXT NOT NULL DEFAULT 'ROLE_LIMITED',
  "creditCheckPolicy" TEXT NOT NULL DEFAULT 'ROLE_LIMITED',
  "licenceCheckPolicy" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "prdpCheckPolicy" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "medicalFitnessPolicy" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "psychometricPolicy" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentBackgroundCheckPolicyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentBackgroundCheckPolicyVersion_publicReference_key" ON "RecruitmentBackgroundCheckPolicyVersion"("publicReference");
CREATE UNIQUE INDEX "RecruitmentBackgroundCheckPolicyVersion_versionNumber_key" ON "RecruitmentBackgroundCheckPolicyVersion"("versionNumber");

CREATE TABLE "RecruitmentCheckCase" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "checkType" "RecruitmentCheckType" NOT NULL,
  "policyVersionId" TEXT NOT NULL,
  "status" "RecruitmentCheckCaseStatus" NOT NULL DEFAULT 'READY',
  "consentRecordId" TEXT,
  "requestedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "resultClassification" TEXT,
  "safeSummary" TEXT,
  "restrictedEvidenceReference" TEXT,
  "reviewedByUserId" TEXT,
  "reviewReason" TEXT,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentCheckCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentCheckCase_publicReference_key" ON "RecruitmentCheckCase"("publicReference");
CREATE UNIQUE INDEX "RecruitmentCheckCase_operationId_key" ON "RecruitmentCheckCase"("operationId");

CREATE TABLE "RecruitmentDecision" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "decisionType" "RecruitmentDecisionType" NOT NULL,
  "stage" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "rubricVersionId" TEXT,
  "scorecardReference" TEXT,
  "internalReasonCode" TEXT NOT NULL,
  "applicantFacingReasonCategory" TEXT NOT NULL,
  "safeInternalSummary" TEXT,
  "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentDecision_publicReference_key" ON "RecruitmentDecision"("publicReference");
CREATE UNIQUE INDEX "RecruitmentDecision_operationId_key" ON "RecruitmentDecision"("operationId");

CREATE TABLE "RecruitmentOffer" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "status" "RecruitmentOfferStatus" NOT NULL DEFAULT 'DRAFT',
  "currentVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentOffer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentOffer_publicReference_key" ON "RecruitmentOffer"("publicReference");
CREATE UNIQUE INDEX "RecruitmentOffer_currentVersionId_key" ON "RecruitmentOffer"("currentVersionId");

CREATE TABLE "RecruitmentOfferVersion" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "RecruitmentVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "roleTitle" TEXT NOT NULL,
  "recruitmentTrack" "RecruitmentTrack" NOT NULL,
  "relationshipClassification" TEXT NOT NULL,
  "departmentCode" TEXT,
  "location" TEXT,
  "startDate" TIMESTAMP(3),
  "compensationCurrency" TEXT DEFAULT 'ZAR',
  "compensationAmount" DECIMAL(12,2),
  "compensationPeriod" TEXT DEFAULT 'MONTHLY',
  "conditions" JSONB NOT NULL,
  "expiryAt" TIMESTAMP(3) NOT NULL,
  "documentReference" TEXT,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentOfferVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentOfferVersion_publicReference_key" ON "RecruitmentOfferVersion"("publicReference");
CREATE UNIQUE INDEX "RecruitmentOfferVersion_offerId_versionNumber_key" ON "RecruitmentOfferVersion"("offerId", "versionNumber");

CREATE TABLE "RecruitmentOnboardingHandoff" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "offerVersionId" TEXT NOT NULL,
  "applicantProfileId" TEXT NOT NULL,
  "targetType" "RecruitmentHandoffTargetType" NOT NULL,
  "status" "RecruitmentHandoffStatus" NOT NULL DEFAULT 'PENDING',
  "employeeReference" TEXT,
  "driverReference" TEXT,
  "requestedAt" TIMESTAMP(3),
  "processedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "safeFailureReason" TEXT,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "offerId" TEXT,
  CONSTRAINT "RecruitmentOnboardingHandoff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentOnboardingHandoff_publicReference_key" ON "RecruitmentOnboardingHandoff"("publicReference");
CREATE UNIQUE INDEX "RecruitmentOnboardingHandoff_operationId_key" ON "RecruitmentOnboardingHandoff"("operationId");

CREATE TABLE "RecruitmentRetentionPolicyVersion" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "RecruitmentVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "draftApplicationRetentionDays" INTEGER NOT NULL DEFAULT 30,
  "unsuccessfulApplicationRetentionDays" INTEGER NOT NULL DEFAULT 365,
  "withdrawnApplicationRetentionDays" INTEGER NOT NULL DEFAULT 90,
  "successfulApplicationRecruitmentRetentionDays" INTEGER NOT NULL DEFAULT 1825,
  "talentPoolRetentionDays" INTEGER NOT NULL DEFAULT 365,
  "checkEvidenceRetentionDays" INTEGER NOT NULL DEFAULT 180,
  "auditRetentionDays" INTEGER NOT NULL DEFAULT 2555,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "effectiveFrom" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentRetentionPolicyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentRetentionPolicyVersion_publicReference_key" ON "RecruitmentRetentionPolicyVersion"("publicReference");
CREATE UNIQUE INDEX "RecruitmentRetentionPolicyVersion_versionNumber_key" ON "RecruitmentRetentionPolicyVersion"("versionNumber");

CREATE TABLE "RecruitmentApplicantDataRequest" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "applicantProfileId" TEXT NOT NULL,
  "applicationId" TEXT,
  "requestType" "RecruitmentDataRequestType" NOT NULL,
  "status" "RecruitmentDataRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "fulfilledAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "evidence" JSONB,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentApplicantDataRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentApplicantDataRequest_publicReference_key" ON "RecruitmentApplicantDataRequest"("publicReference");
CREATE UNIQUE INDEX "RecruitmentApplicantDataRequest_operationId_key" ON "RecruitmentApplicantDataRequest"("operationId");

CREATE TABLE "RecruitmentFraudCase" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "fraudCheckType" TEXT NOT NULL,
  "outcome" "RecruitmentFraudOutcome" NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "safeSummary" TEXT NOT NULL,
  "evidence" JSONB,
  "reviewedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentFraudCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentFraudCase_publicReference_key" ON "RecruitmentFraudCase"("publicReference");

CREATE TABLE "RecruitmentReconciliationCase" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "requisitionId" TEXT,
  "openingId" TEXT,
  "openingVersionId" TEXT,
  "applicantProfileId" TEXT,
  "applicationId" TEXT,
  "interviewId" TEXT,
  "checkCaseId" TEXT,
  "offerId" TEXT,
  "handoffId" TEXT,
  "reason" "RecruitmentReconciliationReason" NOT NULL,
  "status" "RecruitmentReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "safeSummary" TEXT NOT NULL,
  "safeEvidence" JSONB,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentReconciliationCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RecruitmentReconciliationCase_publicReference_key" ON "RecruitmentReconciliationCase"("publicReference");

CREATE TABLE "RecruitmentEventIntent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateReference" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "safePayload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecruitmentEventIntent_pkey" PRIMARY KEY ("id")
);

-- Foreign Key Constraints
ALTER TABLE "RecruitmentRequisition" ADD CONSTRAINT "RecruitmentRequisition_positionFamilyId_fkey" FOREIGN KEY ("positionFamilyId") REFERENCES "RecruitmentPositionFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentRequisition" ADD CONSTRAINT "RecruitmentRequisition_hiringManagerUserId_fkey" FOREIGN KEY ("hiringManagerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentRequisition" ADD CONSTRAINT "RecruitmentRequisition_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentRequisition" ADD CONSTRAINT "RecruitmentRequisition_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentOpening" ADD CONSTRAINT "RecruitmentOpening_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "RecruitmentRequisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOpening" ADD CONSTRAINT "RecruitmentOpening_positionFamilyId_fkey" FOREIGN KEY ("positionFamilyId") REFERENCES "RecruitmentPositionFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOpening" ADD CONSTRAINT "RecruitmentOpening_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "RecruitmentOpeningVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentOpeningVersion" ADD CONSTRAINT "RecruitmentOpeningVersion_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "RecruitmentOpening"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOpeningVersion" ADD CONSTRAINT "RecruitmentOpeningVersion_applicationFormVersionId_fkey" FOREIGN KEY ("applicationFormVersionId") REFERENCES "RecruitmentApplicationFormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOpeningVersion" ADD CONSTRAINT "RecruitmentOpeningVersion_screeningPolicyVersionId_fkey" FOREIGN KEY ("screeningPolicyVersionId") REFERENCES "RecruitmentScreeningPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOpeningVersion" ADD CONSTRAINT "RecruitmentOpeningVersion_evaluationRubricVersionId_fkey" FOREIGN KEY ("evaluationRubricVersionId") REFERENCES "RecruitmentEvaluationRubricVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOpeningVersion" ADD CONSTRAINT "RecruitmentOpeningVersion_backgroundCheckPolicyVersionId_fkey" FOREIGN KEY ("backgroundCheckPolicyVersionId") REFERENCES "RecruitmentBackgroundCheckPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOpeningVersion" ADD CONSTRAINT "RecruitmentOpeningVersion_privacyNoticeVersionId_fkey" FOREIGN KEY ("privacyNoticeVersionId") REFERENCES "RecruitmentPrivacyNoticeVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOpeningVersion" ADD CONSTRAINT "RecruitmentOpeningVersion_retentionPolicyVersionId_fkey" FOREIGN KEY ("retentionPolicyVersionId") REFERENCES "RecruitmentRetentionPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecruitmentApplicationSectionVersion" ADD CONSTRAINT "RecruitmentApplicationSectionVersion_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "RecruitmentApplicationFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentApplicationQuestionVersion" ADD CONSTRAINT "RecruitmentApplicationQuestionVersion_sectionVersionId_fkey" FOREIGN KEY ("sectionVersionId") REFERENCES "RecruitmentApplicationSectionVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecruitmentApplicantProfile" ADD CONSTRAINT "RecruitmentApplicantProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecruitmentApplication" ADD CONSTRAINT "RecruitmentApplication_applicantProfileId_fkey" FOREIGN KEY ("applicantProfileId") REFERENCES "RecruitmentApplicantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentApplication" ADD CONSTRAINT "RecruitmentApplication_openingId_fkey" FOREIGN KEY ("openingId") REFERENCES "RecruitmentOpening"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentApplication" ADD CONSTRAINT "RecruitmentApplication_openingVersionId_fkey" FOREIGN KEY ("openingVersionId") REFERENCES "RecruitmentOpeningVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentApplication" ADD CONSTRAINT "RecruitmentApplication_applicationFormVersionId_fkey" FOREIGN KEY ("applicationFormVersionId") REFERENCES "RecruitmentApplicationFormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecruitmentSubmittedAnswer" ADD CONSTRAINT "RecruitmentSubmittedAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentApplicationDocument" ADD CONSTRAINT "RecruitmentApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecruitmentConsentRecord" ADD CONSTRAINT "RecruitmentConsentRecord_applicantProfileId_fkey" FOREIGN KEY ("applicantProfileId") REFERENCES "RecruitmentApplicantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentConsentRecord" ADD CONSTRAINT "RecruitmentConsentRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecruitmentConsentRecord" ADD CONSTRAINT "RecruitmentConsentRecord_noticeVersionId_fkey" FOREIGN KEY ("noticeVersionId") REFERENCES "RecruitmentPrivacyNoticeVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentEmploymentEquityDeclaration" ADD CONSTRAINT "RecruitmentEmploymentEquityDeclaration_applicantProfileId_fkey" FOREIGN KEY ("applicantProfileId") REFERENCES "RecruitmentApplicantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentEmploymentEquityDeclaration" ADD CONSTRAINT "RecruitmentEmploymentEquityDeclaration_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentReviewAssignment" ADD CONSTRAINT "RecruitmentReviewAssignment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentReviewAssignment" ADD CONSTRAINT "RecruitmentReviewAssignment_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecruitmentRubricCriteria" ADD CONSTRAINT "RecruitmentRubricCriteria_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "RecruitmentEvaluationRubricVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecruitmentInterviewPlan" ADD CONSTRAINT "RecruitmentInterviewPlan_openingVersionId_fkey" FOREIGN KEY ("openingVersionId") REFERENCES "RecruitmentOpeningVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentInterview" ADD CONSTRAINT "RecruitmentInterview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentInterview" ADD CONSTRAINT "RecruitmentInterview_interviewPlanId_fkey" FOREIGN KEY ("interviewPlanId") REFERENCES "RecruitmentInterviewPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentInterview" ADD CONSTRAINT "RecruitmentInterview_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "RecruitmentInterviewSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentInterviewPanelMember" ADD CONSTRAINT "RecruitmentInterviewPanelMember_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "RecruitmentInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentScorecard" ADD CONSTRAINT "RecruitmentScorecard_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "RecruitmentInterview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecruitmentAccommodationRequest" ADD CONSTRAINT "RecruitmentAccommodationRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RecruitmentCheckCase" ADD CONSTRAINT "RecruitmentCheckCase_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentCheckCase" ADD CONSTRAINT "RecruitmentCheckCase_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "RecruitmentBackgroundCheckPolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentCheckCase" ADD CONSTRAINT "RecruitmentCheckCase_consentRecordId_fkey" FOREIGN KEY ("consentRecordId") REFERENCES "RecruitmentConsentRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentDecision" ADD CONSTRAINT "RecruitmentDecision_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentDecision" ADD CONSTRAINT "RecruitmentDecision_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RecruitmentOffer" ADD CONSTRAINT "RecruitmentOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOffer" ADD CONSTRAINT "RecruitmentOffer_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "RecruitmentOfferVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentOfferVersion" ADD CONSTRAINT "RecruitmentOfferVersion_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "RecruitmentOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOfferVersion" ADD CONSTRAINT "RecruitmentOfferVersion_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentOnboardingHandoff" ADD CONSTRAINT "RecruitmentOnboardingHandoff_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOnboardingHandoff" ADD CONSTRAINT "RecruitmentOnboardingHandoff_offerVersionId_fkey" FOREIGN KEY ("offerVersionId") REFERENCES "RecruitmentOfferVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOnboardingHandoff" ADD CONSTRAINT "RecruitmentOnboardingHandoff_applicantProfileId_fkey" FOREIGN KEY ("applicantProfileId") REFERENCES "RecruitmentApplicantProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecruitmentOnboardingHandoff" ADD CONSTRAINT "RecruitmentOnboardingHandoff_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "RecruitmentOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentRetentionPolicyVersion" ADD CONSTRAINT "RecruitmentRetentionPolicyVersion_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentApplicantDataRequest" ADD CONSTRAINT "RecruitmentApplicantDataRequest_applicantProfileId_fkey" FOREIGN KEY ("applicantProfileId") REFERENCES "RecruitmentApplicantProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecruitmentApplicantDataRequest" ADD CONSTRAINT "RecruitmentApplicantDataRequest_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RecruitmentFraudCase" ADD CONSTRAINT "RecruitmentFraudCase_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RecruitmentApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
