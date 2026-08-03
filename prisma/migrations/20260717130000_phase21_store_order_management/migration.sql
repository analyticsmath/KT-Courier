-- Phase 21: additive store-order operational management.
-- No Phase 20 commercial snapshot, Payment, courier Order, settlement snapshot,
-- or historical marketplace order line is rewritten.

CREATE TYPE "StoreOrderOperationalPolicyStatus" AS ENUM ('DRAFT','UNDER_REVIEW','APPROVED','ACTIVE','RETIRED','REJECTED');
CREATE TYPE "StoreOrderSubstitutionMode" AS ENUM ('REFUND_ONLY','CUSTOMER_APPROVAL_REQUIRED','PREAPPROVED_CHOICES_ONLY');
CREATE TYPE "StoreOrderTimeoutOutcome" AS ENUM ('REJECT_AND_REFUND');
CREATE TYPE "StoreOrderHandoffVerificationMode" AS ENUM ('TWO_PARTY_CHALLENGE');
CREATE TYPE "StoreOrderAcceptanceStatus" AS ENUM ('PENDING_STORE_REVIEW','REVIEWING','CUSTOMER_ACTION_REQUIRED','ACCEPTED','REJECTED','TIMED_OUT');
CREATE TYPE "StoreOrderPreparationStatus" AS ENUM ('NOT_STARTED','PREPARING','READY_FOR_HANDOFF','HANDED_OFF','ABORTED');
CREATE TYPE "StoreOrderResolutionStatus" AS ENUM ('CLEAR','ISSUE_OPEN','ADJUSTMENT_PENDING','REFUND_PENDING','RECONCILIATION_REQUIRED','RESOLVED');
CREATE TYPE "StoreOrderDeliveryBridgeStatus" AS ENUM ('NOT_REQUESTED','REQUEST_PENDING','DELIVERY_ORDER_CREATED','DISPATCH_PENDING','DRIVER_ASSIGNED','HANDOFF_READY','HANDED_OFF','FAILED');
CREATE TYPE "StoreOrderFinancialResolutionStatus" AS ENUM ('UNCHANGED','ADJUSTMENT_CALCULATED','REVERSAL_PENDING','REFUND_RESERVED','REFUND_PROCESSING','REFUND_COMPLETED','RECONCILIATION_REQUIRED');
CREATE TYPE "StoreOrderDerivedStatus" AS ENUM ('AWAITING_STORE_REVIEW','CUSTOMER_ACTION_REQUIRED','ACCEPTED','PREPARING','READY_FOR_PICKUP','HANDOFF_IN_PROGRESS','HANDED_OFF_TO_COURIER','REJECTED_OR_CANCELLED','RECONCILIATION_REQUIRED');
CREATE TYPE "StoreOrderLineFulfilmentStatus" AS ENUM ('ORDERED','AVAILABLE','PARTIALLY_AVAILABLE','UNAVAILABLE','SUBSTITUTION_PROPOSED','SUBSTITUTION_APPROVED','REFUND_PENDING','READY','HANDED_OFF','RESOLVED');
CREATE TYPE "StoreOrderIssueType" AS ENUM ('OUT_OF_STOCK','PARTIAL_STOCK','DAMAGED','EXPIRED','QUALITY_CONCERN','SKU_MISMATCH','STORE_CAPACITY','STORE_CLOSED','COMPLIANCE_RESTRICTION','PRICE_EVIDENCE_MISMATCH','INVENTORY_EVIDENCE_MISMATCH','OTHER_ADMIN_REVIEW_REQUIRED');
CREATE TYPE "StoreOrderIssueStatus" AS ENUM ('OPEN','CUSTOMER_ACTION_REQUIRED','RESOLVED','REFUND_PENDING','RECONCILIATION_REQUIRED');
CREATE TYPE "StoreOrderSubstitutionPreference" AS ENUM ('REFUND_IF_UNAVAILABLE','NO_SUBSTITUTION','CONTACT_ME','PREAPPROVED_CHOICES_ONLY');
CREATE TYPE "StoreOrderSubstitutionProposalStatus" AS ENUM ('PROPOSED','APPROVED','REJECTED','EXPIRED','CANCELLED','RECONCILIATION_REQUIRED');
CREATE TYPE "StoreOrderSubstitutionReservationStatus" AS ENUM ('ACTIVE','RELEASED','CONSUMED','EXPIRED','RECONCILIATION_REQUIRED');
CREATE TYPE "StoreOrderCustomerDecision" AS ENUM ('APPROVE','REJECT_AND_REFUND');
CREATE TYPE "StoreOrderAdjustmentType" AS ENUM ('FULL_STORE_REJECTION','CUSTOMER_CANCELLATION','QUANTITY_REDUCTION','ITEM_REMOVAL','SUBSTITUTION','DELIVERY_FEE_REFUND','STORE_OPERATIONAL_CANCELLATION');
CREATE TYPE "StoreOrderAdjustmentStatus" AS ENUM ('DRAFT','CUSTOMER_ACTION_REQUIRED','APPROVED','APPLYING','APPLIED','REFUND_PENDING','COMPLETED','RECONCILIATION_REQUIRED','REJECTED');
CREATE TYPE "StoreOrderCancellationRequestStatus" AS ENUM ('REQUESTED','APPROVED','REJECTED','APPLIED','RECONCILIATION_REQUIRED');
CREATE TYPE "StoreOrderCancellationRequesterType" AS ENUM ('CUSTOMER','STORE','SYSTEM');
CREATE TYPE "StoreOrderInventoryDisposition" AS ENUM ('RESTOCK','SHORTAGE_NO_RESTOCK','QUARANTINE','NONE');
CREATE TYPE "StoreOrderHandoffStatus" AS ENUM ('CHALLENGE_ACTIVE','VERIFIED','EXPIRED','RECONCILIATION_REQUIRED');
CREATE TYPE "StoreOrderReconciliationStatus" AS ENUM ('OPEN','MONITORING','RESOLVED');
CREATE TYPE "StoreOrderReconciliationPriority" AS ENUM ('LOW','MEDIUM','HIGH','CRITICAL');

