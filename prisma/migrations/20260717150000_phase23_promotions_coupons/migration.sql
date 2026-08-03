-- Phase 23: Promotions and Coupons Migration

-- 1. Rename existing enum types
ALTER TYPE "PromotionStatus" RENAME TO "LegacyPromotionStatus";
ALTER TYPE "DiscountType" RENAME TO "LegacyDiscountType";

-- 2. Rename existing tables
ALTER TABLE "Promotion" RENAME TO "LegacyPromotion";
ALTER TABLE "Coupon" RENAME TO "LegacyCoupon";
ALTER TABLE "PromotionRedemption" RENAME TO "LegacyPromotionRedemption";

-- 3. Rename indexes and constraints
ALTER INDEX "Promotion_pkey" RENAME TO "LegacyPromotion_pkey";
ALTER INDEX "Promotion_storeId_idx" RENAME TO "LegacyPromotion_storeId_idx";
ALTER INDEX "Promotion_status_idx" RENAME TO "LegacyPromotion_status_idx";
ALTER INDEX "Promotion_startsAt_endsAt_idx" RENAME TO "LegacyPromotion_startsAt_endsAt_idx";

ALTER INDEX "Coupon_pkey" RENAME TO "LegacyCoupon_pkey";
ALTER INDEX "Coupon_code_key" RENAME TO "LegacyCoupon_code_key";
ALTER INDEX "Coupon_promotionId_idx" RENAME TO "LegacyCoupon_promotionId_idx";
ALTER INDEX "Coupon_isActive_idx" RENAME TO "LegacyCoupon_isActive_idx";
ALTER INDEX "Coupon_startsAt_endsAt_idx" RENAME TO "LegacyCoupon_startsAt_endsAt_idx";

ALTER INDEX "PromotionRedemption_pkey" RENAME TO "LegacyPromotionRedemption_pkey";
ALTER INDEX "PromotionRedemption_couponId_idx" RENAME TO "LegacyPromotionRedemption_couponId_idx";
ALTER INDEX "PromotionRedemption_userId_idx" RENAME TO "LegacyPromotionRedemption_userId_idx";
ALTER INDEX "PromotionRedemption_orderId_idx" RENAME TO "LegacyPromotionRedemption_orderId_idx";
ALTER INDEX "PromotionRedemption_redeemedAt_idx" RENAME TO "LegacyPromotionRedemption_redeemedAt_idx";

ALTER TABLE "LegacyPromotion" RENAME CONSTRAINT "Promotion_storeId_fkey" TO "LegacyPromotion_storeId_fkey";
ALTER TABLE "LegacyCoupon" RENAME CONSTRAINT "Coupon_promotionId_fkey" TO "LegacyCoupon_promotionId_fkey";
ALTER TABLE "LegacyPromotionRedemption" RENAME CONSTRAINT "PromotionRedemption_couponId_fkey" TO "LegacyPromotionRedemption_couponId_fkey";
ALTER TABLE "LegacyPromotionRedemption" RENAME CONSTRAINT "PromotionRedemption_userId_fkey" TO "LegacyPromotionRedemption_userId_fkey";
ALTER TABLE "LegacyPromotionRedemption" RENAME CONSTRAINT "PromotionRedemption_orderId_fkey" TO "LegacyPromotionRedemption_orderId_fkey";

