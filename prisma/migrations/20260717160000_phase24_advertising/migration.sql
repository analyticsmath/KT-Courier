-- CreateEnum
CREATE TYPE "AdvertisingAccountStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AdvertisingPlacementStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'RETIRED');

-- CreateEnum
CREATE TYPE "AdvertisingRateCardStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "AdvertisingCampaignStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'FUNDING_REQUIRED', 'FUNDED', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'EXHAUSTED', 'ENDED', 'SUSPENDED', 'REJECTED', 'RETIRED', 'RECONCILIATION_REQUIRED');

-- CreateEnum
CREATE TYPE "AdvertisingCampaignVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "AdvertisingCreativeType" AS ENUM ('CANONICAL_PRODUCT_CARD', 'CANONICAL_STORE_CARD');

-- CreateEnum
CREATE TYPE "AdvertisingFundingStatus" AS ENUM ('PENDING', 'FUNDED', 'PARTIALLY_SPENT', 'EXHAUSTED', 'RETURN_SCHEDULED', 'RETURNED', 'RECONCILIATION_REQUIRED');

-- CreateEnum
CREATE TYPE "AdvertisingFundingMovementType" AS ENUM ('FUND', 'CHARGE', 'INVALID_CLICK_REVERSAL', 'UNUSED_RETURN', 'ADMIN_APPROVED_INCREASE', 'ADMIN_APPROVED_DECREASE');

-- CreateEnum
CREATE TYPE "AdvertisingMeasurementEventType" AS ENUM ('SERVED_IMPRESSION', 'VIEWABLE_IMPRESSION', 'CLICK', 'CONVERSION', 'INVALID_TRAFFIC_CLASSIFICATION');

-- CreateEnum
CREATE TYPE "AdvertisingMeasurementValidity" AS ENUM ('PENDING', 'VALID', 'SUSPECT', 'INVALID');

-- CreateEnum
CREATE TYPE "AdvertisingClickChargeStatus" AS ENUM ('PENDING', 'CHARGED', 'REVERSED', 'RECONCILIATION_REQUIRED');

-- CreateEnum
CREATE TYPE "AdvertisingAttributionModel" AS ENUM ('LAST_VALID_SPONSORED_CLICK');

-- CreateEnum
CREATE TYPE "AdvertisingReconciliationReason" AS ENUM ('CAMPAIGN_SERVED_WHILE_INACTIVE', 'UNLABELLED_SPONSORED_PLACEMENT', 'ORGANIC_RANKING_MUTATION', 'FUNDING_LEDGER_MISMATCH', 'CLICK_CHARGE_WITHOUT_VALID_EVENT', 'VALID_CLICK_WITHOUT_CHARGE', 'DUPLICATE_CLICK_CHARGE', 'CAMPAIGN_BUDGET_OVERRUN', 'DAILY_BUDGET_OVERRUN', 'INVALID_CLICK_NOT_REVERSED', 'FUNDING_RETURN_MISMATCH', 'MEASUREMENT_DUPLICATE', 'VIEWABLE_WITHOUT_SERVED', 'ATTRIBUTION_WITHOUT_VALID_CLICK', 'ATTRIBUTION_OBJECT_MISMATCH', 'AGGREGATE_MISMATCH', 'APPLICATION_FAILURE');

