-- Phase 17: additive driver-earning entitlement and delivery-settlement evidence.
-- The runtime remains source-locked pending consolidated production validation.

ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'DRIVER_EARNINGS_PAYABLE';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'DRIVER_EARNING_ACCRUAL';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'DRIVER_EARNING_RELEASE';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'DRIVER_EARNING_REVERSAL';
ALTER TYPE "RefundFundingSourceType" ADD VALUE IF NOT EXISTS 'DRIVER_EARNINGS_PAYABLE';

DO $$ BEGIN CREATE TYPE "DriverEarningSubjectType" AS ENUM ('COURIER_DELIVERY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DriverEarningStatus" AS ENUM ('ACCRUED', 'RECONCILIATION_REQUIRED', 'RELEASED', 'FULLY_REFUNDED', 'REVERSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DriverEarningHistoryActorType" AS ENUM ('SYSTEM', 'USER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "DriverEarningReconciliationReason" AS ENUM (
    'ASSIGNMENT_DRIVER_MISMATCH', 'ASSIGNMENT_VERSION_MISMATCH', 'DELIVERY_EVIDENCE_MISSING',
    'DELIVERY_EVIDENCE_CONFLICT', 'SETTLEMENT_BASIS_MISMATCH', 'COMMISSION_ATTRIBUTION_MISMATCH',
    'COMMISSION_OVER_ATTRIBUTION', 'DUPLICATE_DRIVER_SETTLEMENT', 'LEDGER_LINK_MISSING',
    'LEDGER_AMOUNT_MISMATCH', 'REFUND_ADJUSTMENT_MISMATCH', 'REFUND_AFTER_RELEASE',
    'RELEASE_WITH_OPEN_REFUND', 'RELEASE_WITH_OPEN_INCIDENT', 'RELEASE_BALANCE_MISMATCH',
    'REVERSAL_BLOCKED_BY_COMMISSION', 'REVERSAL_AFTER_RELEASE', 'DRIVER_ACCOUNT_MISMATCH',
    'STALE_ACCRUAL', 'APPLICATION_FAILURE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DriverEarningReconciliationStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DriverEarningReconciliationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "CommissionAllocation" ADD COLUMN "driverAttributedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "RefundFundingAllocation" ADD COLUMN "driverEarningId" TEXT;

CREATE TABLE "DriverEarning" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "driverId" TEXT NOT NULL,
  "driverPublicReference" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "payableAccountId" TEXT NOT NULL,
  "subjectType" "DriverEarningSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "subjectPublicReference" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "assignmentPublicReference" TEXT NOT NULL,
  "assignmentVersion" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderPublicReference" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "paymentPublicReference" TEXT NOT NULL,
  "settlementReference" TEXT NOT NULL,
  "settlementVersion" TEXT NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "completionEvidenceReference" TEXT NOT NULL,
  "serviceCompletedAt" TIMESTAMP(3) NOT NULL,
  "authoritativeAt" TIMESTAMP(3) NOT NULL,
  "settlementBasisAmount" DECIMAL(18,2) NOT NULL,
  "attributedCommissionAmount" DECIMAL(18,2) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "status" "DriverEarningStatus" NOT NULL DEFAULT 'ACCRUED',
  "creationIdempotencyKey" TEXT NOT NULL,
  "creationRequestHash" TEXT NOT NULL,
  "calculationHash" TEXT NOT NULL,
  "accrualLedgerJournalId" TEXT NOT NULL,
  "releaseLedgerJournalId" TEXT,
  "reversalLedgerJournalId" TEXT,
  "refundReservedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "refundedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "releasedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "reversedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "releaseEligibleAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "reversedAt" TIMESTAMP(3),
  "reversalReasonCode" TEXT,
  "reversalEvidenceReference" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DriverEarning_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DriverEarning_amount_check" CHECK (
    "currency" = 'ZAR' AND "settlementBasisAmount" > 0 AND "attributedCommissionAmount" >= 0
    AND "amount" > 0 AND "settlementBasisAmount" - "attributedCommissionAmount" = "amount"
  ),
  CONSTRAINT "DriverEarning_time_check" CHECK (
    "authoritativeAt" >= "serviceCompletedAt" AND ("releaseEligibleAt" IS NULL OR "releaseEligibleAt" >= "serviceCompletedAt")
  ),
  CONSTRAINT "DriverEarning_projection_check" CHECK (
    "refundReservedAmount" >= 0 AND "refundedAmount" >= 0 AND "releasedAmount" >= 0 AND "reversedAmount" >= 0
    AND "refundReservedAmount" + "refundedAmount" + "releasedAmount" + "reversedAmount" <= "amount"
  ),
  CONSTRAINT "DriverEarning_terminal_evidence_check" CHECK (
    ("status" = 'RELEASED' AND "releaseLedgerJournalId" IS NOT NULL AND "releasedAmount" > 0 AND "releasedAt" IS NOT NULL AND "reversalLedgerJournalId" IS NULL AND "reversedAmount" = 0)
    OR ("status" = 'REVERSED' AND "reversalLedgerJournalId" IS NOT NULL AND "reversedAmount" > 0 AND "reversedAt" IS NOT NULL AND "reversalReasonCode" IS NOT NULL AND "reversalEvidenceReference" IS NOT NULL AND "releaseLedgerJournalId" IS NULL AND "releasedAmount" = 0)
    OR ("status" = 'FULLY_REFUNDED' AND "refundedAmount" = "amount" AND "refundReservedAmount" = 0 AND "releaseLedgerJournalId" IS NULL AND "reversalLedgerJournalId" IS NULL AND "releasedAmount" = 0 AND "reversedAmount" = 0)
    OR ("status" IN ('ACCRUED', 'RECONCILIATION_REQUIRED') AND "releaseLedgerJournalId" IS NULL AND "reversalLedgerJournalId" IS NULL AND "releasedAmount" = 0 AND "reversedAmount" = 0)
  )
);