ALTER TYPE "CatalogInventoryMovementType" ADD VALUE IF NOT EXISTS 'ORDER_SUBSTITUTION_RESERVATION';
ALTER TYPE "CatalogInventoryMovementType" ADD VALUE IF NOT EXISTS 'ORDER_SUBSTITUTION_RELEASE';
ALTER TYPE "CatalogInventoryMovementType" ADD VALUE IF NOT EXISTS 'ORDER_SUBSTITUTION_COMMITMENT';
ALTER TYPE "CatalogInventoryMovementType" ADD VALUE IF NOT EXISTS 'ORDER_CANCELLATION_RESTOCK';
ALTER TYPE "CatalogInventoryMovementType" ADD VALUE IF NOT EXISTS 'ORDER_DAMAGE_QUARANTINE';

-- Phase 15's existing refund aggregate remains canonical. Marketplace guests
-- have no customer wallet identity, so an original-method-only refund may hold
-- a null customer reference while retaining the original successful Payment.
ALTER TABLE "PaymentRefund" ALTER COLUMN "customerUserId" DROP NOT NULL;

CREATE TABLE "StoreOrderOperationalPolicy" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "name" TEXT NOT NULL, "versionNumber" INTEGER NOT NULL,
  "status" "StoreOrderOperationalPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "acceptanceWindowSeconds" INTEGER NOT NULL, "customerDecisionWindowSeconds" INTEGER NOT NULL,
  "maximumPrepMinutes" INTEGER NOT NULL, "maximumPrepExtensionMinutes" INTEGER NOT NULL,
  "maximumIssueCount" INTEGER NOT NULL, "maximumSubstitutionProposalsPerLine" INTEGER NOT NULL,
  "substitutionMode" "StoreOrderSubstitutionMode" NOT NULL DEFAULT 'CUSTOMER_APPROVAL_REQUIRED',
  "timeoutOutcome" "StoreOrderTimeoutOutcome" NOT NULL DEFAULT 'REJECT_AND_REFUND',
  "handoffVerificationMode" "StoreOrderHandoffVerificationMode" NOT NULL DEFAULT 'TWO_PARTY_CHALLENGE',
  "effectiveFrom" TIMESTAMP(3) NOT NULL, "effectiveUntil" TIMESTAMP(3), "approvedByUserId" TEXT,
  "rejectedByUserId" TEXT, "rejectedAt" TIMESTAMP(3), "rejectionReasonCode" TEXT,
  "activatedAt" TIMESTAMP(3), "retiredAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreOrderOperationalPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreOrderOperationalPolicy_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "StoreOrderOperationalPolicy_name_versionNumber_key" UNIQUE ("name","versionNumber"),
  CONSTRAINT "StoreOrderOperationalPolicy_bounds_check" CHECK (
    length(trim("name")) >= 3 AND "versionNumber" > 0 AND
    "acceptanceWindowSeconds" BETWEEN 1 AND 86400 AND "customerDecisionWindowSeconds" BETWEEN 1 AND 172800 AND
    "maximumPrepMinutes" BETWEEN 1 AND 1440 AND "maximumPrepExtensionMinutes" BETWEEN 1 AND 720 AND
    "maximumIssueCount" BETWEEN 1 AND 100 AND "maximumSubstitutionProposalsPerLine" BETWEEN 1 AND 5 AND
    ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom")
  )
);

