-- Phase 14: additive commission policy and accounting foundation.
-- This migration deliberately preserves the legacy "CommissionRule" and
-- "CommissionTransaction" placeholders. They are not reinterpreted as money.

ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'COMMISSION_PAYABLE';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'COMMISSION_ACCRUAL';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'COMMISSION_REVERSAL';

DO $$ BEGIN
  CREATE TYPE "CommissionSubjectType" AS ENUM ('COURIER_ORDER', 'MARKETPLACE_STORE_ORDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CommissionPlanStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CommissionBasisType" AS ENUM ('ORDER_SUBTOTAL', 'ORDER_TOTAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CommissionAllocationType" AS ENUM ('PLATFORM_COMMISSION_REVENUE', 'BENEFICIARY_COMMISSION_PAYABLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CommissionBeneficiaryType" AS ENUM ('PLATFORM', 'PROMOTER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CommissionCalculationMethod" AS ENUM ('PERCENTAGE_BPS', 'FIXED_AMOUNT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CommissionAccrualStatus" AS ENUM ('ACCRUED', 'REVERSED', 'RECONCILIATION_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CommissionAllocationStatus" AS ENUM ('ACCRUED', 'RELEASED', 'REVERSED', 'RECONCILIATION_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CommissionHistoryActorType" AS ENUM ('SYSTEM', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CommissionReconciliationReason" AS ENUM ('POLICY_OVERLAP', 'POLICY_NOT_FOUND', 'CALCULATION_MISMATCH', 'BASIS_MISMATCH', 'TOTAL_EXCEEDS_BASIS', 'DUPLICATE_ACCRUAL', 'LEDGER_LINK_MISSING', 'LEDGER_AMOUNT_MISMATCH', 'BENEFICIARY_ACCOUNT_MISMATCH', 'DOWNSTREAM_RELEASE_EXISTS', 'REVERSAL_BLOCKED', 'STALE_ACCRUAL', 'APPLICATION_FAILURE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CommissionReconciliationStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CommissionReconciliationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE "CommissionPlan" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "subjectType" "CommissionSubjectType" NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "versionNumber" INTEGER NOT NULL,
  "status" "CommissionPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "basisType" "CommissionBasisType" NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveUntil" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "submittedByUserId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "retiredByUserId" TEXT,
  "retiredAt" TIMESTAMP(3),
  "supersedesPlanId" TEXT,
  "calculationVersion" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionPlan_effective_range_check" CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom")
);

CREATE TABLE "CommissionPolicyRule" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "ruleCode" TEXT NOT NULL,
  "allocationType" "CommissionAllocationType" NOT NULL,
  "beneficiaryType" "CommissionBeneficiaryType" NOT NULL,
  "calculationMethod" "CommissionCalculationMethod" NOT NULL,
  "rateBasisPoints" INTEGER,
  "fixedAmount" DECIMAL(18,2),
  "minimumAmount" DECIMAL(18,2),
  "maximumAmount" DECIMAL(18,2),
  "priority" INTEGER NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionPolicyRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionPolicyRule_calculation_shape_check" CHECK (("calculationMethod" = 'PERCENTAGE_BPS' AND "rateBasisPoints" BETWEEN 0 AND 10000 AND "fixedAmount" IS NULL) OR ("calculationMethod" = 'FIXED_AMOUNT' AND "fixedAmount" IS NOT NULL AND "fixedAmount" >= 0 AND "rateBasisPoints" IS NULL)),
  CONSTRAINT "CommissionPolicyRule_limits_check" CHECK (("minimumAmount" IS NULL OR "minimumAmount" >= 0) AND ("maximumAmount" IS NULL OR "maximumAmount" >= 0) AND ("minimumAmount" IS NULL OR "maximumAmount" IS NULL OR "minimumAmount" <= "maximumAmount")),
  CONSTRAINT "CommissionPolicyRule_beneficiary_check" CHECK (("allocationType" = 'PLATFORM_COMMISSION_REVENUE' AND "beneficiaryType" = 'PLATFORM') OR ("allocationType" = 'BENEFICIARY_COMMISSION_PAYABLE' AND "beneficiaryType" = 'PROMOTER'))
);