CREATE TABLE "DriverEarningCommissionCharge" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "driverEarningId" TEXT NOT NULL,
  "commissionAllocationId" TEXT NOT NULL, "amount" DECIMAL(18,2) NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverEarningCommissionCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DriverEarningCommissionCharge_amount_check" CHECK ("amount" > 0 AND "currency" = 'ZAR')
);

CREATE TABLE "DriverEarningStatusHistory" (
  "id" TEXT NOT NULL, "driverEarningId" TEXT NOT NULL, "fromStatus" "DriverEarningStatus",
  "toStatus" "DriverEarningStatus" NOT NULL, "actorType" "DriverEarningHistoryActorType" NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT, "reasonCode" TEXT, "safeMetadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverEarningStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DriverEarningReconciliationCase" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "caseKey" TEXT NOT NULL, "driverEarningId" TEXT NOT NULL,
  "refundId" TEXT, "commissionAccrualId" TEXT, "reason" "DriverEarningReconciliationReason" NOT NULL,
  "status" "DriverEarningReconciliationStatus" NOT NULL DEFAULT 'OPEN', "priority" "DriverEarningReconciliationPriority" NOT NULL DEFAULT 'MEDIUM',
  "observationCount" INTEGER NOT NULL DEFAULT 1, "safeSummary" TEXT NOT NULL, "safeEvidence" JSONB,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3), "resolutionCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DriverEarningReconciliationCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DriverEarningReconciliationCase_observation_check" CHECK ("observationCount" > 0)
);

ALTER TABLE "CommissionAllocation" DROP CONSTRAINT "CommissionAllocation_store_attribution_check";
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_combined_attribution_check"
  CHECK ("storeAttributedAmount" >= 0 AND "driverAttributedAmount" >= 0 AND "storeAttributedAmount" + "driverAttributedAmount" <= "amount");