CREATE TABLE "StoreOrderOperationalPolicyHistory" (
  "id" TEXT NOT NULL, "operationalPolicyId" TEXT NOT NULL, "operationId" TEXT NOT NULL, "eventType" TEXT NOT NULL,
  "actorUserId" TEXT, "reasonCode" TEXT, "safeEvidence" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SOPolicyHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SOPolicyHistory_operation_key" UNIQUE ("operationalPolicyId","operationId","eventType")
);

-- Active policy content is immutable. Retirement is the only permitted active
-- transition, preserving the version frozen on paid child store orders.
CREATE FUNCTION "phase21_protect_active_store_order_policy"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'ACTIVE' AND NEW."status" = 'ACTIVE' AND ROW(NEW."name", NEW."versionNumber", NEW."acceptanceWindowSeconds", NEW."customerDecisionWindowSeconds", NEW."maximumPrepMinutes", NEW."maximumPrepExtensionMinutes", NEW."maximumIssueCount", NEW."maximumSubstitutionProposalsPerLine", NEW."substitutionMode", NEW."timeoutOutcome", NEW."handoffVerificationMode", NEW."effectiveFrom", NEW."effectiveUntil") IS DISTINCT FROM ROW(OLD."name", OLD."versionNumber", OLD."acceptanceWindowSeconds", OLD."customerDecisionWindowSeconds", OLD."maximumPrepMinutes", OLD."maximumPrepExtensionMinutes", OLD."maximumIssueCount", OLD."maximumSubstitutionProposalsPerLine", OLD."substitutionMode", OLD."timeoutOutcome", OLD."handoffVerificationMode", OLD."effectiveFrom", OLD."effectiveUntil") THEN
    RAISE EXCEPTION 'active store-order operational policy is immutable';
  END IF;
  IF OLD."status" = 'ACTIVE' AND NEW."status" NOT IN ('ACTIVE', 'RETIRED') THEN
    RAISE EXCEPTION 'active store-order operational policy may only be retired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "StoreOrderOperationalPolicy_active_immutable" BEFORE UPDATE ON "StoreOrderOperationalPolicy" FOR EACH ROW EXECUTE FUNCTION "phase21_protect_active_store_order_policy"();

ALTER TABLE "MarketplaceStoreOrder"
  ADD COLUMN "operationalPolicyId" TEXT,
  ADD COLUMN "operationalPolicyReference" TEXT,
  ADD COLUMN "operationalPolicyVersion" INTEGER,
  ADD COLUMN "acceptanceStatus" "StoreOrderAcceptanceStatus" NOT NULL DEFAULT 'PENDING_STORE_REVIEW',
  ADD COLUMN "preparationStatus" "StoreOrderPreparationStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "resolutionStatus" "StoreOrderResolutionStatus" NOT NULL DEFAULT 'CLEAR',
  ADD COLUMN "deliveryBridgeStatus" "StoreOrderDeliveryBridgeStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
  ADD COLUMN "financialResolutionStatus" "StoreOrderFinancialResolutionStatus" NOT NULL DEFAULT 'UNCHANGED',
  ADD COLUMN "derivedStatus" "StoreOrderDerivedStatus" NOT NULL DEFAULT 'AWAITING_STORE_REVIEW',
  ADD COLUMN "reviewDeadlineAt" TIMESTAMP(3), ADD COLUMN "scheduledFulfilmentAt" TIMESTAMP(3), ADD COLUMN "reviewedByUserId" TEXT, ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "acceptedByUserId" TEXT, ADD COLUMN "acceptedAt" TIMESTAMP(3), ADD COLUMN "acceptedPreparationMinutes" INTEGER,
  ADD COLUMN "acceptedPickupInstructions" TEXT, ADD COLUMN "operationalSnapshot" JSONB, ADD COLUMN "operationalVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "MarketplaceStoreOrderLineFulfilment" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL, "marketplaceOrderLineId" TEXT NOT NULL,
  "orderedQuantity" INTEGER NOT NULL, "confirmedAvailableQuantity" INTEGER NOT NULL DEFAULT 0, "resolvedFulfilmentQuantity" INTEGER NOT NULL DEFAULT 0, "handedOffQuantity" INTEGER NOT NULL DEFAULT 0,
  "status" "StoreOrderLineFulfilmentStatus" NOT NULL DEFAULT 'ORDERED', "substitutionPreference" "StoreOrderSubstitutionPreference" NOT NULL DEFAULT 'REFUND_IF_UNAVAILABLE',
  "preferenceChangedAt" TIMESTAMP(3), "preferenceActorUserId" TEXT, "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceStoreOrderLineFulfilment_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderLineFulfilment_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreOrderLineFulfilment_marketplaceOrderLineId_key" UNIQUE ("marketplaceOrderLineId"),
  CONSTRAINT "MarketplaceStoreOrderLineFulfilment_quantity_check" CHECK ("orderedQuantity" > 0 AND "confirmedAvailableQuantity" >= 0 AND "resolvedFulfilmentQuantity" >= 0 AND "handedOffQuantity" >= 0 AND "confirmedAvailableQuantity" <= "orderedQuantity" AND "handedOffQuantity" <= "orderedQuantity" AND "version" > 0)
);