CREATE TABLE "CommissionAccrual" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "subjectType" "CommissionSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "subjectPublicReference" TEXT NOT NULL,
  "settlementVersion" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "planVersionNumber" INTEGER NOT NULL,
  "basisType" "CommissionBasisType" NOT NULL,
  "basisAmount" DECIMAL(18,2) NOT NULL,
  "basisSnapshot" JSONB NOT NULL,
  "authoritativeAt" TIMESTAMP(3) NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "totalAmount" DECIMAL(18,2) NOT NULL,
  "status" "CommissionAccrualStatus" NOT NULL DEFAULT 'ACCRUED',
  "creationIdempotencyKey" TEXT NOT NULL,
  "creationRequestHash" TEXT NOT NULL,
  "calculationHash" TEXT NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "ledgerJournalId" TEXT NOT NULL,
  "reversalLedgerJournalId" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reversalReasonCode" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionAccrual_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionAccrual_amount_check" CHECK ("basisAmount" > 0 AND "totalAmount" > 0 AND "totalAmount" <= "basisAmount")
);

CREATE TABLE "CommissionAllocation" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "accrualId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "allocationType" "CommissionAllocationType" NOT NULL,
  "beneficiaryType" "CommissionBeneficiaryType" NOT NULL,
  "beneficiaryOwnerId" TEXT,
  "beneficiaryWalletId" TEXT,
  "ledgerAccountId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "status" "CommissionAllocationStatus" NOT NULL DEFAULT 'ACCRUED',
  "attributionReference" TEXT,
  "attributionVersion" TEXT,
  "downstreamReleaseJournalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionAllocation_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "CommissionAllocation_beneficiary_check" CHECK (("allocationType" = 'PLATFORM_COMMISSION_REVENUE' AND "beneficiaryType" = 'PLATFORM' AND "beneficiaryOwnerId" IS NULL AND "beneficiaryWalletId" IS NULL) OR ("allocationType" = 'BENEFICIARY_COMMISSION_PAYABLE' AND "beneficiaryType" = 'PROMOTER' AND "beneficiaryOwnerId" IS NOT NULL AND "beneficiaryWalletId" IS NOT NULL))
);

CREATE TABLE "CommissionStatusHistory" (
  "id" TEXT NOT NULL,
  "accrualId" TEXT NOT NULL,
  "fromStatus" "CommissionAccrualStatus",
  "toStatus" "CommissionAccrualStatus" NOT NULL,
  "actorType" "CommissionHistoryActorType" NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "reasonCode" TEXT,
  "safeMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommissionReconciliationCase" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "caseKey" TEXT NOT NULL,
  "accrualId" TEXT NOT NULL,
  "allocationId" TEXT,
  "reason" "CommissionReconciliationReason" NOT NULL,
  "status" "CommissionReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "CommissionReconciliationPriority" NOT NULL DEFAULT 'MEDIUM',
  "observationCount" INTEGER NOT NULL DEFAULT 1,
  "safeSummary" TEXT NOT NULL,
  "safeEvidence" JSONB,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommissionReconciliationCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionReconciliationCase_observation_check" CHECK ("observationCount" > 0)
);