-- CreateEnum
CREATE TYPE "AdvertisingReconciliationStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "AdvertisingReconciliationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "AdvertisingAccount" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "AdvertisingAccountStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "billingStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "moderationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingPlacementDefinition" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sponsoredObjectType" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "status" "AdvertisingPlacementStatus" NOT NULL DEFAULT 'DRAFT',
    "maximumSponsoredItems" INTEGER NOT NULL,
    "minimumOrganicGap" INTEGER NOT NULL,
    "allowedCardType" TEXT NOT NULL,
    "measurementPolicyVersion" TEXT NOT NULL,
    "selectionPolicyVersion" TEXT NOT NULL,
    "disclosurePolicyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingPlacementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingRateCardVersion" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "placementDefinitionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "AdvertisingRateCardStatus" NOT NULL DEFAULT 'DRAFT',
    "billingModel" TEXT NOT NULL DEFAULT 'COST_PER_VALID_CLICK',
    "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
    "costPerValidClick" DECIMAL(18,2) NOT NULL,
    "minimumCampaignFunding" DECIMAL(18,2) NOT NULL,
    "maximumDailyBudget" DECIMAL(18,2),
    "maximumTotalBudget" DECIMAL(18,2),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingRateCardVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaign" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "advertisingAccountId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AdvertisingCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCampaignVersion" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "AdvertisingCampaignVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "sponsoredObjectType" TEXT NOT NULL,
    "sponsoredProductId" TEXT,
    "sponsoredStoreId" TEXT,
    "placementDefinitionId" TEXT NOT NULL,
    "rateCardVersionId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "dailyBudget" DECIMAL(18,2) NOT NULL,
    "totalBudget" DECIMAL(18,2) NOT NULL,
    "attributionWindowDays" INTEGER NOT NULL DEFAULT 14,
    "frequencyCapPerSession" INTEGER,
    "frequencyCapPerDay" INTEGER,
    "targetingPolicyVersion" TEXT NOT NULL,
    "measurementPolicyVersion" TEXT NOT NULL,
    "invalidTrafficPolicyVersion" TEXT NOT NULL,
    "attributionPolicyVersion" TEXT NOT NULL,
    "legalTermsVersion" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingCampaignVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingCreativeSnapshot" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "creativeType" "AdvertisingCreativeType" NOT NULL,
    "productId" TEXT,
    "productVersionReference" TEXT,
    "offerReference" TEXT,
    "storeId" TEXT,
    "title" TEXT NOT NULL,
    "imageAssetReference" TEXT NOT NULL,
    "safePriceSnapshot" DECIMAL(18,2),
    "storeDisplayName" TEXT NOT NULL,
    "disclosureLabel" TEXT NOT NULL DEFAULT 'Sponsored',
    "destinationType" TEXT NOT NULL,
    "destinationReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingCreativeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingTarget" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "effect" TEXT NOT NULL DEFAULT 'INCLUDE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingFundingAllocation" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "status" "AdvertisingFundingStatus" NOT NULL DEFAULT 'PENDING',
    "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "remainingAmount" DECIMAL(18,2) NOT NULL,
    "spentAmount" DECIMAL(18,2) NOT NULL,
    "returnedAmount" DECIMAL(18,2) NOT NULL,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "fundedAt" TIMESTAMP(3),
    "exhaustedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingFundingAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingFundingMovement" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "fundingAllocationId" TEXT NOT NULL,
    "movementType" "AdvertisingFundingMovementType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "ledgerJournalId" TEXT,
    "clickChargeId" TEXT,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingFundingMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingServeDecision" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "placementDefinitionId" TEXT NOT NULL,
    "servedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingServeDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingMeasurementEvent" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "placementDefinitionId" TEXT NOT NULL,
    "serveDecisionId" TEXT NOT NULL,
    "eventType" "AdvertisingMeasurementEventType" NOT NULL,
    "validityStatus" "AdvertisingMeasurementValidity" NOT NULL DEFAULT 'PENDING',
    "sessionFingerprint" TEXT,
    "networkRiskFingerprint" TEXT,
    "userAgentClass" TEXT,
    "eventTimestamp" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "safeEvidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingMeasurementEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingClickCharge" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "fundingAllocationId" TEXT NOT NULL,
    "measurementEventId" TEXT NOT NULL,
    "status" "AdvertisingClickChargeStatus" NOT NULL DEFAULT 'PENDING',
    "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
    "chargeAmount" DECIMAL(18,2) NOT NULL,
    "rateCardVersionId" TEXT NOT NULL,
    "ledgerJournalId" TEXT,
    "reversedByJournalId" TEXT,
    "operationId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "chargedAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingClickCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingAttribution" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "clickEventId" TEXT NOT NULL,
    "marketplaceOrderId" TEXT NOT NULL,
    "marketplaceStoreOrderId" TEXT,
    "marketplaceOrderLineId" TEXT,
    "attributionModel" "AdvertisingAttributionModel" NOT NULL DEFAULT 'LAST_VALID_SPONSORED_CLICK',
    "attributedRevenue" DECIMAL(18,2) NOT NULL,
    "attributedQuantity" INTEGER NOT NULL,
    "attributedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdvertisingAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingDailyAggregate" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "placementDefinitionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "servedImpressions" INTEGER NOT NULL DEFAULT 0,
    "viewableImpressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "validClicks" INTEGER NOT NULL DEFAULT 0,
    "invalidClicks" INTEGER NOT NULL DEFAULT 0,
    "spend" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "attributedRevenue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "attributedUnits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingDailyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvertisingReconciliationCase" (
    "id" TEXT NOT NULL,
    "publicReference" TEXT NOT NULL,
    "advertisingAccountId" TEXT,
    "campaignVersionId" TEXT,
    "fundingAllocationId" TEXT,
    "serveDecisionId" TEXT,
    "measurementEventId" TEXT,
    "clickChargeId" TEXT,
    "attributionId" TEXT,
    "ledgerJournalId" TEXT,
    "reason" "AdvertisingReconciliationReason" NOT NULL,
    "status" "AdvertisingReconciliationStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "AdvertisingReconciliationPriority" NOT NULL DEFAULT 'MEDIUM',
    "safeSummary" TEXT NOT NULL,
    "safeEvidence" JSONB,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolutionCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisingReconciliationCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingAccount_publicReference_key" ON "AdvertisingAccount"("publicReference");