ALTER TABLE "RefundFundingAllocation" DROP CONSTRAINT "RefundFundingAllocation_source_shape_check";
ALTER TABLE "RefundFundingAllocation" ADD CONSTRAINT "RefundFundingAllocation_source_shape_check" CHECK (
  ("sourceType" = 'CUSTOMER_FUNDS_HELD' AND "commissionAccrualId" IS NULL AND "commissionAllocationId" IS NULL AND "storeEarningId" IS NULL AND "driverEarningId" IS NULL)
  OR ("sourceType" IN ('PLATFORM_COMMISSION_REVENUE', 'BENEFICIARY_COMMISSION_PAYABLE') AND "commissionAccrualId" IS NOT NULL AND "commissionAllocationId" IS NOT NULL AND "storeEarningId" IS NULL AND "driverEarningId" IS NULL)
  OR ("sourceType" = 'STORE_EARNINGS_PAYABLE' AND "commissionAccrualId" IS NULL AND "commissionAllocationId" IS NULL AND "storeEarningId" IS NOT NULL AND "driverEarningId" IS NULL)
  OR ("sourceType" = 'DRIVER_EARNINGS_PAYABLE' AND "commissionAccrualId" IS NULL AND "commissionAllocationId" IS NULL AND "storeEarningId" IS NULL AND "driverEarningId" IS NOT NULL)
);