CREATE TABLE "MarketplaceStoreOrderIssue" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL, "marketplaceOrderLineId" TEXT, "lineFulfilmentId" TEXT,
  "issueType" "StoreOrderIssueType" NOT NULL, "reasonCode" TEXT NOT NULL, "affectedQuantity" INTEGER NOT NULL, "status" "StoreOrderIssueStatus" NOT NULL DEFAULT 'OPEN',
  "reportedByUserId" TEXT NOT NULL, "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "customerActionDeadline" TIMESTAMP(3), "resolvedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1, "safeEvidence" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceStoreOrderIssue_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderIssue_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreOrderIssue_quantity_check" CHECK ("affectedQuantity" > 0 AND "version" > 0)
);

CREATE TABLE "MarketplaceStoreOrderSubstitutionProposal" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL, "issueId" TEXT NOT NULL, "lineFulfilmentId" TEXT NOT NULL,
  "substituteProductReference" TEXT NOT NULL, "substituteVariantReference" TEXT NOT NULL, "substituteOfferReference" TEXT NOT NULL,
  "substituteInventoryItemId" TEXT NOT NULL, "substituteInventoryLevelId" TEXT NOT NULL, "substituteQuantity" INTEGER NOT NULL,
  "customerCharge" DECIMAL(18,2) NOT NULL, "originalRemainingCharge" DECIMAL(18,2) NOT NULL, "taxEvidence" JSONB NOT NULL,
  "publicationVersion" TEXT NOT NULL, "priceVersion" TEXT NOT NULL, "sellerIdentityEvidence" JSONB NOT NULL,
  "status" "StoreOrderSubstitutionProposalStatus" NOT NULL DEFAULT 'PROPOSED', "expiresAt" TIMESTAMP(3) NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "proposedByUserId" TEXT NOT NULL, "immutableEvidence" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "decidedAt" TIMESTAMP(3),
  CONSTRAINT "MarketplaceStoreOrderSubstitutionProposal_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderSubstitutionProposal_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreOrderSubstitutionProposal_money_check" CHECK ("substituteQuantity" > 0 AND "customerCharge" >= 0 AND "originalRemainingCharge" >= 0 AND "customerCharge" <= "originalRemainingCharge" AND "version" > 0)
);

CREATE TABLE "MarketplaceStoreOrderSubstitutionReservation" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "proposalId" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL, "inventoryLevelId" TEXT NOT NULL, "quantity" INTEGER NOT NULL, "status" "StoreOrderSubstitutionReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, "releasedAt" TIMESTAMP(3), "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceStoreOrderSubstitutionReservation_pkey" PRIMARY KEY ("id"), CONSTRAINT "MSOSubReservation_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreOrderSubstitutionReservation_proposalId_key" UNIQUE ("proposalId"), CONSTRAINT "MSOSubReservation_store_operation_key" UNIQUE ("marketplaceStoreOrderId","operationId"),
  CONSTRAINT "MarketplaceStoreOrderSubstitutionReservation_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "MarketplaceStoreOrderCustomerDecision" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "proposalId" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL,
  "decision" "StoreOrderCustomerDecision" NOT NULL, "customerUserId" TEXT, "guestDecisionHash" TEXT, "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "evidence" JSONB NOT NULL, "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceStoreOrderCustomerDecision_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderCustomerDecision_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreOrderCustomerDecision_proposalId_key" UNIQUE ("proposalId"), CONSTRAINT "MarketplaceStoreOrderCustomerDecision_store_operation_key" UNIQUE ("marketplaceStoreOrderId","operationId"),
  CONSTRAINT "MarketplaceStoreOrderCustomerDecision_owner_check" CHECK (("customerUserId" IS NOT NULL) <> ("guestDecisionHash" IS NOT NULL))
);

