-- Phase 25 is additive: it creates no promoter accounts, programs, attributions, qualifications, earnings, wallet credits, or withdrawals.
-- Compatibility: historical legacy PromoterProfile/referral records and Phase 9/13/14 records remain untouched.

CREATE TYPE "PromoterAccountStatus" AS ENUM ('APPLIED', 'UNDER_REVIEW', 'CHANGES_REQUIRED', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'REJECTED');
CREATE TYPE "PromoterIdentityStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "PromoterReadinessStatus" AS ENUM ('PENDING', 'READY', 'RESTRICTED');
CREATE TYPE "PromoterAgreementStatus" AS ENUM ('REQUIRED', 'ACCEPTED', 'EXPIRED');
CREATE TYPE "PromoterAgreementVersionStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'RETIRED');
CREATE TYPE "PromoterProgramTargetType" AS ENUM ('CUSTOMER', 'BUSINESS_CUSTOMER', 'STORE');
CREATE TYPE "PromoterProgramStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'ENDED', 'RETIRED', 'REJECTED');
CREATE TYPE "PromoterProgramVersionStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'PAUSED', 'ENDED', 'REJECTED', 'RETIRED');
CREATE TYPE "PromoterEnrollmentStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'ENDED', 'REJECTED');
CREATE TYPE "PromoterChannelType" AS ENUM ('PERSONAL_LINK', 'SOCIAL_MEDIA', 'WEBSITE', 'OFFLINE_EVENT', 'PRINTED_MATERIAL', 'DIRECT_BUSINESS_OUTREACH', 'OTHER_APPROVED');
CREATE TYPE "PromoterChannelStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "PromoterReferralCodeStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'EXPIRED', 'SUSPENDED');
CREATE TYPE "PromoterTouchType" AS ENUM ('LINK_VISIT', 'CODE_ENTRY', 'REGISTRATION_START', 'REGISTRATION_COMPLETE');
CREATE TYPE "PromoterTouchValidityStatus" AS ENUM ('PENDING', 'VALID', 'SUSPECT', 'INVALID');
CREATE TYPE "PromoterAttributionSubjectType" AS ENUM ('CUSTOMER', 'BUSINESS_CUSTOMER', 'STORE');
CREATE TYPE "PromoterAttributionStatus" AS ENUM ('ATTRIBUTED', 'PENDING_QUALIFICATION', 'QUALIFIED', 'EXPIRED', 'INVALIDATED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "PromoterAttributionModel" AS ENUM ('FIRST_VALID_ACQUISITION_TOUCH');
CREATE TYPE "PromoterQualifyingEventType" AS ENUM ('CUSTOMER_FIRST_COMPLETED_SETTLED_COURIER_ORDER', 'CUSTOMER_FIRST_COMPLETED_SETTLED_MARKETPLACE_ORDER', 'BUSINESS_FIRST_COMPLETED_SETTLED_ORDER', 'STORE_FIRST_SETTLED_MARKETPLACE_ORDER');
CREATE TYPE "PromoterQualificationStatus" AS ENUM ('PENDING', 'EVIDENCE_OBSERVED', 'QUALIFIED_HELD', 'RELEASABLE', 'RELEASED', 'INVALIDATED', 'REVERSED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "PromoterEarningStatus" AS ENUM ('PENDING', 'ACCRUED_HELD', 'PAYABLE', 'PARTIALLY_WITHDRAWN', 'WITHDRAWN', 'REVERSED', 'PARTIALLY_REVERSED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "PromoterFraudCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACTION_REQUIRED', 'CLEARED', 'CONFIRMED', 'CLOSED');
CREATE TYPE "PromoterCasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "PromoterFraudReason" AS ENUM ('SELF_REFERRAL', 'DUPLICATE_IDENTITY', 'REFERRAL_RING', 'COOKIE_STUFFING', 'CODE_INJECTION', 'PAYMENT_INSTRUMENT_REUSE', 'PAYOUT_ACCOUNT_REUSE', 'AUTOMATED_TRAFFIC', 'INTERNAL_ABUSE', 'OTHER');
CREATE TYPE "PromoterDisputeCategory" AS ENUM ('MISSING_ATTRIBUTION', 'QUALIFICATION_STATUS', 'MISSING_EARNING', 'REVERSAL');
CREATE TYPE "PromoterDisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'CLOSED');
CREATE TYPE "PromoterMarketingAssetType" AS ENUM ('SOCIAL_IMAGE', 'PRINT_FLYER', 'QR_CODE', 'TEXT_TEMPLATE', 'BUSINESS_OUTREACH_TEMPLATE', 'PROGRAM_GUIDE');
CREATE TYPE "PromoterMarketingAssetStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');
CREATE TYPE "PromoterReconciliationReason" AS ENUM ('ATTRIBUTION_WITHOUT_VALID_TOUCH', 'DUPLICATE_ATTRIBUTION', 'ATTRIBUTION_SUBJECT_MISMATCH', 'ATTRIBUTION_AFTER_SUBJECT_CREATION', 'QUALIFICATION_WITHOUT_ATTRIBUTION', 'DUPLICATE_QUALIFICATION', 'QUALIFYING_EVENT_MISMATCH', 'QUALIFICATION_AFTER_REFUND', 'COMMISSION_ACCRUAL_MISSING', 'DUPLICATE_COMMISSION_ACCRUAL', 'EARNING_AMOUNT_MISMATCH', 'RELEASE_BEFORE_HOLD_END', 'PAYABLE_WITHOUT_COMPLIANCE', 'REVERSAL_MISSING', 'WALLET_LEDGER_MISMATCH', 'WITHDRAWAL_EVIDENCE_MISMATCH', 'SELF_REFERRAL_SUSPECTED', 'REFERRAL_RING_SUSPECTED', 'APPLICATION_FAILURE');
CREATE TYPE "PromoterReconciliationStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED');
CREATE TYPE "PromoterEventIntentType" AS ENUM ('PROMOTER_APPLICATION_SUBMITTED', 'PROMOTER_CHANGES_REQUIRED', 'PROMOTER_APPROVED', 'PROMOTER_ACTIVATED', 'PROMOTER_SUSPENDED', 'PROMOTER_TERMINATED', 'PROMOTER_PROGRAM_ENROLLED', 'PROMOTER_ATTRIBUTION_CREATED', 'PROMOTER_QUALIFICATION_PENDING', 'PROMOTER_QUALIFICATION_CONFIRMED', 'PROMOTER_EARNING_ACCRUED', 'PROMOTER_EARNING_RELEASED', 'PROMOTER_EARNING_REVERSED', 'PROMOTER_WITHDRAWAL_REQUESTED', 'PROMOTER_FRAUD_REVIEW_REQUIRED', 'PROMOTER_RECONCILIATION_REQUIRED', 'PROMOTER_DISPUTE_UPDATED');

CREATE TABLE "PromoterAccount" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterAccount_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PromoterAccountStatus" NOT NULL DEFAULT 'APPLIED',
    "legalName" TEXT NOT NULL,
    "displayName" TEXT,
    "identityStatus" "PromoterIdentityStatus" NOT NULL DEFAULT 'PENDING',
    "taxProfileStatus" "PromoterReadinessStatus" NOT NULL DEFAULT 'PENDING',
    "payoutReadinessStatus" "PromoterReadinessStatus" NOT NULL DEFAULT 'PENDING',
    "agreementStatus" "PromoterAgreementStatus" NOT NULL DEFAULT 'REQUIRED',
    "complianceEvidence" JSONB,
    "operationId" TEXT,
    "requestHash" TEXT,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "PromoterAgreementVersion" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterAgreementVersion_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "PromoterAgreementVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "termsContent" TEXT NOT NULL,
    "disclosureRequirements" TEXT NOT NULL,
    "prohibitedConduct" TEXT NOT NULL,
    "privacyTerms" TEXT NOT NULL,
    "taxNotice" TEXT NOT NULL,
    "terminationPolicy" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PromoterAgreementAcceptance" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterAgreementAcceptance_pkey" PRIMARY KEY ("id"),
    "promoterAccountId" TEXT NOT NULL,
    "agreementVersionId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptanceEvidence" JSONB NOT NULL,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL
);

CREATE TABLE "PromoterProgram" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterProgram_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetType" "PromoterProgramTargetType" NOT NULL,
    "status" "PromoterProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "PromoterProgramVersion" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterProgramVersion_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "PromoterProgramVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "attributionModel" "PromoterAttributionModel" NOT NULL DEFAULT 'FIRST_VALID_ACQUISITION_TOUCH',
    "attributionWindowDays" INTEGER NOT NULL,
    "qualifyingEventType" "PromoterQualifyingEventType" NOT NULL,
    "qualificationHoldDays" INTEGER NOT NULL,
    "commissionPlanVersionId" TEXT NOT NULL,
    "maximumQualificationsPerPromoter" INTEGER,
    "maximumQualificationsPerDay" INTEGER,
    "maximumQualificationsPerSubject" INTEGER,
    "geographicPolicyVersion" TEXT NOT NULL,
    "fraudPolicyVersion" TEXT NOT NULL,
    "disclosurePolicyVersion" TEXT NOT NULL,
    "reversalPolicyVersion" TEXT NOT NULL,
    "legalTermsVersion" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PromoterEnrollment" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterEnrollment_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "promoterAccountId" TEXT NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "status" "PromoterEnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspendedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "PromoterChannel" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterChannel_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "promoterAccountId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channelType" "PromoterChannelType" NOT NULL,
    "status" "PromoterChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3)
);