-- 4. Create new Enums
CREATE TYPE "PromotionCampaignOwnerType" AS ENUM ('PLATFORM', 'STORE');
CREATE TYPE "PromotionCampaignStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'ENDED', 'RETIRED');
CREATE TYPE "PromotionCampaignVersionStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'ENDED', 'RETIRED');
CREATE TYPE "PromotionApplicationMethod" AS ENUM ('AUTOMATIC', 'COUPON_CODE');
CREATE TYPE "PromotionDiscountScope" AS ENUM ('LINE', 'ORDER', 'DELIVERY');
CREATE TYPE "PromotionDiscountMechanism" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');
CREATE TYPE "PromotionFundingType" AS ENUM ('PLATFORM_FUNDED', 'STORE_FUNDED', 'SHARED_PLATFORM_STORE');
CREATE TYPE "PromotionTargetType" AS ENUM ('STORE', 'CATEGORY', 'PRODUCT', 'VARIANT', 'DELIVERY_SERVICE_TYPE', 'DELIVERY_REGION', 'ALL_ELIGIBLE_MARKETPLACE_LINES');
CREATE TYPE "PromotionTargetMode" AS ENUM ('INCLUDE', 'EXCLUDE');
CREATE TYPE "PromotionEligibilityRule" AS ENUM ('ALL_CUSTOMERS', 'AUTHENTICATED_CUSTOMERS', 'FIRST_MARKETPLACE_ORDER', 'SPECIFIC_CUSTOMER_ALLOWLIST', 'ACTIVE_SUBSCRIPTION_REQUIRED', 'CUSTOMER_REGION', 'MINIMUM_ELIGIBLE_SPEND', 'SERVICE_TYPE');
CREATE TYPE "PromotionCodeStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED', 'EXHAUSTED');
CREATE TYPE "PromotionCodeBatchStatus" AS ENUM ('PENDING', 'GENERATING', 'COMPLETED', 'FAILED');
CREATE TYPE "PromotionReservationStatus" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED', 'EXPIRED', 'REVERSED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "PromotionRedemptionStatus" AS ENUM ('COMMITTED', 'PARTIALLY_REVERSED', 'FULLY_REVERSED', 'RECONCILIATION_REQUIRED');
CREATE TYPE "PromotionBudgetStatus" AS ENUM ('ACTIVE', 'EXHAUSTED', 'FROZEN');
CREATE TYPE "PromotionBudgetMovementType" AS ENUM ('RESERVE', 'COMMIT', 'RELEASE', 'REVERSE', 'EXPIRE', 'APPROVED_INCREASE', 'APPROVED_DECREASE');
CREATE TYPE "PromotionStackingOutcome" AS ENUM ('COMBINABLE', 'EXCLUSIVE', 'BEST_VALUE_ONLY');
CREATE TYPE "PromotionRedemptionReusePolicy" AS ENUM ('NEVER_RESTORE', 'RESTORE_ON_DEFINITE_PRE_FULFILMENT_CANCELLATION', 'ADMIN_REVIEW_REQUIRED');
CREATE TYPE "PromotionReconciliationReason" AS ENUM ('BUDGET_RESERVATION_MISMATCH', 'BUDGET_COMMIT_MISMATCH', 'REDEMPTION_WITHOUT_RESERVATION', 'RESERVATION_WITHOUT_REDEMPTION', 'FUNDING_SPLIT_INCOHERENT', 'ALLOCATION_SUM_MISMATCH', 'CUSTOMER_PAID_NEGATIVE', 'STACKING_POLICY_VIOLATION', 'ELIGIBILITY_EVIDENCE_MISSING', 'CODE_USAGE_OVERFLOW', 'EXPIRED_RESERVATION_NOT_RELEASED', 'REVERSAL_WITHOUT_COMMITMENT', 'PLATFORM_SUBSIDY_JOURNAL_MISSING', 'STORE_BASIS_REDUCTION_MISMATCH', 'SETTLEMENT_EVIDENCE_INCOHERENT');
CREATE TYPE "PromotionReconciliationStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED');