CREATE UNIQUE INDEX "CommissionPlan_publicReference_key" ON "CommissionPlan"("publicReference");
CREATE UNIQUE INDEX "CommissionPlan_subjectType_scopeKey_currency_versionNumber_key" ON "CommissionPlan"("subjectType", "scopeKey", "currency", "versionNumber");
CREATE INDEX "CommissionPlan_scope_status_effective_idx" ON "CommissionPlan"("subjectType", "scopeKey", "currency", "status", "effectiveFrom");
CREATE INDEX "CommissionPlan_status_effective_range_idx" ON "CommissionPlan"("status", "effectiveFrom", "effectiveUntil");
CREATE UNIQUE INDEX "CommissionPolicyRule_publicReference_key" ON "CommissionPolicyRule"("publicReference");
CREATE UNIQUE INDEX "CommissionPolicyRule_plan_ruleCode_key" ON "CommissionPolicyRule"("planId", "ruleCode");
CREATE UNIQUE INDEX "CommissionPolicyRule_plan_priority_key" ON "CommissionPolicyRule"("planId", "priority");
CREATE INDEX "CommissionPolicyRule_plan_priority_idx" ON "CommissionPolicyRule"("planId", "priority");
CREATE UNIQUE INDEX "CommissionAccrual_publicReference_key" ON "CommissionAccrual"("publicReference");
CREATE UNIQUE INDEX "CommissionAccrual_creationIdempotencyKey_key" ON "CommissionAccrual"("creationIdempotencyKey");
CREATE UNIQUE INDEX "CommissionAccrual_ledgerJournalId_key" ON "CommissionAccrual"("ledgerJournalId");
CREATE UNIQUE INDEX "CommissionAccrual_reversalLedgerJournalId_key" ON "CommissionAccrual"("reversalLedgerJournalId");
CREATE UNIQUE INDEX "CommissionAccrual_subject_settlement_key" ON "CommissionAccrual"("subjectType", "subjectId", "settlementVersion");
CREATE INDEX "CommissionAccrual_plan_status_createdAt_idx" ON "CommissionAccrual"("planId", "status", "createdAt");
CREATE INDEX "CommissionAccrual_subjectPublicReference_createdAt_idx" ON "CommissionAccrual"("subjectPublicReference", "createdAt");
CREATE UNIQUE INDEX "CommissionAllocation_publicReference_key" ON "CommissionAllocation"("publicReference");
CREATE UNIQUE INDEX "CommissionAllocation_downstreamReleaseJournalId_key" ON "CommissionAllocation"("downstreamReleaseJournalId");
CREATE UNIQUE INDEX "CommissionAllocation_accrual_rule_wallet_key" ON "CommissionAllocation"("accrualId", "ruleId", "beneficiaryWalletId");
CREATE INDEX "CommissionAllocation_accrual_status_idx" ON "CommissionAllocation"("accrualId", "status");
CREATE INDEX "CommissionAllocation_beneficiaryOwner_status_idx" ON "CommissionAllocation"("beneficiaryOwnerId", "status");
CREATE INDEX "CommissionStatusHistory_accrual_createdAt_idx" ON "CommissionStatusHistory"("accrualId", "createdAt");
CREATE INDEX "CommissionStatusHistory_status_createdAt_idx" ON "CommissionStatusHistory"("toStatus", "createdAt");
CREATE UNIQUE INDEX "CommissionReconciliationCase_publicReference_key" ON "CommissionReconciliationCase"("publicReference");
CREATE UNIQUE INDEX "CommissionReconciliationCase_caseKey_key" ON "CommissionReconciliationCase"("caseKey");
CREATE INDEX "CommissionReconciliationCase_status_priority_lastObservedAt_idx" ON "CommissionReconciliationCase"("status", "priority", "lastObservedAt");
CREATE INDEX "CommissionReconciliationCase_accrual_status_idx" ON "CommissionReconciliationCase"("accrualId", "status");
CREATE INDEX "CommissionReconciliationCase_allocation_status_idx" ON "CommissionReconciliationCase"("allocationId", "status");
CREATE INDEX "CommissionReconciliationCase_reason_status_idx" ON "CommissionReconciliationCase"("reason", "status");