CREATE UNIQUE INDEX "DriverEarning_publicReference_key" ON "DriverEarning"("publicReference");
CREATE UNIQUE INDEX "DriverEarning_creationIdempotencyKey_key" ON "DriverEarning"("creationIdempotencyKey");
CREATE UNIQUE INDEX "DriverEarning_accrualLedgerJournalId_key" ON "DriverEarning"("accrualLedgerJournalId");
CREATE UNIQUE INDEX "DriverEarning_releaseLedgerJournalId_key" ON "DriverEarning"("releaseLedgerJournalId");
CREATE UNIQUE INDEX "DriverEarning_reversalLedgerJournalId_key" ON "DriverEarning"("reversalLedgerJournalId");
CREATE UNIQUE INDEX "DriverEarning_subject_assignment_driver_settlement_key" ON "DriverEarning"("subjectType", "subjectId", "assignmentId", "driverId", "settlementVersion");
CREATE INDEX "DriverEarning_driver_status_createdAt_idx" ON "DriverEarning"("driverId", "status", "createdAt");
CREATE INDEX "DriverEarning_wallet_status_idx" ON "DriverEarning"("walletId", "status");
CREATE INDEX "DriverEarning_assignment_createdAt_idx" ON "DriverEarning"("assignmentId", "createdAt");
CREATE INDEX "DriverEarning_order_createdAt_idx" ON "DriverEarning"("orderId", "createdAt");
CREATE INDEX "DriverEarning_payment_createdAt_idx" ON "DriverEarning"("paymentId", "createdAt");
CREATE INDEX "DriverEarning_subjectReference_createdAt_idx" ON "DriverEarning"("subjectPublicReference", "createdAt");
CREATE INDEX "DriverEarning_releaseEligibleAt_status_idx" ON "DriverEarning"("releaseEligibleAt", "status");
CREATE UNIQUE INDEX "DriverEarningCommissionCharge_publicReference_key" ON "DriverEarningCommissionCharge"("publicReference");
CREATE UNIQUE INDEX "DriverEarningCommissionCharge_earning_allocation_key" ON "DriverEarningCommissionCharge"("driverEarningId", "commissionAllocationId");
CREATE INDEX "DriverEarningCommissionCharge_allocation_createdAt_idx" ON "DriverEarningCommissionCharge"("commissionAllocationId", "createdAt");
CREATE INDEX "DriverEarningStatusHistory_earning_createdAt_idx" ON "DriverEarningStatusHistory"("driverEarningId", "createdAt");
CREATE INDEX "DriverEarningStatusHistory_status_createdAt_idx" ON "DriverEarningStatusHistory"("toStatus", "createdAt");
CREATE INDEX "DriverEarningStatusHistory_actor_idx" ON "DriverEarningStatusHistory"("actorId");
CREATE UNIQUE INDEX "DriverEarningReconciliationCase_publicReference_key" ON "DriverEarningReconciliationCase"("publicReference");
CREATE UNIQUE INDEX "DriverEarningReconciliationCase_caseKey_key" ON "DriverEarningReconciliationCase"("caseKey");
CREATE INDEX "DriverEarningReconciliationCase_status_priority_observed_idx" ON "DriverEarningReconciliationCase"("status", "priority", "lastObservedAt");
CREATE INDEX "DriverEarningReconciliationCase_earning_status_idx" ON "DriverEarningReconciliationCase"("driverEarningId", "status");
CREATE INDEX "DriverEarningReconciliationCase_refund_status_idx" ON "DriverEarningReconciliationCase"("refundId", "status");
CREATE INDEX "DriverEarningReconciliationCase_commission_status_idx" ON "DriverEarningReconciliationCase"("commissionAccrualId", "status");
CREATE INDEX "DriverEarningReconciliationCase_reason_status_idx" ON "DriverEarningReconciliationCase"("reason", "status");
CREATE UNIQUE INDEX "RefundFundingAllocation_refund_driverEarning_key" ON "RefundFundingAllocation"("refundId", "driverEarningId");
CREATE INDEX "RefundFundingAllocation_driverEarning_idx" ON "RefundFundingAllocation"("driverEarningId");

ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_driver_fkey" FOREIGN KEY ("driverId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_wallet_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_payableAccount_fkey" FOREIGN KEY ("payableAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_assignment_fkey" FOREIGN KEY ("assignmentId") REFERENCES "OrderAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_order_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_payment_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_accrualJournal_fkey" FOREIGN KEY ("accrualLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_releaseJournal_fkey" FOREIGN KEY ("releaseLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarning" ADD CONSTRAINT "DriverEarning_reversalJournal_fkey" FOREIGN KEY ("reversalLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarningCommissionCharge" ADD CONSTRAINT "DriverEarningCommissionCharge_earning_fkey" FOREIGN KEY ("driverEarningId") REFERENCES "DriverEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarningCommissionCharge" ADD CONSTRAINT "DriverEarningCommissionCharge_allocation_fkey" FOREIGN KEY ("commissionAllocationId") REFERENCES "CommissionAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarningStatusHistory" ADD CONSTRAINT "DriverEarningStatusHistory_earning_fkey" FOREIGN KEY ("driverEarningId") REFERENCES "DriverEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarningStatusHistory" ADD CONSTRAINT "DriverEarningStatusHistory_actor_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DriverEarningReconciliationCase" ADD CONSTRAINT "DriverEarningReconciliationCase_earning_fkey" FOREIGN KEY ("driverEarningId") REFERENCES "DriverEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarningReconciliationCase" ADD CONSTRAINT "DriverEarningReconciliationCase_refund_fkey" FOREIGN KEY ("refundId") REFERENCES "PaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverEarningReconciliationCase" ADD CONSTRAINT "DriverEarningReconciliationCase_commission_fkey" FOREIGN KEY ("commissionAccrualId") REFERENCES "CommissionAccrual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundFundingAllocation" ADD CONSTRAINT "RefundFundingAllocation_driverEarning_fkey" FOREIGN KEY ("driverEarningId") REFERENCES "DriverEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "phase17_driver_earning_identity_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'driver earning evidence cannot be deleted'; END IF;
  IF ROW(NEW."driverId", NEW."driverPublicReference", NEW."walletId", NEW."payableAccountId", NEW."subjectType", NEW."subjectId", NEW."subjectPublicReference", NEW."assignmentId", NEW."assignmentPublicReference", NEW."assignmentVersion", NEW."orderId", NEW."orderPublicReference", NEW."paymentId", NEW."paymentPublicReference", NEW."settlementReference", NEW."settlementVersion", NEW."calculationVersion", NEW."completionEvidenceReference", NEW."serviceCompletedAt", NEW."authoritativeAt", NEW."settlementBasisAmount", NEW."attributedCommissionAmount", NEW."amount", NEW."currency", NEW."creationIdempotencyKey", NEW."creationRequestHash", NEW."calculationHash", NEW."accrualLedgerJournalId")
    IS DISTINCT FROM ROW(OLD."driverId", OLD."driverPublicReference", OLD."walletId", OLD."payableAccountId", OLD."subjectType", OLD."subjectId", OLD."subjectPublicReference", OLD."assignmentId", OLD."assignmentPublicReference", OLD."assignmentVersion", OLD."orderId", OLD."orderPublicReference", OLD."paymentId", OLD."paymentPublicReference", OLD."settlementReference", OLD."settlementVersion", OLD."calculationVersion", OLD."completionEvidenceReference", OLD."serviceCompletedAt", OLD."authoritativeAt", OLD."settlementBasisAmount", OLD."attributedCommissionAmount", OLD."amount", OLD."currency", OLD."creationIdempotencyKey", OLD."creationRequestHash", OLD."calculationHash", OLD."accrualLedgerJournalId")
  THEN RAISE EXCEPTION 'driver earning financial identity is immutable'; END IF;
  IF OLD."releaseLedgerJournalId" IS NOT NULL AND NEW."releaseLedgerJournalId" IS DISTINCT FROM OLD."releaseLedgerJournalId" THEN RAISE EXCEPTION 'driver earning release journal is immutable'; END IF;
  IF OLD."reversalLedgerJournalId" IS NOT NULL AND NEW."reversalLedgerJournalId" IS DISTINCT FROM OLD."reversalLedgerJournalId" THEN RAISE EXCEPTION 'driver earning reversal journal is immutable'; END IF;
  IF OLD."refundedAmount" > NEW."refundedAmount" OR OLD."releasedAmount" > NEW."releasedAmount" OR OLD."reversedAmount" > NEW."reversedAmount" THEN RAISE EXCEPTION 'completed driver projections cannot decrease'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "DriverEarning_identity_immutable" BEFORE UPDATE OR DELETE ON "DriverEarning" FOR EACH ROW EXECUTE FUNCTION "phase17_driver_earning_identity_guard"();