-- 5. Create new Tables
CREATE TABLE "PromotionCampaign" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "internalCode" TEXT NOT NULL,
    "ownerType" "PromotionCampaignOwnerType" NOT NULL,
    "ownerStoreId" TEXT,
    "status" "PromotionCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionCampaignVersion" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "PromotionCampaignVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "applicationMethod" "PromotionApplicationMethod" NOT NULL,
    "discountScope" "PromotionDiscountScope" NOT NULL,
    "discountMechanism" "PromotionDiscountMechanism" NOT NULL,
    "percentageValue" DECIMAL(18,4),
    "fixedAmount" DECIMAL(18,2),
    "maximumDiscountAmount" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "fundingType" "PromotionFundingType" NOT NULL,
    "platformFundingShareBps" INTEGER,
    "storeFundingShareBps" INTEGER,
    "minimumEligibleSubtotal" DECIMAL(18,2),
    "maximumRedemptionsGlobal" INTEGER,
    "maximumRedemptionsPerCustomer" INTEGER,
    "maximumRedemptionsPerOrder" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "stackingPolicyVersion" TEXT NOT NULL DEFAULT 'v1',
    "eligibilityPolicyVersion" TEXT NOT NULL DEFAULT 'v1',
    "fundingPolicyVersion" TEXT NOT NULL DEFAULT 'v1',
    "refundPolicyVersion" TEXT NOT NULL DEFAULT 'v1',
    "legalTermsVersion" TEXT,
    "legalTermsReference" TEXT,
    "promotionDescription" TEXT,
    "customerFacingTitle" TEXT,
    "customerFacingDescription" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectionReason" TEXT,
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionCampaignVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionCampaignVersionTarget" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "targetType" "PromotionTargetType" NOT NULL,
    "targetMode" "PromotionTargetMode" NOT NULL DEFAULT 'INCLUDE',
    "targetReference" TEXT NOT NULL,
    "targetSourceVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionCampaignVersionTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionCampaignVersionEligibility" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "rule" "PromotionEligibilityRule" NOT NULL,
    "ruleValue" TEXT,
    "ruleEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionCampaignVersionEligibility_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionCampaignVersionCustomerAllowlist" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "customerUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionCampaignVersionCustomerAllowlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionCode" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "codeHmac" TEXT NOT NULL,
    "codeFingerprint" TEXT NOT NULL,
    "maskedDisplay" TEXT NOT NULL,
    "status" "PromotionCodeStatus" NOT NULL DEFAULT 'DRAFT',
    "restrictedCustomerUserId" TEXT,
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "maximumRedemptions" INTEGER,
    "maximumRedemptionsPerCustomer" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "batchId" TEXT,

    CONSTRAINT "PromotionCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionCodeBatch" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "requestedCount" INTEGER NOT NULL,
    "generatedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "PromotionCodeBatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionCodeBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionBudget" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "approvedAmount" DECIMAL(18,2) NOT NULL,
    "dailyLimit" DECIMAL(18,2),
    "reservedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "committedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "releasedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reversedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "PromotionBudgetStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionBudgetMovement" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "movementType" "PromotionBudgetMovementType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "checkoutId" TEXT,
    "storeOrderId" TEXT,
    "redemptionId" TEXT,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionBudgetMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionReservation" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "promotionCodeId" TEXT,
    "checkoutId" TEXT NOT NULL,
    "checkoutReviewVersion" INTEGER NOT NULL,
    "customerUserId" TEXT,
    "guestEvidenceReference" TEXT,
    "status" "PromotionReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "reservedDiscountAmount" DECIMAL(18,2) NOT NULL,
    "reservedPlatformFunding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reservedStoreFunding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionRedemption" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "promotionCodeId" TEXT,
    "reservationId" TEXT NOT NULL,
    "checkoutId" TEXT NOT NULL,
    "marketplaceOrderId" TEXT,
    "storeOrderId" TEXT,
    "customerUserId" TEXT,
    "guestEvidenceReference" TEXT,
    "status" "PromotionRedemptionStatus" NOT NULL DEFAULT 'COMMITTED',
    "discountAmount" DECIMAL(18,2) NOT NULL,
    "platformFunding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "storeFunding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "redemptionReusePolicy" "PromotionRedemptionReusePolicy" NOT NULL DEFAULT 'NEVER_RESTORE',
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionFinancialAllocation" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "storeGroupReference" TEXT,
    "lineReference" TEXT,
    "allocationType" TEXT NOT NULL,
    "eligibleBasis" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL,
    "platformFunding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "storeFunding" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "calculationEvidence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionFinancialAllocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionReconciliationCase" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignVersionId" TEXT,
    "promotionCodeId" TEXT,
    "checkoutId" TEXT,
    "reservationId" TEXT,
    "redemptionId" TEXT,
    "marketplaceOrderId" TEXT,
    "paymentId" TEXT,
    "refundId" TEXT,
    "reason" "PromotionReconciliationReason" NOT NULL,
    "status" "PromotionReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "safeSummary" TEXT NOT NULL,
    "safeEvidence" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionReconciliationCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionStatusHistory" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "operationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionEventIntent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionEventIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionOperation" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "resultReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionOperation_pkey" PRIMARY KEY ("id")
);

-- 6. Create Indexes
CREATE UNIQUE INDEX "PromotionCampaign_publicReference_key" ON "PromotionCampaign"("publicReference");
CREATE UNIQUE INDEX "PromotionCampaign_internalCode_key" ON "PromotionCampaign"("internalCode");
CREATE INDEX "PromotionCampaign_ownerType_ownerStoreId_idx" ON "PromotionCampaign"("ownerType", "ownerStoreId");
CREATE INDEX "PromotionCampaign_status_idx" ON "PromotionCampaign"("status");
CREATE INDEX "PromotionCampaign_internalCode_idx" ON "PromotionCampaign"("internalCode");
CREATE INDEX "PromotionCampaign_createdAt_idx" ON "PromotionCampaign"("createdAt");