ALTER TABLE "CommissionPlan" ADD CONSTRAINT "CommissionPlan_createdBy_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionPlan" ADD CONSTRAINT "CommissionPlan_submittedBy_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionPlan" ADD CONSTRAINT "CommissionPlan_approvedBy_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionPlan" ADD CONSTRAINT "CommissionPlan_retiredBy_fkey" FOREIGN KEY ("retiredByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionPlan" ADD CONSTRAINT "CommissionPlan_supersedes_fkey" FOREIGN KEY ("supersedesPlanId") REFERENCES "CommissionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionPolicyRule" ADD CONSTRAINT "CommissionPolicyRule_plan_fkey" FOREIGN KEY ("planId") REFERENCES "CommissionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionAccrual" ADD CONSTRAINT "CommissionAccrual_plan_fkey" FOREIGN KEY ("planId") REFERENCES "CommissionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionAccrual" ADD CONSTRAINT "CommissionAccrual_ledger_fkey" FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionAccrual" ADD CONSTRAINT "CommissionAccrual_reversalLedger_fkey" FOREIGN KEY ("reversalLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_accrual_fkey" FOREIGN KEY ("accrualId") REFERENCES "CommissionAccrual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_rule_fkey" FOREIGN KEY ("ruleId") REFERENCES "CommissionPolicyRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionAllocation" ADD CONSTRAINT "CommissionAllocation_account_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionStatusHistory" ADD CONSTRAINT "CommissionStatusHistory_accrual_fkey" FOREIGN KEY ("accrualId") REFERENCES "CommissionAccrual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionStatusHistory" ADD CONSTRAINT "CommissionStatusHistory_actor_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommissionReconciliationCase" ADD CONSTRAINT "CommissionReconciliationCase_accrual_fkey" FOREIGN KEY ("accrualId") REFERENCES "CommissionAccrual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionReconciliationCase" ADD CONSTRAINT "CommissionReconciliationCase_allocation_fkey" FOREIGN KEY ("allocationId") REFERENCES "CommissionAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "phase14_commission_plan_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."status" = 'ACTIVE' AND (
    NEW."subjectType" IS DISTINCT FROM OLD."subjectType" OR NEW."scopeKey" IS DISTINCT FROM OLD."scopeKey" OR NEW."currency" IS DISTINCT FROM OLD."currency" OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber" OR NEW."basisType" IS DISTINCT FROM OLD."basisType" OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom" OR NEW."effectiveUntil" IS DISTINCT FROM OLD."effectiveUntil" OR NEW."calculationVersion" IS DISTINCT FROM OLD."calculationVersion"
  ) THEN RAISE EXCEPTION 'active commission plans are immutable'; END IF;
  IF TG_OP = 'DELETE' AND EXISTS (SELECT 1 FROM "CommissionAccrual" WHERE "planId" = OLD."id") THEN RAISE EXCEPTION 'commission plan with accrual evidence cannot be deleted'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "CommissionPlan_immutability" BEFORE UPDATE OR DELETE ON "CommissionPlan" FOR EACH ROW EXECUTE FUNCTION "phase14_commission_plan_guard"();

CREATE OR REPLACE FUNCTION "phase14_commission_rule_guard"() RETURNS TRIGGER AS $$
DECLARE active_plan BOOLEAN;
BEGIN
  SELECT "status" = 'ACTIVE' INTO active_plan FROM "CommissionPlan" WHERE "id" = COALESCE(NEW."planId", OLD."planId");
  IF active_plan THEN RAISE EXCEPTION 'rules of active commission plans are immutable'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "CommissionPolicyRule_immutability" BEFORE UPDATE OR DELETE ON "CommissionPolicyRule" FOR EACH ROW EXECUTE FUNCTION "phase14_commission_rule_guard"();

CREATE OR REPLACE FUNCTION "phase14_commission_active_overlap_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'ACTIVE' AND EXISTS (
    SELECT 1 FROM "CommissionPlan" p WHERE p."id" <> NEW."id" AND p."status" = 'ACTIVE' AND p."subjectType" = NEW."subjectType" AND p."scopeKey" = NEW."scopeKey" AND p."currency" = NEW."currency" AND p."effectiveFrom" < COALESCE(NEW."effectiveUntil", 'infinity'::timestamp) AND NEW."effectiveFrom" < COALESCE(p."effectiveUntil", 'infinity'::timestamp)
  ) THEN RAISE EXCEPTION 'active commission plan effective periods overlap'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "CommissionPlan_no_active_overlap" BEFORE INSERT OR UPDATE ON "CommissionPlan" FOR EACH ROW EXECUTE FUNCTION "phase14_commission_active_overlap_guard"();