CREATE OR REPLACE FUNCTION "phase17_driver_account_and_journal_guard"() RETURNS TRIGGER AS $$
DECLARE driver_wallet "Wallet"%ROWTYPE; DECLARE payable "LedgerAccount"%ROWTYPE; DECLARE payment_row "Payment"%ROWTYPE; DECLARE assignment_row "OrderAssignment"%ROWTYPE;
BEGIN
  SELECT * INTO STRICT driver_wallet FROM "Wallet" WHERE "id" = NEW."walletId";
  SELECT * INTO STRICT payable FROM "LedgerAccount" WHERE "id" = NEW."payableAccountId";
  SELECT * INTO STRICT payment_row FROM "Payment" WHERE "id" = NEW."paymentId";
  SELECT * INTO STRICT assignment_row FROM "OrderAssignment" WHERE "id" = NEW."assignmentId";
  IF driver_wallet."ownerType" <> 'DRIVER' OR driver_wallet."ownerId" <> NEW."driverId" OR driver_wallet."currency" <> 'ZAR' OR driver_wallet."status" <> 'ACTIVE' THEN RAISE EXCEPTION 'driver earning wallet is invalid'; END IF;
  IF payable."walletId" <> NEW."walletId" OR payable."purpose" <> 'DRIVER_EARNINGS_PAYABLE' OR payable."category" <> 'LIABILITY' OR payable."currency" <> 'ZAR' OR payable."status" <> 'ACTIVE' OR payable."allowNegative" THEN RAISE EXCEPTION 'driver payable is invalid'; END IF;
  -- Mutable operational/payment evidence is authoritative at accrual time. Later
  -- invalidation must remain reversible; immutable snapshot columns preserve what
  -- was originally accepted while release/reversal services re-read live state.
  IF TG_OP = 'INSERT' THEN
    IF assignment_row."driverProfileId" <> NEW."driverId" OR assignment_row."orderId" <> NEW."orderId" OR assignment_row."version"::text <> NEW."assignmentVersion" OR assignment_row."status" <> 'COMPLETED' OR assignment_row."completedAt" IS DISTINCT FROM NEW."serviceCompletedAt" THEN RAISE EXCEPTION 'assignment completion evidence is invalid'; END IF;
    IF NOT EXISTS (SELECT 1 FROM "ProofOfDelivery" p WHERE p."assignmentId" = NEW."assignmentId" AND p."orderId" = NEW."orderId" AND p."driverProfileId" = NEW."driverId" AND p."deliveredAt" = NEW."serviceCompletedAt") THEN RAISE EXCEPTION 'proof of delivery evidence is invalid'; END IF;
    IF payment_row."orderId" <> NEW."orderId" OR payment_row."paymentNumber" <> NEW."paymentPublicReference" OR payment_row."status" <> 'SUCCEEDED' OR payment_row."currency" <> 'ZAR' OR payment_row."successLedgerJournalId" IS NULL THEN RAISE EXCEPTION 'driver payment evidence is invalid'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "LedgerJournal" j WHERE j."id" = NEW."accrualLedgerJournalId" AND j."type" = 'DRIVER_EARNING_ACCRUAL' AND j."totalDebits" = NEW."amount" AND j."totalCredits" = NEW."amount" AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id"=e."accountId" JOIN "Wallet" w ON w."id"=a."walletId" WHERE e."journalId"=j."id" AND e."direction"='DEBIT' AND e."amount"=NEW."amount" AND a."purpose"='HELD' AND w."ownerType"='PLATFORM') AND EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."journalId"=j."id" AND e."direction"='CREDIT' AND e."amount"=NEW."amount" AND e."accountId"=NEW."payableAccountId")) THEN RAISE EXCEPTION 'driver accrual journal evidence is invalid'; END IF;
  IF NEW."releaseLedgerJournalId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "LedgerJournal" j WHERE j."id"=NEW."releaseLedgerJournalId" AND j."type"='DRIVER_EARNING_RELEASE' AND j."totalDebits"=NEW."releasedAmount" AND j."totalCredits"=NEW."releasedAmount" AND EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."journalId"=j."id" AND e."direction"='DEBIT' AND e."accountId"=NEW."payableAccountId" AND e."amount"=NEW."releasedAmount") AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id"=e."accountId" WHERE e."journalId"=j."id" AND e."direction"='CREDIT' AND e."amount"=NEW."releasedAmount" AND a."walletId"=NEW."walletId" AND a."purpose"='OWNER_WITHDRAWABLE')) THEN RAISE EXCEPTION 'driver release journal evidence is invalid'; END IF;
  IF NEW."reversalLedgerJournalId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "LedgerJournal" j WHERE j."id"=NEW."reversalLedgerJournalId" AND j."type"='DRIVER_EARNING_REVERSAL' AND j."totalDebits"=NEW."reversedAmount" AND j."totalCredits"=NEW."reversedAmount" AND EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."journalId"=j."id" AND e."direction"='DEBIT' AND e."accountId"=NEW."payableAccountId" AND e."amount"=NEW."reversedAmount") AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id"=e."accountId" JOIN "Wallet" w ON w."id"=a."walletId" WHERE e."journalId"=j."id" AND e."direction"='CREDIT' AND e."amount"=NEW."reversedAmount" AND a."purpose"='HELD' AND w."ownerType"='PLATFORM')) THEN RAISE EXCEPTION 'driver reversal journal evidence is invalid'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "DriverEarning_account_and_journal_evidence" BEFORE INSERT OR UPDATE ON "DriverEarning" FOR EACH ROW EXECUTE FUNCTION "phase17_driver_account_and_journal_guard"();