CREATE UNIQUE INDEX "PromotionCampaignVersion_publicReference_key" ON "PromotionCampaignVersion"("publicReference");
CREATE INDEX "PromotionCampaignVersion_campaignId_idx" ON "PromotionCampaignVersion"("campaignId");
CREATE INDEX "PromotionCampaignVersion_status_idx" ON "PromotionCampaignVersion"("status");
CREATE INDEX "PromotionCampaignVersion_applicationMethod_idx" ON "PromotionCampaignVersion"("applicationMethod");
CREATE INDEX "PromotionCampaignVersion_discountScope_idx" ON "PromotionCampaignVersion"("discountScope");
CREATE INDEX "PromotionCampaignVersion_startsAt_endsAt_idx" ON "PromotionCampaignVersion"("startsAt", "endsAt");
CREATE INDEX "PromotionCampaignVersion_status_startsAt_endsAt_idx" ON "PromotionCampaignVersion"("status", "startsAt", "endsAt");
CREATE INDEX "PromotionCampaignVersion_createdAt_idx" ON "PromotionCampaignVersion"("createdAt");
CREATE UNIQUE INDEX "PromotionCampaignVersion_campaignId_versionNumber_key" ON "PromotionCampaignVersion"("campaignId", "versionNumber");

CREATE INDEX "PromotionCampaignVersionTarget_campaignVersionId_idx" ON "PromotionCampaignVersionTarget"("campaignVersionId");
CREATE INDEX "PromotionCampaignVersionTarget_targetType_targetReference_idx" ON "PromotionCampaignVersionTarget"("targetType", "targetReference");

CREATE INDEX "PromotionCampaignVersionEligibility_campaignVersionId_idx" ON "PromotionCampaignVersionEligibility"("campaignVersionId");
CREATE INDEX "PromotionCampaignVersionEligibility_rule_idx" ON "PromotionCampaignVersionEligibility"("rule");

CREATE INDEX "PromotionCampaignVersionCustomerAllowlist_campaignVersionId_idx" ON "PromotionCampaignVersionCustomerAllowlist"("campaignVersionId");
CREATE INDEX "PromotionCampaignVersionCustomerAllowlist_customerUserId_idx" ON "PromotionCampaignVersionCustomerAllowlist"("customerUserId");
CREATE UNIQUE INDEX "PromotionCampaignVersionCustomerAllowlist_campaignVersionId_customerU_key" ON "PromotionCampaignVersionCustomerAllowlist"("campaignVersionId", "customerUserId");

CREATE UNIQUE INDEX "PromotionCode_publicReference_key" ON "PromotionCode"("publicReference");
CREATE UNIQUE INDEX "PromotionCode_codeHmac_key" ON "PromotionCode"("codeHmac");
CREATE INDEX "PromotionCode_campaignVersionId_idx" ON "PromotionCode"("campaignVersionId");
CREATE INDEX "PromotionCode_codeHmac_idx" ON "PromotionCode"("codeHmac");
CREATE INDEX "PromotionCode_codeFingerprint_idx" ON "PromotionCode"("codeFingerprint");
CREATE INDEX "PromotionCode_status_idx" ON "PromotionCode"("status");
CREATE INDEX "PromotionCode_restrictedCustomerUserId_idx" ON "PromotionCode"("restrictedCustomerUserId");
CREATE INDEX "PromotionCode_startsAt_expiresAt_idx" ON "PromotionCode"("startsAt", "expiresAt");

CREATE UNIQUE INDEX "PromotionCodeBatch_publicReference_key" ON "PromotionCodeBatch"("publicReference");
CREATE INDEX "PromotionCodeBatch_campaignVersionId_idx" ON "PromotionCodeBatch"("campaignVersionId");
CREATE INDEX "PromotionCodeBatch_status_idx" ON "PromotionCodeBatch"("status");
CREATE INDEX "PromotionCodeBatch_createdAt_idx" ON "PromotionCodeBatch"("createdAt");

CREATE UNIQUE INDEX "PromotionBudget_campaignVersionId_key" ON "PromotionBudget"("campaignVersionId");
CREATE INDEX "PromotionBudget_status_idx" ON "PromotionBudget"("status");
CREATE INDEX "PromotionBudget_campaignVersionId_idx" ON "PromotionBudget"("campaignVersionId");