CREATE OR REPLACE FUNCTION "phase14_commission_accrual_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."subjectType", NEW."subjectId", NEW."settlementVersion", NEW."planId", NEW."basisAmount", NEW."basisSnapshot", NEW."totalAmount", NEW."creationIdempotencyKey", NEW."creationRequestHash", NEW."calculationHash", NEW."ledgerJournalId") IS DISTINCT FROM (OLD."subjectType", OLD."subjectId", OLD."settlementVersion", OLD."planId", OLD."basisAmount", OLD."basisSnapshot", OLD."totalAmount", OLD."creationIdempotencyKey", OLD."creationRequestHash", OLD."calculationHash", OLD."ledgerJournalId") THEN RAISE EXCEPTION 'commission accrual financial identity is immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'commission accrual evidence cannot be deleted'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "CommissionAccrual_immutability" BEFORE UPDATE OR DELETE ON "CommissionAccrual" FOR EACH ROW EXECUTE FUNCTION "phase14_commission_accrual_guard"();

CREATE OR REPLACE FUNCTION "phase14_commission_allocation_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'commission allocation evidence cannot be deleted'; END IF;
  IF (NEW."accrualId", NEW."ruleId", NEW."allocationType", NEW."beneficiaryType", NEW."beneficiaryOwnerId", NEW."beneficiaryWalletId", NEW."ledgerAccountId", NEW."amount", NEW."currency", NEW."attributionReference", NEW."attributionVersion") IS DISTINCT FROM (OLD."accrualId", OLD."ruleId", OLD."allocationType", OLD."beneficiaryType", OLD."beneficiaryOwnerId", OLD."beneficiaryWalletId", OLD."ledgerAccountId", OLD."amount", OLD."currency", OLD."attributionReference", OLD."attributionVersion") THEN RAISE EXCEPTION 'commission allocation identity is immutable'; END IF;
  IF OLD."status" = 'RELEASED' AND NEW."status" = 'REVERSED' THEN RAISE EXCEPTION 'released commission allocation cannot be directly reversed'; END IF;
  IF OLD."status" = 'REVERSED' AND NEW."status" = 'RELEASED' THEN RAISE EXCEPTION 'reversed commission allocation cannot be released'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "CommissionAllocation_immutability" BEFORE UPDATE OR DELETE ON "CommissionAllocation" FOR EACH ROW EXECUTE FUNCTION "phase14_commission_allocation_guard"();

CREATE OR REPLACE FUNCTION "phase14_commission_history_guard"() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'commission status history is immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "CommissionStatusHistory_immutable" BEFORE UPDATE OR DELETE ON "CommissionStatusHistory" FOR EACH ROW EXECUTE FUNCTION "phase14_commission_history_guard"();

CREATE TABLE "CommissionPlanStatusHistory" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "fromStatus" "CommissionPlanStatus",
  "toStatus" "CommissionPlanStatus" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "reasonCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionPlanStatusHistory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CommissionPlanStatusHistory_plan_operation_key" ON "CommissionPlanStatusHistory"("planId", "operationId");
CREATE INDEX "CommissionPlanStatusHistory_plan_createdAt_idx" ON "CommissionPlanStatusHistory"("planId", "createdAt");
ALTER TABLE "CommissionPlanStatusHistory" ADD CONSTRAINT "CommissionPlanStatusHistory_plan_fkey" FOREIGN KEY ("planId") REFERENCES "CommissionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommissionPlanStatusHistory" ADD CONSTRAINT "CommissionPlanStatusHistory_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE OR REPLACE FUNCTION "phase14_commission_plan_history_guard"() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'commission plan status history is immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "CommissionPlanStatusHistory_immutable" BEFORE UPDATE OR DELETE ON "CommissionPlanStatusHistory" FOR EACH ROW EXECUTE FUNCTION "phase14_commission_plan_history_guard"();