CREATE OR REPLACE FUNCTION "phase17_driver_payable_guard"() RETURNS TRIGGER AS $$ DECLARE account_wallet "Wallet"%ROWTYPE;
BEGIN
  IF NEW."purpose" <> 'DRIVER_EARNINGS_PAYABLE' THEN RETURN NEW; END IF;
  SELECT * INTO STRICT account_wallet FROM "Wallet" WHERE "id"=NEW."walletId";
  IF account_wallet."ownerType" <> 'DRIVER' OR account_wallet."currency" <> 'ZAR' OR account_wallet."status" <> 'ACTIVE' OR NEW."category" <> 'LIABILITY' OR NEW."currency" <> 'ZAR' OR NEW."allowNegative" THEN RAISE EXCEPTION 'driver payable policy is invalid'; END IF;
  IF TG_OP='INSERT' AND (NEW."currentBalance"<>0 OR NEW."debitTotal"<>0 OR NEW."creditTotal"<>0) THEN RAISE EXCEPTION 'driver payable must open at zero'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "LedgerAccount_driver_payable_policy" BEFORE INSERT OR UPDATE ON "LedgerAccount" FOR EACH ROW EXECUTE FUNCTION "phase17_driver_payable_guard"();

CREATE OR REPLACE FUNCTION "phase17_driver_charge_guard"() RETURNS TRIGGER AS $$ BEGIN IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'driver commission charge evidence is immutable'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "DriverEarningCommissionCharge_immutable" BEFORE UPDATE OR DELETE ON "DriverEarningCommissionCharge" FOR EACH ROW EXECUTE FUNCTION "phase17_driver_charge_guard"();
CREATE OR REPLACE FUNCTION "phase17_driver_history_guard"() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'driver earning history is immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "DriverEarningStatusHistory_immutable" BEFORE UPDATE OR DELETE ON "DriverEarningStatusHistory" FOR EACH ROW EXECUTE FUNCTION "phase17_driver_history_guard"();
CREATE OR REPLACE FUNCTION "phase17_driver_reconciliation_delete_guard"() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'driver reconciliation evidence cannot be deleted'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "DriverEarningReconciliationCase_no_delete" BEFORE DELETE ON "DriverEarningReconciliationCase" FOR EACH ROW EXECUTE FUNCTION "phase17_driver_reconciliation_delete_guard"();