CREATE TABLE "MarketplaceStoreOrderAdjustment" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL,
  "adjustmentType" "StoreOrderAdjustmentType" NOT NULL, "status" "StoreOrderAdjustmentStatus" NOT NULL DEFAULT 'DRAFT',
  "reasonCode" TEXT NOT NULL, "sourceVersion" TEXT NOT NULL, "adjustmentVersion" INTEGER NOT NULL DEFAULT 1,
  "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "customerDecisionReference" TEXT, "refundId" TEXT, "reconciliationCaseId" TEXT,
  "deliveryFeeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "refundAmount" DECIMAL(18,2) NOT NULL DEFAULT 0, "financialEvidence" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "appliedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceStoreOrderAdjustment_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderAdjustment_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreOrderAdjustment_store_operation_key" UNIQUE ("marketplaceStoreOrderId","operationId"),
  CONSTRAINT "MarketplaceStoreOrderAdjustment_money_check" CHECK ("adjustmentVersion" > 0 AND "deliveryFeeAmount" >= 0 AND "refundAmount" >= 0)
);

CREATE TABLE "MarketplaceStoreOrderAdjustmentAllocation" (
  "id" TEXT NOT NULL, "adjustmentId" TEXT NOT NULL, "marketplaceOrderLineId" TEXT,
  "allocationType" "MarketplaceOrderLineAllocationType" NOT NULL, "resolvedQuantityBefore" INTEGER NOT NULL, "resolvedQuantityAfter" INTEGER NOT NULL, "originalQuantity" INTEGER NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL, "taxAmount" DECIMAL(18,2), "sourceAllocationVersion" TEXT NOT NULL, "roundingSequence" INTEGER NOT NULL, "finalCentRecipient" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceStoreOrderAdjustmentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MarketplaceStoreOrderAdjustmentAllocation_unique" UNIQUE ("adjustmentId","marketplaceOrderLineId","allocationType"),
  CONSTRAINT "MarketplaceStoreOrderAdjustmentAllocation_quantity_check" CHECK ("originalQuantity" > 0 AND "resolvedQuantityBefore" >= 0 AND "resolvedQuantityAfter" >= "resolvedQuantityBefore" AND "resolvedQuantityAfter" <= "originalQuantity" AND "amount" >= 0 AND "roundingSequence" >= 0)
);

CREATE TABLE "MarketplaceStoreOrderAmendment" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL, "adjustmentId" TEXT NOT NULL, "marketplaceOrderLineId" TEXT,
  "amendmentVersion" INTEGER NOT NULL, "originalEvidence" JSONB NOT NULL, "finalEvidence" JSONB NOT NULL, "customerDecisionReference" TEXT,
  "financialEvidence" JSONB NOT NULL, "actorUserId" TEXT, "fingerprint" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceStoreOrderAmendment_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderAmendment_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreOrderAmendment_fingerprint_key" UNIQUE ("fingerprint"), CONSTRAINT "MarketplaceStoreOrderAmendment_store_version_key" UNIQUE ("marketplaceStoreOrderId","amendmentVersion"),
  CONSTRAINT "MarketplaceStoreOrderAmendment_version_check" CHECK ("amendmentVersion" > 0)
);

CREATE TABLE "MarketplaceStoreOrderCancellationRequest" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL,
  "requesterType" "StoreOrderCancellationRequesterType" NOT NULL, "requesterUserId" TEXT, "reasonCode" TEXT NOT NULL, "safeNote" TEXT,
  "status" "StoreOrderCancellationRequestStatus" NOT NULL DEFAULT 'REQUESTED', "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "decisionEvidence" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "decidedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceStoreOrderCancellationRequest_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderCancellationRequest_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreOrderCancellationRequest_store_operation_key" UNIQUE ("marketplaceStoreOrderId","operationId")
);