CREATE INDEX "PromotionBudgetMovement_budgetId_idx" ON "PromotionBudgetMovement"("budgetId");
CREATE INDEX "PromotionBudgetMovement_movementType_idx" ON "PromotionBudgetMovement"("movementType");
CREATE INDEX "PromotionBudgetMovement_checkoutId_idx" ON "PromotionBudgetMovement"("checkoutId");
CREATE INDEX "PromotionBudgetMovement_storeOrderId_idx" ON "PromotionBudgetMovement"("storeOrderId");
CREATE INDEX "PromotionBudgetMovement_createdAt_idx" ON "PromotionBudgetMovement"("createdAt");
CREATE UNIQUE INDEX "PromotionBudgetMovement_operationId_movementType_key" ON "PromotionBudgetMovement"("operationId", "movementType");

CREATE UNIQUE INDEX "PromotionReservation_publicReference_key" ON "PromotionReservation"("publicReference");
CREATE UNIQUE INDEX "PromotionReservation_operationId_key" ON "PromotionReservation"("operationId");
CREATE INDEX "PromotionReservation_campaignVersionId_idx" ON "PromotionReservation"("campaignVersionId");
CREATE INDEX "PromotionReservation_promotionCodeId_idx" ON "PromotionReservation"("promotionCodeId");
CREATE INDEX "PromotionReservation_checkoutId_idx" ON "PromotionReservation"("checkoutId");
CREATE INDEX "PromotionReservation_customerUserId_idx" ON "PromotionReservation"("customerUserId");
CREATE INDEX "PromotionReservation_status_idx" ON "PromotionReservation"("status");
CREATE INDEX "PromotionReservation_expiresAt_idx" ON "PromotionReservation"("expiresAt");
CREATE INDEX "PromotionReservation_createdAt_idx" ON "PromotionReservation"("createdAt");

CREATE UNIQUE INDEX "PromotionRedemption_publicReference_key" ON "PromotionRedemption"("publicReference");
CREATE UNIQUE INDEX "PromotionRedemption_reservationId_key" ON "PromotionRedemption"("reservationId");
CREATE UNIQUE INDEX "PromotionRedemption_operationId_key" ON "PromotionRedemption"("operationId");
CREATE INDEX "PromotionRedemption_campaignVersionId_idx" ON "PromotionRedemption"("campaignVersionId");
CREATE INDEX "PromotionRedemption_promotionCodeId_idx" ON "PromotionRedemption"("promotionCodeId");
CREATE INDEX "PromotionRedemption_reservationId_idx" ON "PromotionRedemption"("reservationId");
CREATE INDEX "PromotionRedemption_checkoutId_idx" ON "PromotionRedemption"("checkoutId");
CREATE INDEX "PromotionRedemption_marketplaceOrderId_idx" ON "PromotionRedemption"("marketplaceOrderId");
CREATE INDEX "PromotionRedemption_storeOrderId_idx" ON "PromotionRedemption"("storeOrderId");
CREATE INDEX "PromotionRedemption_customerUserId_idx" ON "PromotionRedemption"("customerUserId");
CREATE INDEX "PromotionRedemption_status_idx" ON "PromotionRedemption"("status");
CREATE INDEX "PromotionRedemption_createdAt_idx" ON "PromotionRedemption"("createdAt");

CREATE UNIQUE INDEX "PromotionFinancialAllocation_publicReference_key" ON "PromotionFinancialAllocation"("publicReference");
CREATE INDEX "PromotionFinancialAllocation_redemptionId_idx" ON "PromotionFinancialAllocation"("redemptionId");
CREATE INDEX "PromotionFinancialAllocation_storeGroupReference_idx" ON "PromotionFinancialAllocation"("storeGroupReference");
CREATE INDEX "PromotionFinancialAllocation_lineReference_idx" ON "PromotionFinancialAllocation"("lineReference");
CREATE INDEX "PromotionFinancialAllocation_createdAt_idx" ON "PromotionFinancialAllocation"("createdAt");