CREATE TABLE "PromoterReferralCode" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterReferralCode_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "promoterAccountId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "channelId" TEXT,
    "codeHmac" TEXT NOT NULL,
    "codeFingerprint" TEXT NOT NULL,
    "maskedDisplay" TEXT NOT NULL,
    "status" "PromoterReferralCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "maximumAttributions" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3)
);

CREATE TABLE "PromoterTouch" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterTouch_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "promoterAccountId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "referralCodeId" TEXT,
    "channelId" TEXT,
    "touchType" "PromoterTouchType" NOT NULL,
    "validityStatus" "PromoterTouchValidityStatus" NOT NULL DEFAULT 'PENDING',
    "sessionFingerprint" TEXT,
    "networkRiskFingerprint" TEXT,
    "deviceClass" TEXT,
    "destinationType" TEXT NOT NULL,
    "destinationReference" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "safeEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PromoterAttribution" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterAttribution_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "promoterAccountId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "touchId" TEXT NOT NULL,
    "subjectType" "PromoterAttributionSubjectType" NOT NULL,
    "customerUserId" TEXT,
    "businessAccountId" TEXT,
    "storeId" TEXT,
    "subjectKey" TEXT NOT NULL,
    "status" "PromoterAttributionStatus" NOT NULL DEFAULT 'ATTRIBUTED',
    "attributionModel" "PromoterAttributionModel" NOT NULL DEFAULT 'FIRST_VALID_ACQUISITION_TOUCH',
    "attributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invalidatedAt" TIMESTAMP(3)
);