CREATE TABLE "MarketplaceStoreOrderDeliveryBridge" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL,
  "courierOrderId" TEXT, "courierOrderReference" TEXT, "deliveryQuoteReference" TEXT, "deliveryQuoteVersion" TEXT,
  "status" "StoreOrderDeliveryBridgeStatus" NOT NULL DEFAULT 'NOT_REQUESTED', "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "dispatchEvidence" JSONB, "failureCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceStoreOrderDeliveryBridge_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderDeliveryBridge_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreOrderDeliveryBridge_store_key" UNIQUE ("marketplaceStoreOrderId"), CONSTRAINT "MarketplaceStoreOrderDeliveryBridge_courier_id_key" UNIQUE ("courierOrderId"),
  CONSTRAINT "MarketplaceStoreOrderDeliveryBridge_courier_reference_key" UNIQUE ("courierOrderReference"), CONSTRAINT "MarketplaceStoreOrderDeliveryBridge_store_operation_key" UNIQUE ("marketplaceStoreOrderId","operationId")
);

CREATE TABLE "MarketplaceStoreOrderPickupHandoff" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL, "courierOrderId" TEXT NOT NULL, "assignmentId" TEXT NOT NULL, "driverProfileId" TEXT NOT NULL,
  "challengeHash" TEXT NOT NULL, "challengeVersion" INTEGER NOT NULL DEFAULT 1, "expiresAt" TIMESTAMP(3) NOT NULL, "status" "StoreOrderHandoffStatus" NOT NULL DEFAULT 'CHALLENGE_ACTIVE',
  "packageEvidence" JSONB, "sealEvidence" JSONB, "storeVerifiedByUserId" TEXT, "driverVerifiedAt" TIMESTAMP(3), "verifiedAt" TIMESTAMP(3),
  "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "failedAttemptCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceStoreOrderPickupHandoff_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderPickupHandoff_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "MarketplaceStoreOrderPickupHandoff_store_key" UNIQUE ("marketplaceStoreOrderId"), CONSTRAINT "MarketplaceStoreOrderPickupHandoff_attempt_check" CHECK ("challengeVersion" > 0 AND "failedAttemptCount" >= 0)
);

CREATE TABLE "MarketplaceStoreOrderHistory" (
  "id" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL, "operationId" TEXT NOT NULL, "eventType" TEXT NOT NULL, "actorUserId" TEXT,
  "fromEvidence" JSONB, "toEvidence" JSONB, "safeEvidence" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceStoreOrderHistory_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderHistory_unique" UNIQUE ("marketplaceStoreOrderId","operationId","eventType")
);

CREATE TABLE "MarketplaceStoreOrderOperation" (
  "id" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL, "operationId" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "operationType" TEXT NOT NULL, "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceStoreOrderOperation_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderOperation_unique" UNIQUE ("marketplaceStoreOrderId","operationId")
);

CREATE TABLE "MarketplaceStoreOrderEventIntent" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL, "eventType" TEXT NOT NULL, "payload" JSONB NOT NULL, "dedupeKey" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceStoreOrderEventIntent_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderEventIntent_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "MarketplaceStoreOrderEventIntent_dedupeKey_key" UNIQUE ("dedupeKey")
);

CREATE TABLE "MarketplaceStoreOrderReconciliationCase" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "caseKey" TEXT NOT NULL, "marketplaceStoreOrderId" TEXT NOT NULL, "adjustmentId" TEXT, "refundId" TEXT,
  "reasonCode" TEXT NOT NULL, "status" "StoreOrderReconciliationStatus" NOT NULL DEFAULT 'OPEN', "priority" "StoreOrderReconciliationPriority" NOT NULL DEFAULT 'MEDIUM',
  "observationCount" INTEGER NOT NULL DEFAULT 1, "safeSummary" TEXT NOT NULL, "safeEvidence" JSONB, "retryOperationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "resolvedAt" TIMESTAMP(3), "resolutionCode" TEXT,
  CONSTRAINT "MarketplaceStoreOrderReconciliationCase_pkey" PRIMARY KEY ("id"), CONSTRAINT "MarketplaceStoreOrderReconciliationCase_publicReference_key" UNIQUE ("publicReference"), CONSTRAINT "MarketplaceStoreOrderReconciliationCase_caseKey_key" UNIQUE ("caseKey"),
  CONSTRAINT "MarketplaceStoreOrderReconciliationCase_count_check" CHECK ("observationCount" > 0)
);