CREATE UNIQUE INDEX "PromotionReconciliationCase_publicReference_key" ON "PromotionReconciliationCase"("publicReference");
CREATE INDEX "PromotionReconciliationCase_campaignVersionId_idx" ON "PromotionReconciliationCase"("campaignVersionId");
CREATE INDEX "PromotionReconciliationCase_promotionCodeId_idx" ON "PromotionReconciliationCase"("promotionCodeId");
CREATE INDEX "PromotionReconciliationCase_checkoutId_idx" ON "PromotionReconciliationCase"("checkoutId");
CREATE INDEX "PromotionReconciliationCase_reservationId_idx" ON "PromotionReconciliationCase"("reservationId");
CREATE INDEX "PromotionReconciliationCase_redemptionId_idx" ON "PromotionReconciliationCase"("redemptionId");
CREATE INDEX "PromotionReconciliationCase_reason_idx" ON "PromotionReconciliationCase"("reason");
CREATE INDEX "PromotionReconciliationCase_status_idx" ON "PromotionReconciliationCase"("status");
CREATE INDEX "PromotionReconciliationCase_priority_status_idx" ON "PromotionReconciliationCase"("priority", "status");
CREATE INDEX "PromotionReconciliationCase_createdAt_idx" ON "PromotionReconciliationCase"("createdAt");

CREATE INDEX "PromotionStatusHistory_campaignVersionId_idx" ON "PromotionStatusHistory"("campaignVersionId");
CREATE INDEX "PromotionStatusHistory_createdAt_idx" ON "PromotionStatusHistory"("createdAt");

CREATE UNIQUE INDEX "PromotionEventIntent_dedupeKey_key" ON "PromotionEventIntent"("dedupeKey");
CREATE INDEX "PromotionEventIntent_eventType_idx" ON "PromotionEventIntent"("eventType");
CREATE INDEX "PromotionEventIntent_processedAt_idx" ON "PromotionEventIntent"("processedAt");
CREATE INDEX "PromotionEventIntent_createdAt_idx" ON "PromotionEventIntent"("createdAt");

CREATE UNIQUE INDEX "PromotionOperation_operationId_key" ON "PromotionOperation"("operationId");
CREATE INDEX "PromotionOperation_operationType_idx" ON "PromotionOperation"("operationType");
CREATE INDEX "PromotionOperation_createdAt_idx" ON "PromotionOperation"("createdAt");

-- 7. Add Foreign Keys
ALTER TABLE "PromotionCampaign" ADD CONSTRAINT "PromotionCampaign_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionCampaignVersion" ADD CONSTRAINT "PromotionCampaignVersion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionCampaignVersionTarget" ADD CONSTRAINT "PromotionCampaignVersionTarget_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "PromotionCampaignVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionCampaignVersionEligibility" ADD CONSTRAINT "PromotionCampaignVersionEligibility_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "PromotionCampaignVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionCampaignVersionCustomerAllowlist" ADD CONSTRAINT "PromotionCampaignVersionCustomerAllowlist_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "PromotionCampaignVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionCode" ADD CONSTRAINT "PromotionCode_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "PromotionCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionCode" ADD CONSTRAINT "PromotionCode_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PromotionCodeBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionCodeBatch" ADD CONSTRAINT "PromotionCodeBatch_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "PromotionCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionBudget" ADD CONSTRAINT "PromotionBudget_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "PromotionCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionBudgetMovement" ADD CONSTRAINT "PromotionBudgetMovement_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "PromotionBudget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionReservation" ADD CONSTRAINT "PromotionReservation_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "PromotionCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionReservation" ADD CONSTRAINT "PromotionReservation_promotionCodeId_fkey" FOREIGN KEY ("promotionCodeId") REFERENCES "PromotionCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "PromotionCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotionCodeId_fkey" FOREIGN KEY ("promotionCodeId") REFERENCES "PromotionCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "PromotionReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PromotionFinancialAllocation" ADD CONSTRAINT "PromotionFinancialAllocation_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "PromotionRedemption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionReconciliationCase" ADD CONSTRAINT "PromotionReconciliationCase_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "PromotionCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionReconciliationCase" ADD CONSTRAINT "PromotionReconciliationCase_promotionCodeId_fkey" FOREIGN KEY ("promotionCodeId") REFERENCES "PromotionCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionReconciliationCase" ADD CONSTRAINT "PromotionReconciliationCase_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "PromotionReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PromotionReconciliationCase" ADD CONSTRAINT "PromotionReconciliationCase_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "PromotionRedemption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PromotionStatusHistory" ADD CONSTRAINT "PromotionStatusHistory_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "PromotionCampaignVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