CREATE TABLE "PromoterQualification" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterQualification_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "attributionId" TEXT NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "status" "PromoterQualificationStatus" NOT NULL DEFAULT 'PENDING',
    "qualifyingEventType" "PromoterQualifyingEventType" NOT NULL,
    "courierOrderId" TEXT,
    "marketplaceOrderId" TEXT,
    "marketplaceStoreOrderId" TEXT,
    "paymentId" TEXT,
    "storeSettlementId" TEXT,
    "qualifyingAmount" DECIMAL(18,2),
    "evidenceFingerprint" TEXT NOT NULL,
    "qualifiedAt" TIMESTAMP(3),
    "holdUntil" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "PromoterEarning" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterEarning_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "promoterAccountId" TEXT NOT NULL,
    "qualificationId" TEXT NOT NULL,
    "commissionPlanVersionId" TEXT NOT NULL,
    "commissionAccrualId" TEXT,
    "status" "PromoterEarningStatus" NOT NULL DEFAULT 'PENDING',
    "grossAmount" DECIMAL(18,2) NOT NULL,
    "payableAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reversedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "withdrawnAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "holdUntil" TIMESTAMP(3) NOT NULL,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "accruedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "PromoterFraudCase" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterFraudCase_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "promoterAccountId" TEXT,
    "attributionId" TEXT,
    "qualificationId" TEXT,
    "earningId" TEXT,
    "subjectType" "PromoterAttributionSubjectType" NOT NULL,
    "subjectReference" TEXT,
    "reason" "PromoterFraudReason" NOT NULL,
    "status" "PromoterFraudCaseStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "PromoterCasePriority" NOT NULL DEFAULT 'MEDIUM',
    "safeSummary" TEXT NOT NULL,
    "safeEvidence" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "PromoterDispute" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterDispute_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "promoterAccountId" TEXT NOT NULL,
    "attributionId" TEXT,
    "earningId" TEXT,
    "category" "PromoterDisputeCategory" NOT NULL,
    "status" "PromoterDisputeStatus" NOT NULL DEFAULT 'OPEN',
    "promoterStatement" TEXT NOT NULL,
    "safeEvidenceReference" TEXT,
    "safeResolution" TEXT,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "PromoterMarketingAsset" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterMarketingAsset_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "programVersionId" TEXT,
    "assetType" "PromoterMarketingAssetType" NOT NULL,
    "status" "PromoterMarketingAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "trustedAssetReference" TEXT NOT NULL,
    "requiredDisclosure" TEXT NOT NULL,
    "approvedClaims" TEXT NOT NULL,
    "prohibitedAlterations" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PromoterReconciliationCase" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterReconciliationCase_pkey" PRIMARY KEY ("id"),
    "publicReference" TEXT NOT NULL,
    "promoterAccountId" TEXT,
    "programVersionId" TEXT,
    "touchId" TEXT,
    "attributionId" TEXT,
    "qualificationId" TEXT,
    "earningId" TEXT,
    "commissionAccrualId" TEXT,
    "walletId" TEXT,
    "withdrawalId" TEXT,
    "reason" "PromoterReconciliationReason" NOT NULL,
    "status" "PromoterReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "PromoterCasePriority" NOT NULL DEFAULT 'MEDIUM',
    "safeSummary" TEXT NOT NULL,
    "safeEvidence" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "PromoterEventIntent" (
    "id" TEXT NOT NULL,
    CONSTRAINT "PromoterEventIntent_pkey" PRIMARY KEY ("id"),
    "eventType" "PromoterEventIntentType" NOT NULL,
    "promoterAccountId" TEXT,
    "aggregateReference" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "safePayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "PromoterAccount_publicReference_key" ON "PromoterAccount" ("publicReference");
CREATE UNIQUE INDEX "PromoterAccount_userId_key" ON "PromoterAccount" ("userId");
CREATE UNIQUE INDEX "PromoterAccount_operationId_key" ON "PromoterAccount" ("operationId");
CREATE INDEX "PromoterAccount_status_idx" ON "PromoterAccount" ("status");
CREATE UNIQUE INDEX "PromoterAgreementVersion_publicReference_key" ON "PromoterAgreementVersion" ("publicReference");
CREATE UNIQUE INDEX "PromoterAgreementVersion_versionNumber_key" ON "PromoterAgreementVersion" ("versionNumber");
CREATE INDEX "PromoterAgreementVersion_status_effectiveFrom_idx" ON "PromoterAgreementVersion" ("status", "effectiveFrom");
CREATE UNIQUE INDEX "PromoterAgreementAcceptance_promoterAccountId_agreementVersionId_key" ON "PromoterAgreementAcceptance" ("promoterAccountId", "agreementVersionId");
CREATE UNIQUE INDEX "PromoterAgreementAcceptance_operationId_key" ON "PromoterAgreementAcceptance" ("operationId");
CREATE UNIQUE INDEX "PromoterProgram_publicReference_key" ON "PromoterProgram" ("publicReference");
CREATE UNIQUE INDEX "PromoterProgram_code_key" ON "PromoterProgram" ("code");
CREATE UNIQUE INDEX "PromoterProgramVersion_publicReference_key" ON "PromoterProgramVersion" ("publicReference");
CREATE UNIQUE INDEX "PromoterProgramVersion_programId_versionNumber_key" ON "PromoterProgramVersion" ("programId", "versionNumber");
CREATE INDEX "PromoterProgramVersion_status_startsAt_endsAt_idx" ON "PromoterProgramVersion" ("status", "startsAt", "endsAt");
CREATE UNIQUE INDEX "PromoterEnrollment_publicReference_key" ON "PromoterEnrollment" ("publicReference");
CREATE UNIQUE INDEX "PromoterEnrollment_promoterAccountId_programVersionId_key" ON "PromoterEnrollment" ("promoterAccountId", "programVersionId");
CREATE UNIQUE INDEX "PromoterEnrollment_operationId_key" ON "PromoterEnrollment" ("operationId");
CREATE UNIQUE INDEX "PromoterChannel_publicReference_key" ON "PromoterChannel" ("publicReference");
CREATE INDEX "PromoterChannel_promoterAccountId_status_idx" ON "PromoterChannel" ("promoterAccountId", "status");
CREATE UNIQUE INDEX "PromoterReferralCode_publicReference_key" ON "PromoterReferralCode" ("publicReference");
CREATE INDEX "PromoterReferralCode_codeHmac_status_idx" ON "PromoterReferralCode" ("codeHmac", "status");
CREATE UNIQUE INDEX "PromoterTouch_publicReference_key" ON "PromoterTouch" ("publicReference");
CREATE UNIQUE INDEX "PromoterTouch_operationId_key" ON "PromoterTouch" ("operationId");
CREATE INDEX "PromoterTouch_programVersionId_occurredAt_idx" ON "PromoterTouch" ("programVersionId", "occurredAt");
CREATE UNIQUE INDEX "PromoterAttribution_publicReference_key" ON "PromoterAttribution" ("publicReference");
CREATE UNIQUE INDEX "PromoterAttribution_operationId_key" ON "PromoterAttribution" ("operationId");
CREATE UNIQUE INDEX "PromoterAttribution_programVersionId_subjectKey_key" ON "PromoterAttribution" ("programVersionId", "subjectKey");
CREATE INDEX "PromoterAttribution_subjectType_status_idx" ON "PromoterAttribution" ("subjectType", "status");
CREATE UNIQUE INDEX "PromoterQualification_publicReference_key" ON "PromoterQualification" ("publicReference");
CREATE UNIQUE INDEX "PromoterQualification_operationId_key" ON "PromoterQualification" ("operationId");
CREATE UNIQUE INDEX "PromoterQualification_attributionId_programVersionId_key" ON "PromoterQualification" ("attributionId", "programVersionId");
CREATE UNIQUE INDEX "PromoterEarning_publicReference_key" ON "PromoterEarning" ("publicReference");
CREATE UNIQUE INDEX "PromoterEarning_qualificationId_key" ON "PromoterEarning" ("qualificationId");
CREATE UNIQUE INDEX "PromoterEarning_operationId_key" ON "PromoterEarning" ("operationId");
CREATE INDEX "PromoterEarning_status_holdUntil_idx" ON "PromoterEarning" ("status", "holdUntil");
CREATE UNIQUE INDEX "PromoterFraudCase_publicReference_key" ON "PromoterFraudCase" ("publicReference");
CREATE INDEX "PromoterFraudCase_status_priority_lastObservedAt_idx" ON "PromoterFraudCase" ("status", "priority", "lastObservedAt");
CREATE UNIQUE INDEX "PromoterDispute_publicReference_key" ON "PromoterDispute" ("publicReference");
CREATE UNIQUE INDEX "PromoterDispute_operationId_key" ON "PromoterDispute" ("operationId");
CREATE UNIQUE INDEX "PromoterMarketingAsset_publicReference_key" ON "PromoterMarketingAsset" ("publicReference");
CREATE INDEX "PromoterMarketingAsset_status_idx" ON "PromoterMarketingAsset" ("status");
CREATE UNIQUE INDEX "PromoterReconciliationCase_publicReference_key" ON "PromoterReconciliationCase" ("publicReference");
CREATE INDEX "PromoterReconciliationCase_status_priority_lastObservedAt_idx" ON "PromoterReconciliationCase" ("status", "priority", "lastObservedAt");
CREATE UNIQUE INDEX "PromoterEventIntent_operationId_key" ON "PromoterEventIntent" ("operationId");
CREATE INDEX "PromoterEventIntent_eventType_createdAt_idx" ON "PromoterEventIntent" ("eventType", "createdAt");

ALTER TABLE "PromoterAgreementAcceptance" ADD CONSTRAINT "PromoterAgreementAcceptance_promoterAccountId_fkey" FOREIGN KEY ("promoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterAgreementAcceptance" ADD CONSTRAINT "PromoterAgreementAcceptance_agreementVersionId_fkey" FOREIGN KEY ("agreementVersionId") REFERENCES "PromoterAgreementVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterProgramVersion" ADD CONSTRAINT "PromoterProgramVersion_programId_fkey" FOREIGN KEY ("programId") REFERENCES "PromoterProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterEnrollment" ADD CONSTRAINT "PromoterEnrollment_promoterAccountId_fkey" FOREIGN KEY ("promoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterEnrollment" ADD CONSTRAINT "PromoterEnrollment_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "PromoterProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterChannel" ADD CONSTRAINT "PromoterChannel_promoterAccountId_fkey" FOREIGN KEY ("promoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterChannel" ADD CONSTRAINT "PromoterChannel_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "PromoterEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterReferralCode" ADD CONSTRAINT "PromoterReferralCode_promoterAccountId_fkey" FOREIGN KEY ("promoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterReferralCode" ADD CONSTRAINT "PromoterReferralCode_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "PromoterEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterReferralCode" ADD CONSTRAINT "PromoterReferralCode_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "PromoterChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoterTouch" ADD CONSTRAINT "PromoterTouch_promoterAccountId_fkey" FOREIGN KEY ("promoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterTouch" ADD CONSTRAINT "PromoterTouch_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "PromoterEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterTouch" ADD CONSTRAINT "PromoterTouch_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "PromoterProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterTouch" ADD CONSTRAINT "PromoterTouch_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "PromoterReferralCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoterTouch" ADD CONSTRAINT "PromoterTouch_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "PromoterChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoterAttribution" ADD CONSTRAINT "PromoterAttribution_promoterAccountId_fkey" FOREIGN KEY ("promoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterAttribution" ADD CONSTRAINT "PromoterAttribution_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "PromoterEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterAttribution" ADD CONSTRAINT "PromoterAttribution_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "PromoterProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterAttribution" ADD CONSTRAINT "PromoterAttribution_touchId_fkey" FOREIGN KEY ("touchId") REFERENCES "PromoterTouch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterQualification" ADD CONSTRAINT "PromoterQualification_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "PromoterAttribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterQualification" ADD CONSTRAINT "PromoterQualification_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "PromoterProgramVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterEarning" ADD CONSTRAINT "PromoterEarning_promoterAccountId_fkey" FOREIGN KEY ("promoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterEarning" ADD CONSTRAINT "PromoterEarning_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "PromoterQualification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterFraudCase" ADD CONSTRAINT "PromoterFraudCase_promoterAccountId_fkey" FOREIGN KEY ("promoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoterFraudCase" ADD CONSTRAINT "PromoterFraudCase_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "PromoterAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoterFraudCase" ADD CONSTRAINT "PromoterFraudCase_qualificationId_fkey" FOREIGN KEY ("qualificationId") REFERENCES "PromoterQualification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoterFraudCase" ADD CONSTRAINT "PromoterFraudCase_earningId_fkey" FOREIGN KEY ("earningId") REFERENCES "PromoterEarning"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoterDispute" ADD CONSTRAINT "PromoterDispute_promoterAccountId_fkey" FOREIGN KEY ("promoterAccountId") REFERENCES "PromoterAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromoterDispute" ADD CONSTRAINT "PromoterDispute_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "PromoterAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoterDispute" ADD CONSTRAINT "PromoterDispute_earningId_fkey" FOREIGN KEY ("earningId") REFERENCES "PromoterEarning"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PromoterMarketingAsset" ADD CONSTRAINT "PromoterMarketingAsset_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "PromoterProgramVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION phase25_reject_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'Phase 25 immutable record cannot be changed'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PromoterAgreementAcceptance_append_only" BEFORE UPDATE OR DELETE ON "PromoterAgreementAcceptance" FOR EACH ROW EXECUTE FUNCTION phase25_reject_mutation();
CREATE TRIGGER "PromoterTouch_append_only" BEFORE UPDATE OR DELETE ON "PromoterTouch" FOR EACH ROW EXECUTE FUNCTION phase25_reject_mutation();
CREATE TRIGGER "PromoterEventIntent_append_only" BEFORE UPDATE OR DELETE ON "PromoterEventIntent" FOR EACH ROW EXECUTE FUNCTION phase25_reject_mutation();
-- Approved versions may progress through lifecycle states, but their commercial
-- terms cannot change after approval.
CREATE OR REPLACE FUNCTION phase25_guard_program_version() RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('APPROVED', 'ACTIVE', 'PAUSED', 'ENDED') AND
     (NEW."programId", NEW."versionNumber", NEW."attributionModel", NEW."attributionWindowDays", NEW."qualifyingEventType", NEW."qualificationHoldDays", NEW."commissionPlanVersionId", NEW."maximumQualificationsPerPromoter", NEW."maximumQualificationsPerDay", NEW."maximumQualificationsPerSubject", NEW."geographicPolicyVersion", NEW."fraudPolicyVersion", NEW."disclosurePolicyVersion", NEW."reversalPolicyVersion", NEW."legalTermsVersion", NEW."startsAt", NEW."endsAt")
     IS DISTINCT FROM
     (OLD."programId", OLD."versionNumber", OLD."attributionModel", OLD."attributionWindowDays", OLD."qualifyingEventType", OLD."qualificationHoldDays", OLD."commissionPlanVersionId", OLD."maximumQualificationsPerPromoter", OLD."maximumQualificationsPerDay", OLD."maximumQualificationsPerSubject", OLD."geographicPolicyVersion", OLD."fraudPolicyVersion", OLD."disclosurePolicyVersion", OLD."reversalPolicyVersion", OLD."legalTermsVersion", OLD."startsAt", OLD."endsAt") THEN
    RAISE EXCEPTION 'Approved Phase 25 program terms are immutable';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PromoterProgramVersion_approved_immutable" BEFORE UPDATE ON "PromoterProgramVersion" FOR EACH ROW EXECUTE FUNCTION phase25_guard_program_version();

ALTER TABLE "PromoterAttribution" ADD CONSTRAINT "PromoterAttribution_one_subject" CHECK ((CASE WHEN "customerUserId" IS NULL THEN 0 ELSE 1 END + CASE WHEN "businessAccountId" IS NULL THEN 0 ELSE 1 END + CASE WHEN "storeId" IS NULL THEN 0 ELSE 1 END) = 1);
CREATE UNIQUE INDEX "PromoterQualification_evidenceFingerprint_key" ON "PromoterQualification"("evidenceFingerprint");