CREATE OR REPLACE FUNCTION "phase17_combined_attribution_check"() RETURNS TRIGGER AS $$ DECLARE item RECORD;
BEGIN
  FOR item IN SELECT e."id", e."attributedCommissionAmount" expected, COALESCE(SUM(c."amount"),0) actual FROM "DriverEarning" e LEFT JOIN "DriverEarningCommissionCharge" c ON c."driverEarningId"=e."id" GROUP BY e."id",e."attributedCommissionAmount" LOOP IF item.expected<>item.actual THEN RAISE EXCEPTION 'driver charge sum mismatch'; END IF; END LOOP;
  FOR item IN SELECT a."id",a."storeAttributedAmount" store_projected,a."driverAttributedAmount" driver_projected,a."amount" original,COALESCE((SELECT SUM(sc."amount") FROM "StoreEarningCommissionCharge" sc WHERE sc."commissionAllocationId"=a."id"),0) store_actual,COALESCE((SELECT SUM(dc."amount") FROM "DriverEarningCommissionCharge" dc WHERE dc."commissionAllocationId"=a."id"),0) driver_actual FROM "CommissionAllocation" a LOOP IF item.store_projected<>item.store_actual OR item.driver_projected<>item.driver_actual OR item.store_actual+item.driver_actual>item.original THEN RAISE EXCEPTION 'combined commission attribution mismatch'; END IF; END LOOP;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "DriverEarning_charge_sum" AFTER INSERT OR UPDATE ON "DriverEarning" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase17_combined_attribution_check"();
CREATE CONSTRAINT TRIGGER "DriverEarningCommissionCharge_projection" AFTER INSERT OR UPDATE OR DELETE ON "DriverEarningCommissionCharge" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase17_combined_attribution_check"();
CREATE CONSTRAINT TRIGGER "CommissionAllocation_combined_projection" AFTER INSERT OR UPDATE ON "CommissionAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase17_combined_attribution_check"();