CREATE INDEX "StoreOrderOperationalPolicy_status_effectiveFrom_idx" ON "StoreOrderOperationalPolicy"("status","effectiveFrom");
CREATE INDEX "SOPolicyHistory_policy_created_idx" ON "StoreOrderOperationalPolicyHistory"("operationalPolicyId","createdAt");
CREATE INDEX "MarketplaceStoreOrder_store_review_deadline_idx" ON "MarketplaceStoreOrder"("storeId","acceptanceStatus","reviewDeadlineAt");
CREATE INDEX "MarketplaceStoreOrder_store_queue_idx" ON "MarketplaceStoreOrder"("storeId","reviewDeadlineAt","scheduledFulfilmentAt","createdAt","publicReference");
CREATE INDEX "MarketplaceStoreOrder_store_preparation_bridge_idx" ON "MarketplaceStoreOrder"("storeId","preparationStatus","deliveryBridgeStatus");
CREATE INDEX "MarketplaceStoreOrder_resolution_financial_idx" ON "MarketplaceStoreOrder"("resolutionStatus","financialResolutionStatus");
CREATE INDEX "MarketplaceStoreOrderLineFulfilment_store_status_idx" ON "MarketplaceStoreOrderLineFulfilment"("marketplaceStoreOrderId","status");
CREATE INDEX "MarketplaceStoreOrderIssue_store_status_idx" ON "MarketplaceStoreOrderIssue"("marketplaceStoreOrderId","status");
CREATE INDEX "MarketplaceStoreOrderIssue_line_status_idx" ON "MarketplaceStoreOrderIssue"("marketplaceOrderLineId","status");
CREATE INDEX "MSOSubProposal_store_status_expiry_idx" ON "MarketplaceStoreOrderSubstitutionProposal"("marketplaceStoreOrderId","status","expiresAt");
CREATE INDEX "MarketplaceStoreOrderSubstitutionProposal_issue_status_idx" ON "MarketplaceStoreOrderSubstitutionProposal"("issueId","status");
CREATE INDEX "MarketplaceStoreOrderSubstitutionReservation_status_expiry_idx" ON "MarketplaceStoreOrderSubstitutionReservation"("status","expiresAt");
CREATE INDEX "MSOSubReservation_inventory_status_idx" ON "MarketplaceStoreOrderSubstitutionReservation"("inventoryItemId","inventoryLevelId","status");
CREATE INDEX "MarketplaceStoreOrderCustomerDecision_store_decided_idx" ON "MarketplaceStoreOrderCustomerDecision"("marketplaceStoreOrderId","decidedAt");
CREATE INDEX "MarketplaceStoreOrderAdjustment_store_status_idx" ON "MarketplaceStoreOrderAdjustment"("marketplaceStoreOrderId","status");
CREATE INDEX "MarketplaceStoreOrderAdjustment_status_created_idx" ON "MarketplaceStoreOrderAdjustment"("status","createdAt");
CREATE INDEX "MarketplaceStoreOrderAdjustmentAllocation_line_created_idx" ON "MarketplaceStoreOrderAdjustmentAllocation"("marketplaceOrderLineId","createdAt");
CREATE INDEX "MarketplaceStoreOrderAmendment_line_created_idx" ON "MarketplaceStoreOrderAmendment"("marketplaceOrderLineId","createdAt");
CREATE INDEX "MarketplaceStoreOrderCancellationRequest_store_status_idx" ON "MarketplaceStoreOrderCancellationRequest"("marketplaceStoreOrderId","status");
CREATE INDEX "MarketplaceStoreOrderDeliveryBridge_status_created_idx" ON "MarketplaceStoreOrderDeliveryBridge"("status","createdAt");
CREATE INDEX "MarketplaceStoreOrderPickupHandoff_courier_status_idx" ON "MarketplaceStoreOrderPickupHandoff"("courierOrderId","status");
CREATE INDEX "MarketplaceStoreOrderPickupHandoff_assignment_status_idx" ON "MarketplaceStoreOrderPickupHandoff"("assignmentId","status");
CREATE INDEX "MarketplaceStoreOrderHistory_store_created_idx" ON "MarketplaceStoreOrderHistory"("marketplaceStoreOrderId","createdAt");
CREATE INDEX "MarketplaceStoreOrderOperation_type_created_idx" ON "MarketplaceStoreOrderOperation"("operationType","createdAt");
CREATE INDEX "MarketplaceStoreOrderEventIntent_published_created_idx" ON "MarketplaceStoreOrderEventIntent"("publishedAt","createdAt");
CREATE INDEX "MSOReconciliation_status_priority_created_idx" ON "MarketplaceStoreOrderReconciliationCase"("status","priority","createdAt");
CREATE INDEX "MarketplaceStoreOrderReconciliationCase_store_status_idx" ON "MarketplaceStoreOrderReconciliationCase"("marketplaceStoreOrderId","status");