CREATE UNIQUE INDEX "AdvertisingAccount_storeId_key" ON "AdvertisingAccount"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingPlacementDefinition_publicReference_key" ON "AdvertisingPlacementDefinition"("publicReference");
CREATE UNIQUE INDEX "AdvertisingPlacementDefinition_code_key" ON "AdvertisingPlacementDefinition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingRateCardVersion_publicReference_key" ON "AdvertisingRateCardVersion"("publicReference");
CREATE UNIQUE INDEX "AdvertisingRateCardVersion_placementDefinitionId_versionNumber_key" ON "AdvertisingRateCardVersion"("placementDefinitionId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingCampaign_publicReference_key" ON "AdvertisingCampaign"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingCampaignVersion_publicReference_key" ON "AdvertisingCampaignVersion"("publicReference");
CREATE UNIQUE INDEX "AdvertisingCampaignVersion_campaignId_versionNumber_key" ON "AdvertisingCampaignVersion"("campaignId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingCreativeSnapshot_publicReference_key" ON "AdvertisingCreativeSnapshot"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingTarget_campaignVersionId_targetType_value_key" ON "AdvertisingTarget"("campaignVersionId", "targetType", "value");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingFundingAllocation_publicReference_key" ON "AdvertisingFundingAllocation"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingFundingMovement_publicReference_key" ON "AdvertisingFundingMovement"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingServeDecision_publicReference_key" ON "AdvertisingServeDecision"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingMeasurementEvent_publicReference_key" ON "AdvertisingMeasurementEvent"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingClickCharge_publicReference_key" ON "AdvertisingClickCharge"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingAttribution_publicReference_key" ON "AdvertisingAttribution"("publicReference");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingDailyAggregate_campaignVersionId_placementDefinitionId_date_key" ON "AdvertisingDailyAggregate"("campaignVersionId", "placementDefinitionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingReconciliationCase_publicReference_key" ON "AdvertisingReconciliationCase"("publicReference");

-- AddForeignKey
ALTER TABLE "AdvertisingAccount" ADD CONSTRAINT "AdvertisingAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingRateCardVersion" ADD CONSTRAINT "AdvertisingRateCardVersion_placementDefinitionId_fkey" FOREIGN KEY ("placementDefinitionId") REFERENCES "AdvertisingPlacementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingRateCardVersion" ADD CONSTRAINT "AdvertisingRateCardVersion_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaign" ADD CONSTRAINT "AdvertisingCampaign_advertisingAccountId_fkey" FOREIGN KEY ("advertisingAccountId") REFERENCES "AdvertisingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingCampaign" ADD CONSTRAINT "AdvertisingCampaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCampaignVersion" ADD CONSTRAINT "AdvertisingCampaignVersion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdvertisingCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingCampaignVersion" ADD CONSTRAINT "AdvertisingCampaignVersion_sponsoredProductId_fkey" FOREIGN KEY ("sponsoredProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingCampaignVersion" ADD CONSTRAINT "AdvertisingCampaignVersion_sponsoredStoreId_fkey" FOREIGN KEY ("sponsoredStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingCampaignVersion" ADD CONSTRAINT "AdvertisingCampaignVersion_placementDefinitionId_fkey" FOREIGN KEY ("placementDefinitionId") REFERENCES "AdvertisingPlacementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingCampaignVersion" ADD CONSTRAINT "AdvertisingCampaignVersion_rateCardVersionId_fkey" FOREIGN KEY ("rateCardVersionId") REFERENCES "AdvertisingRateCardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingCampaignVersion" ADD CONSTRAINT "AdvertisingCampaignVersion_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingCreativeSnapshot" ADD CONSTRAINT "AdvertisingCreativeSnapshot_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "AdvertisingCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingFundingAllocation" ADD CONSTRAINT "AdvertisingFundingAllocation_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "AdvertisingCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingFundingAllocation" ADD CONSTRAINT "AdvertisingFundingAllocation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingFundingMovement" ADD CONSTRAINT "AdvertisingFundingMovement_fundingAllocationId_fkey" FOREIGN KEY ("fundingAllocationId") REFERENCES "AdvertisingFundingAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingFundingMovement" ADD CONSTRAINT "AdvertisingFundingMovement_ledgerJournalId_fkey" FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingServeDecision" ADD CONSTRAINT "AdvertisingServeDecision_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "AdvertisingCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingServeDecision" ADD CONSTRAINT "AdvertisingServeDecision_placementDefinitionId_fkey" FOREIGN KEY ("placementDefinitionId") REFERENCES "AdvertisingPlacementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingMeasurementEvent" ADD CONSTRAINT "AdvertisingMeasurementEvent_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "AdvertisingCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingMeasurementEvent" ADD CONSTRAINT "AdvertisingMeasurementEvent_placementDefinitionId_fkey" FOREIGN KEY ("placementDefinitionId") REFERENCES "AdvertisingPlacementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingMeasurementEvent" ADD CONSTRAINT "AdvertisingMeasurementEvent_serveDecisionId_fkey" FOREIGN KEY ("serveDecisionId") REFERENCES "AdvertisingServeDecision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingClickCharge" ADD CONSTRAINT "AdvertisingClickCharge_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "AdvertisingCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingClickCharge" ADD CONSTRAINT "AdvertisingClickCharge_fundingAllocationId_fkey" FOREIGN KEY ("fundingAllocationId") REFERENCES "AdvertisingFundingAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingClickCharge" ADD CONSTRAINT "AdvertisingClickCharge_measurementEventId_fkey" FOREIGN KEY ("measurementEventId") REFERENCES "AdvertisingMeasurementEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingClickCharge" ADD CONSTRAINT "AdvertisingClickCharge_rateCardVersionId_fkey" FOREIGN KEY ("rateCardVersionId") REFERENCES "AdvertisingRateCardVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingClickCharge" ADD CONSTRAINT "AdvertisingClickCharge_ledgerJournalId_fkey" FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingClickCharge" ADD CONSTRAINT "AdvertisingClickCharge_reversedByJournalId_fkey" FOREIGN KEY ("reversedByJournalId") REFERENCES "LedgerJournal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingAttribution" ADD CONSTRAINT "AdvertisingAttribution_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "AdvertisingCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingAttribution" ADD CONSTRAINT "AdvertisingAttribution_clickEventId_fkey" FOREIGN KEY ("clickEventId") REFERENCES "AdvertisingMeasurementEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingAttribution" ADD CONSTRAINT "AdvertisingAttribution_marketplaceOrderId_fkey" FOREIGN KEY ("marketplaceOrderId") REFERENCES "MarketplaceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingDailyAggregate" ADD CONSTRAINT "AdvertisingDailyAggregate_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "AdvertisingCampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdvertisingDailyAggregate" ADD CONSTRAINT "AdvertisingDailyAggregate_placementDefinitionId_fkey" FOREIGN KEY ("placementDefinitionId") REFERENCES "AdvertisingPlacementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvertisingReconciliationCase" ADD CONSTRAINT "AdvertisingReconciliationCase_advertisingAccountId_fkey" FOREIGN KEY ("advertisingAccountId") REFERENCES "AdvertisingAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingReconciliationCase" ADD CONSTRAINT "AdvertisingReconciliationCase_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "AdvertisingCampaignVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingReconciliationCase" ADD CONSTRAINT "AdvertisingReconciliationCase_fundingAllocationId_fkey" FOREIGN KEY ("fundingAllocationId") REFERENCES "AdvertisingFundingAllocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingReconciliationCase" ADD CONSTRAINT "AdvertisingReconciliationCase_serveDecisionId_fkey" FOREIGN KEY ("serveDecisionId") REFERENCES "AdvertisingServeDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingReconciliationCase" ADD CONSTRAINT "AdvertisingReconciliationCase_measurementEventId_fkey" FOREIGN KEY ("measurementEventId") REFERENCES "AdvertisingMeasurementEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingReconciliationCase" ADD CONSTRAINT "AdvertisingReconciliationCase_clickChargeId_fkey" FOREIGN KEY ("clickChargeId") REFERENCES "AdvertisingClickCharge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingReconciliationCase" ADD CONSTRAINT "AdvertisingReconciliationCase_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "AdvertisingAttribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdvertisingReconciliationCase" ADD CONSTRAINT "AdvertisingReconciliationCase_ledgerJournalId_fkey" FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