CREATE OR REPLACE FUNCTION "phase15_refund_funding_guard"() RETURNS TRIGGER AS $$
DECLARE account_row "LedgerAccount"%ROWTYPE; DECLARE allocation_row "CommissionAllocation"%ROWTYPE; DECLARE store_row "StoreEarning"%ROWTYPE; DECLARE driver_row "DriverEarning"%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'refund funding evidence cannot be deleted'; END IF; IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'refund funding evidence is immutable'; END IF;
  SELECT * INTO STRICT account_row FROM "LedgerAccount" WHERE "id"=NEW."ledgerAccountId";
  IF NEW."sourceType"='CUSTOMER_FUNDS_HELD' THEN IF NEW."commissionAccrualId" IS NOT NULL OR NEW."commissionAllocationId" IS NOT NULL OR NEW."storeEarningId" IS NOT NULL OR NEW."driverEarningId" IS NOT NULL OR account_row."purpose"<>'HELD' OR account_row."category"<>'LIABILITY' THEN RAISE EXCEPTION 'customer refund source invalid'; END IF;
  ELSIF NEW."sourceType"='STORE_EARNINGS_PAYABLE' THEN SELECT * INTO STRICT store_row FROM "StoreEarning" WHERE "id"=NEW."storeEarningId"; IF NEW."driverEarningId" IS NOT NULL OR NEW."commissionAccrualId" IS NOT NULL OR NEW."commissionAllocationId" IS NOT NULL OR store_row."payableAccountId"<>NEW."ledgerAccountId" OR store_row."status"<>'ACCRUED' OR store_row."releaseLedgerJournalId" IS NOT NULL OR store_row."reversalLedgerJournalId" IS NOT NULL THEN RAISE EXCEPTION 'store refund source invalid'; END IF;
  ELSIF NEW."sourceType"='DRIVER_EARNINGS_PAYABLE' THEN SELECT * INTO STRICT driver_row FROM "DriverEarning" WHERE "id"=NEW."driverEarningId"; IF NEW."storeEarningId" IS NOT NULL OR NEW."commissionAccrualId" IS NOT NULL OR NEW."commissionAllocationId" IS NOT NULL OR driver_row."payableAccountId"<>NEW."ledgerAccountId" OR driver_row."status"<>'ACCRUED' OR driver_row."releaseLedgerJournalId" IS NOT NULL OR driver_row."reversalLedgerJournalId" IS NOT NULL OR account_row."purpose"<>'DRIVER_EARNINGS_PAYABLE' OR account_row."category"<>'LIABILITY' THEN RAISE EXCEPTION 'driver refund source invalid'; END IF;
  ELSE IF NEW."storeEarningId" IS NOT NULL OR NEW."driverEarningId" IS NOT NULL THEN RAISE EXCEPTION 'commission refund source cannot reference earnings'; END IF; SELECT * INTO STRICT allocation_row FROM "CommissionAllocation" WHERE "id"=NEW."commissionAllocationId"; IF allocation_row."accrualId"<>NEW."commissionAccrualId" OR allocation_row."ledgerAccountId"<>NEW."ledgerAccountId" OR allocation_row."status"<>'ACCRUED' OR allocation_row."downstreamReleaseJournalId" IS NOT NULL THEN RAISE EXCEPTION 'commission refund source invalid'; END IF; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "phase17_driver_refund_projection_check"() RETURNS TRIGGER AS $$ DECLARE item RECORD;
BEGIN
  FOR item IN SELECT e."id",e."refundReservedAmount",e."refundedAmount",COALESCE(SUM(f."amount") FILTER (WHERE r."status" IN ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','RECONCILIATION_REQUIRED')),0) reserved,COALESCE(SUM(f."amount") FILTER (WHERE r."status"='SUCCEEDED'),0) refunded FROM "DriverEarning" e LEFT JOIN "RefundFundingAllocation" f ON f."driverEarningId"=e."id" AND f."sourceType"='DRIVER_EARNINGS_PAYABLE' LEFT JOIN "PaymentRefund" r ON r."id"=f."refundId" GROUP BY e."id",e."refundReservedAmount",e."refundedAmount" LOOP IF item."refundReservedAmount"<>item.reserved OR item."refundedAmount"<>item.refunded THEN RAISE EXCEPTION 'driver refund projection mismatch'; END IF; END LOOP;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "DriverEarning_refund_projection" AFTER INSERT OR UPDATE ON "DriverEarning" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase17_driver_refund_projection_check"();
CREATE CONSTRAINT TRIGGER "RefundFundingAllocation_driver_projection" AFTER INSERT OR UPDATE OR DELETE ON "RefundFundingAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase17_driver_refund_projection_check"();
CREATE CONSTRAINT TRIGGER "PaymentRefund_driver_projection" AFTER INSERT OR UPDATE ON "PaymentRefund" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase17_driver_refund_projection_check"();

COMMENT ON COLUMN "CommissionAllocation"."driverAttributedAmount" IS 'Phase 17 projection backed exactly by immutable DriverEarningCommissionCharge rows.';
COMMENT ON COLUMN "RefundFundingAllocation"."driverEarningId" IS 'Required only for authoritative DRIVER_EARNINGS_PAYABLE funding; generic refund inference is prohibited.';
COMMENT ON TABLE "DriverEarning" IS 'Dormant Phase 17 per-assignment driver entitlement evidence; financial entry points remain source-locked.';