ALTER TABLE "MarketplaceStoreOrder" ADD CONSTRAINT "MarketplaceStoreOrder_operationalPolicyId_fkey" FOREIGN KEY ("operationalPolicyId") REFERENCES "StoreOrderOperationalPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreOrderOperationalPolicyHistory" ADD CONSTRAINT "SOPolicyHistory_policy_fkey" FOREIGN KEY ("operationalPolicyId") REFERENCES "StoreOrderOperationalPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderLineFulfilment" ADD CONSTRAINT "MarketplaceStoreOrderLineFulfilment_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderLineFulfilment" ADD CONSTRAINT "MarketplaceStoreOrderLineFulfilment_line_fkey" FOREIGN KEY ("marketplaceOrderLineId") REFERENCES "MarketplaceOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderIssue" ADD CONSTRAINT "MarketplaceStoreOrderIssue_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderIssue" ADD CONSTRAINT "MarketplaceStoreOrderIssue_line_fkey" FOREIGN KEY ("marketplaceOrderLineId") REFERENCES "MarketplaceOrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderIssue" ADD CONSTRAINT "MarketplaceStoreOrderIssue_fulfilment_fkey" FOREIGN KEY ("lineFulfilmentId") REFERENCES "MarketplaceStoreOrderLineFulfilment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderSubstitutionProposal" ADD CONSTRAINT "MarketplaceStoreOrderSubstitutionProposal_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderSubstitutionProposal" ADD CONSTRAINT "MarketplaceStoreOrderSubstitutionProposal_issue_fkey" FOREIGN KEY ("issueId") REFERENCES "MarketplaceStoreOrderIssue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderSubstitutionProposal" ADD CONSTRAINT "MarketplaceStoreOrderSubstitutionProposal_fulfilment_fkey" FOREIGN KEY ("lineFulfilmentId") REFERENCES "MarketplaceStoreOrderLineFulfilment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderSubstitutionReservation" ADD CONSTRAINT "MarketplaceStoreOrderSubstitutionReservation_proposal_fkey" FOREIGN KEY ("proposalId") REFERENCES "MarketplaceStoreOrderSubstitutionProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderSubstitutionReservation" ADD CONSTRAINT "MarketplaceStoreOrderSubstitutionReservation_level_fkey" FOREIGN KEY ("inventoryLevelId") REFERENCES "CatalogInventoryLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderCustomerDecision" ADD CONSTRAINT "MarketplaceStoreOrderCustomerDecision_proposal_fkey" FOREIGN KEY ("proposalId") REFERENCES "MarketplaceStoreOrderSubstitutionProposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderAdjustment" ADD CONSTRAINT "MarketplaceStoreOrderAdjustment_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderAdjustment" ADD CONSTRAINT "MSOAdjustment_refund_fkey" FOREIGN KEY ("refundId") REFERENCES "PaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderAdjustmentAllocation" ADD CONSTRAINT "MarketplaceStoreOrderAdjustmentAllocation_adjustment_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "MarketplaceStoreOrderAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderAmendment" ADD CONSTRAINT "MarketplaceStoreOrderAmendment_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderAmendment" ADD CONSTRAINT "MarketplaceStoreOrderAmendment_adjustment_fkey" FOREIGN KEY ("adjustmentId") REFERENCES "MarketplaceStoreOrderAdjustment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderCancellationRequest" ADD CONSTRAINT "MarketplaceStoreOrderCancellationRequest_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderDeliveryBridge" ADD CONSTRAINT "MarketplaceStoreOrderDeliveryBridge_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderDeliveryBridge" ADD CONSTRAINT "MSODeliveryBridge_courier_fkey" FOREIGN KEY ("courierOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderPickupHandoff" ADD CONSTRAINT "MarketplaceStoreOrderPickupHandoff_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderHistory" ADD CONSTRAINT "MarketplaceStoreOrderHistory_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderOperation" ADD CONSTRAINT "MarketplaceStoreOrderOperation_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderEventIntent" ADD CONSTRAINT "MarketplaceStoreOrderEventIntent_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderReconciliationCase" ADD CONSTRAINT "MarketplaceStoreOrderReconciliationCase_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceStoreOrderReconciliationCase" ADD CONSTRAINT "MSOReconciliation_refund_fkey" FOREIGN KEY ("refundId") REFERENCES "PaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
