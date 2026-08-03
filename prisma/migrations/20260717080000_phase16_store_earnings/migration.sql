-- Phase 16: additive store-earning entitlement and liability foundation.
-- No marketplace subject, earning, balance or journal is activated by this migration.

ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'STORE_EARNINGS_PAYABLE';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'STORE_EARNING_ACCRUAL';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'STORE_EARNING_RELEASE';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'STORE_EARNING_REVERSAL';
ALTER TYPE "RefundFundingSourceType" ADD VALUE IF NOT EXISTS 'STORE_EARNINGS_PAYABLE';

DO $$ BEGIN
  CREATE TYPE "StoreEarningSubjectType" AS ENUM ('MARKETPLACE_ORDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StoreEarningStatus" AS ENUM ('ACCRUED', 'RELEASED', 'FULLY_REFUNDED', 'REVERSED', 'RECONCILIATION_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StoreEarningHistoryActorType" AS ENUM ('SYSTEM', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StoreEarningReconciliationReason" AS ENUM (
    'SETTLEMENT_BASIS_MISMATCH',
    'COMMISSION_ATTRIBUTION_MISMATCH',
    'COMMISSION_OVER_ATTRIBUTION',
    'DUPLICATE_STORE_SETTLEMENT',
    'LEDGER_LINK_MISSING',
    'LEDGER_AMOUNT_MISMATCH',
    'REFUND_ADJUSTMENT_MISMATCH',
    'REFUND_AFTER_RELEASE',
    'RELEASE_WITH_OPEN_REFUND',
    'RELEASE_BALANCE_MISMATCH',
    'REVERSAL_BLOCKED_BY_COMMISSION',
    'REVERSAL_AFTER_RELEASE',
    'STORE_ACCOUNT_MISMATCH',
    'STALE_ACCRUAL',
    'APPLICATION_FAILURE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StoreEarningReconciliationStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StoreEarningReconciliationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "CommissionAllocation"
  ADD COLUMN "storeAttributedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE "RefundFundingAllocation"
  ADD COLUMN "storeEarningId" TEXT;

CREATE TABLE "StoreEarning" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "storePublicReference" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "payableAccountId" TEXT NOT NULL,
  "subjectType" "StoreEarningSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "subjectPublicReference" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "paymentPublicReference" TEXT NOT NULL,
  "settlementReference" TEXT NOT NULL,
  "settlementVersion" TEXT NOT NULL,
  "calculationVersion" TEXT NOT NULL,
  "authoritativeAt" TIMESTAMP(3) NOT NULL,
  "settlementBasisAmount" DECIMAL(18,2) NOT NULL,
  "attributedCommissionAmount" DECIMAL(18,2) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "status" "StoreEarningStatus" NOT NULL DEFAULT 'ACCRUED',
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
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreEarning_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreEarning_amount_check" CHECK (
    "currency" = 'ZAR'
    AND "settlementBasisAmount" > 0
    AND "attributedCommissionAmount" >= 0
    AND "amount" > 0
    AND "settlementBasisAmount" - "attributedCommissionAmount" = "amount"
  ),
  CONSTRAINT "StoreEarning_projection_check" CHECK (
    "refundReservedAmount" >= 0
    AND "refundedAmount" >= 0
    AND "releasedAmount" >= 0
    AND "reversedAmount" >= 0
    AND "refundReservedAmount" + "refundedAmount" + "releasedAmount" + "reversedAmount" <= "amount"
  ),
  CONSTRAINT "StoreEarning_terminal_evidence_check" CHECK (
    ("status" = 'RELEASED' AND "releaseLedgerJournalId" IS NOT NULL AND "releasedAmount" > 0 AND "releasedAt" IS NOT NULL AND "reversalLedgerJournalId" IS NULL AND "reversedAmount" = 0)
    OR ("status" = 'REVERSED' AND "reversalLedgerJournalId" IS NOT NULL AND "reversedAmount" > 0 AND "reversedAt" IS NOT NULL AND "releaseLedgerJournalId" IS NULL AND "releasedAmount" = 0)
    OR ("status" = 'FULLY_REFUNDED' AND "refundedAmount" = "amount" AND "refundReservedAmount" = 0 AND "releaseLedgerJournalId" IS NULL AND "reversalLedgerJournalId" IS NULL AND "releasedAmount" = 0 AND "reversedAmount" = 0)
    OR ("status" IN ('ACCRUED', 'RECONCILIATION_REQUIRED') AND "releaseLedgerJournalId" IS NULL AND "reversalLedgerJournalId" IS NULL AND "releasedAmount" = 0 AND "reversedAmount" = 0)
  )
);

CREATE TABLE "StoreEarningCommissionCharge" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "storeEarningId" TEXT NOT NULL,
  "commissionAllocationId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreEarningCommissionCharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreEarningCommissionCharge_amount_check" CHECK ("amount" > 0 AND "currency" = 'ZAR')
);

CREATE TABLE "StoreEarningStatusHistory" (
  "id" TEXT NOT NULL,
  "storeEarningId" TEXT NOT NULL,
  "fromStatus" "StoreEarningStatus",
  "toStatus" "StoreEarningStatus" NOT NULL,
  "actorType" "StoreEarningHistoryActorType" NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "reasonCode" TEXT,
  "safeMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreEarningStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreEarningReconciliationCase" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "caseKey" TEXT NOT NULL,
  "storeEarningId" TEXT NOT NULL,
  "refundId" TEXT,
  "commissionAccrualId" TEXT,
  "reason" "StoreEarningReconciliationReason" NOT NULL,
  "status" "StoreEarningReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "StoreEarningReconciliationPriority" NOT NULL DEFAULT 'MEDIUM',
  "observationCount" INTEGER NOT NULL DEFAULT 1,
  "safeSummary" TEXT NOT NULL,
  "safeEvidence" JSONB,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreEarningReconciliationCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreEarningReconciliationCase_observation_check" CHECK ("observationCount" > 0)
);

ALTER TABLE "CommissionAllocation"
  ADD CONSTRAINT "CommissionAllocation_store_attribution_check"
  CHECK ("storeAttributedAmount" >= 0 AND "storeAttributedAmount" <= "amount");

ALTER TABLE "RefundFundingAllocation" DROP CONSTRAINT "RefundFundingAllocation_source_shape_check";
ALTER TABLE "RefundFundingAllocation"
  ADD CONSTRAINT "RefundFundingAllocation_source_shape_check" CHECK (
    ("sourceType" = 'CUSTOMER_FUNDS_HELD' AND "commissionAccrualId" IS NULL AND "commissionAllocationId" IS NULL AND "storeEarningId" IS NULL)
    OR ("sourceType" IN ('PLATFORM_COMMISSION_REVENUE', 'BENEFICIARY_COMMISSION_PAYABLE') AND "commissionAccrualId" IS NOT NULL AND "commissionAllocationId" IS NOT NULL AND "storeEarningId" IS NULL)
    OR ("sourceType" = 'STORE_EARNINGS_PAYABLE' AND "commissionAccrualId" IS NULL AND "commissionAllocationId" IS NULL AND "storeEarningId" IS NOT NULL)
  );

CREATE UNIQUE INDEX "StoreEarning_publicReference_key" ON "StoreEarning"("publicReference");
CREATE UNIQUE INDEX "StoreEarning_creationIdempotencyKey_key" ON "StoreEarning"("creationIdempotencyKey");
CREATE UNIQUE INDEX "StoreEarning_accrualLedgerJournalId_key" ON "StoreEarning"("accrualLedgerJournalId");
CREATE UNIQUE INDEX "StoreEarning_releaseLedgerJournalId_key" ON "StoreEarning"("releaseLedgerJournalId");
CREATE UNIQUE INDEX "StoreEarning_reversalLedgerJournalId_key" ON "StoreEarning"("reversalLedgerJournalId");
CREATE UNIQUE INDEX "StoreEarning_subject_store_settlement_key" ON "StoreEarning"("subjectType", "subjectId", "storeId", "settlementVersion");
CREATE INDEX "StoreEarning_store_status_createdAt_idx" ON "StoreEarning"("storeId", "status", "createdAt");
CREATE INDEX "StoreEarning_wallet_status_idx" ON "StoreEarning"("walletId", "status");
CREATE INDEX "StoreEarning_payment_createdAt_idx" ON "StoreEarning"("paymentId", "createdAt");
CREATE INDEX "StoreEarning_subjectReference_createdAt_idx" ON "StoreEarning"("subjectPublicReference", "createdAt");
CREATE INDEX "StoreEarning_releaseEligibleAt_status_idx" ON "StoreEarning"("releaseEligibleAt", "status");

CREATE UNIQUE INDEX "StoreEarningCommissionCharge_publicReference_key" ON "StoreEarningCommissionCharge"("publicReference");
CREATE UNIQUE INDEX "StoreEarningCommissionCharge_earning_allocation_key" ON "StoreEarningCommissionCharge"("storeEarningId", "commissionAllocationId");
CREATE INDEX "StoreEarningCommissionCharge_allocation_createdAt_idx" ON "StoreEarningCommissionCharge"("commissionAllocationId", "createdAt");

CREATE INDEX "StoreEarningStatusHistory_earning_createdAt_idx" ON "StoreEarningStatusHistory"("storeEarningId", "createdAt");
CREATE INDEX "StoreEarningStatusHistory_status_createdAt_idx" ON "StoreEarningStatusHistory"("toStatus", "createdAt");
CREATE INDEX "StoreEarningStatusHistory_actor_idx" ON "StoreEarningStatusHistory"("actorId");

CREATE UNIQUE INDEX "StoreEarningReconciliationCase_publicReference_key" ON "StoreEarningReconciliationCase"("publicReference");
CREATE UNIQUE INDEX "StoreEarningReconciliationCase_caseKey_key" ON "StoreEarningReconciliationCase"("caseKey");
CREATE INDEX "StoreEarningReconciliationCase_status_priority_observed_idx" ON "StoreEarningReconciliationCase"("status", "priority", "lastObservedAt");
CREATE INDEX "StoreEarningReconciliationCase_earning_status_idx" ON "StoreEarningReconciliationCase"("storeEarningId", "status");
CREATE INDEX "StoreEarningReconciliationCase_refund_status_idx" ON "StoreEarningReconciliationCase"("refundId", "status");
CREATE INDEX "StoreEarningReconciliationCase_commission_status_idx" ON "StoreEarningReconciliationCase"("commissionAccrualId", "status");
CREATE INDEX "StoreEarningReconciliationCase_reason_status_idx" ON "StoreEarningReconciliationCase"("reason", "status");

CREATE UNIQUE INDEX "RefundFundingAllocation_refund_storeEarning_key" ON "RefundFundingAllocation"("refundId", "storeEarningId");
CREATE INDEX "RefundFundingAllocation_storeEarning_idx" ON "RefundFundingAllocation"("storeEarningId");

ALTER TABLE "StoreEarning" ADD CONSTRAINT "StoreEarning_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreEarning" ADD CONSTRAINT "StoreEarning_wallet_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreEarning" ADD CONSTRAINT "StoreEarning_payableAccount_fkey" FOREIGN KEY ("payableAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreEarning" ADD CONSTRAINT "StoreEarning_payment_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreEarning" ADD CONSTRAINT "StoreEarning_accrualJournal_fkey" FOREIGN KEY ("accrualLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreEarning" ADD CONSTRAINT "StoreEarning_releaseJournal_fkey" FOREIGN KEY ("releaseLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreEarning" ADD CONSTRAINT "StoreEarning_reversalJournal_fkey" FOREIGN KEY ("reversalLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreEarningCommissionCharge" ADD CONSTRAINT "StoreEarningCommissionCharge_earning_fkey" FOREIGN KEY ("storeEarningId") REFERENCES "StoreEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreEarningCommissionCharge" ADD CONSTRAINT "StoreEarningCommissionCharge_allocation_fkey" FOREIGN KEY ("commissionAllocationId") REFERENCES "CommissionAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StoreEarningStatusHistory" ADD CONSTRAINT "StoreEarningStatusHistory_earning_fkey" FOREIGN KEY ("storeEarningId") REFERENCES "StoreEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreEarningStatusHistory" ADD CONSTRAINT "StoreEarningStatusHistory_actor_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoreEarningReconciliationCase" ADD CONSTRAINT "StoreEarningReconciliationCase_earning_fkey" FOREIGN KEY ("storeEarningId") REFERENCES "StoreEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreEarningReconciliationCase" ADD CONSTRAINT "StoreEarningReconciliationCase_refund_fkey" FOREIGN KEY ("refundId") REFERENCES "PaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreEarningReconciliationCase" ADD CONSTRAINT "StoreEarningReconciliationCase_commission_fkey" FOREIGN KEY ("commissionAccrualId") REFERENCES "CommissionAccrual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RefundFundingAllocation" ADD CONSTRAINT "RefundFundingAllocation_storeEarning_fkey" FOREIGN KEY ("storeEarningId") REFERENCES "StoreEarning"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "phase16_store_earning_identity_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'store earning evidence cannot be deleted'; END IF;
  IF (
    NEW."storeId", NEW."storePublicReference", NEW."walletId", NEW."payableAccountId",
    NEW."subjectType", NEW."subjectId", NEW."subjectPublicReference",
    NEW."paymentId", NEW."paymentPublicReference", NEW."settlementReference",
    NEW."settlementVersion", NEW."calculationVersion", NEW."authoritativeAt",
    NEW."settlementBasisAmount", NEW."attributedCommissionAmount", NEW."amount", NEW."currency",
    NEW."creationIdempotencyKey", NEW."creationRequestHash", NEW."calculationHash", NEW."accrualLedgerJournalId"
  ) IS DISTINCT FROM (
    OLD."storeId", OLD."storePublicReference", OLD."walletId", OLD."payableAccountId",
    OLD."subjectType", OLD."subjectId", OLD."subjectPublicReference",
    OLD."paymentId", OLD."paymentPublicReference", OLD."settlementReference",
    OLD."settlementVersion", OLD."calculationVersion", OLD."authoritativeAt",
    OLD."settlementBasisAmount", OLD."attributedCommissionAmount", OLD."amount", OLD."currency",
    OLD."creationIdempotencyKey", OLD."creationRequestHash", OLD."calculationHash", OLD."accrualLedgerJournalId"
  ) THEN RAISE EXCEPTION 'store earning financial identity is immutable'; END IF;
  IF OLD."releaseLedgerJournalId" IS NOT NULL AND NEW."releaseLedgerJournalId" IS DISTINCT FROM OLD."releaseLedgerJournalId" THEN RAISE EXCEPTION 'store earning release journal is immutable'; END IF;
  IF OLD."reversalLedgerJournalId" IS NOT NULL AND NEW."reversalLedgerJournalId" IS DISTINCT FROM OLD."reversalLedgerJournalId" THEN RAISE EXCEPTION 'store earning reversal journal is immutable'; END IF;
  IF OLD."refundedAmount" > NEW."refundedAmount" OR OLD."releasedAmount" > NEW."releasedAmount" OR OLD."reversedAmount" > NEW."reversedAmount" THEN RAISE EXCEPTION 'completed store earning projections cannot decrease'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "StoreEarning_identity_immutable" BEFORE UPDATE OR DELETE ON "StoreEarning" FOR EACH ROW EXECUTE FUNCTION "phase16_store_earning_identity_guard"();

CREATE OR REPLACE FUNCTION "phase16_store_earning_account_and_journal_guard"() RETURNS TRIGGER AS $$
DECLARE store_wallet "Wallet"%ROWTYPE;
DECLARE payable "LedgerAccount"%ROWTYPE;
DECLARE payment_row "Payment"%ROWTYPE;
BEGIN
  SELECT * INTO STRICT store_wallet FROM "Wallet" WHERE "id" = NEW."walletId";
  SELECT * INTO STRICT payable FROM "LedgerAccount" WHERE "id" = NEW."payableAccountId";
  SELECT * INTO STRICT payment_row FROM "Payment" WHERE "id" = NEW."paymentId";
  IF store_wallet."ownerType" <> 'STORE' OR store_wallet."ownerId" <> NEW."storeId" OR store_wallet."currency" <> 'ZAR' OR store_wallet."status" <> 'ACTIVE' THEN RAISE EXCEPTION 'store earning wallet is invalid'; END IF;
  IF payable."walletId" <> NEW."walletId" OR payable."purpose" <> 'STORE_EARNINGS_PAYABLE' OR payable."category" <> 'LIABILITY' OR payable."currency" <> 'ZAR' OR payable."status" <> 'ACTIVE' OR payable."allowNegative" THEN RAISE EXCEPTION 'store earning payable account is invalid'; END IF;
  IF payment_row."paymentNumber" <> NEW."paymentPublicReference" OR payment_row."status" <> 'SUCCEEDED' OR payment_row."currency" <> 'ZAR' OR payment_row."successLedgerJournalId" IS NULL THEN RAISE EXCEPTION 'store earning payment evidence is invalid'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."accrualLedgerJournalId" AND j."type" = 'STORE_EARNING_ACCRUAL' AND j."currency" = 'ZAR'
      AND j."totalDebits" = NEW."amount" AND j."totalCredits" = NEW."amount"
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."amount" AND a."purpose" = 'HELD' AND a."category" = 'LIABILITY' AND w."ownerType" = 'PLATFORM')
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."amount" AND e."accountId" = NEW."payableAccountId")
      AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" WHERE e."journalId" = j."id" AND a."purpose" IN ('CASH_CLEARING', 'OWNER_WITHDRAWABLE'))
  ) THEN RAISE EXCEPTION 'store earning accrual journal evidence is invalid'; END IF;

  IF NEW."releaseLedgerJournalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."releaseLedgerJournalId" AND j."type" = 'STORE_EARNING_RELEASE' AND j."currency" = 'ZAR'
      AND j."totalDebits" = NEW."releasedAmount" AND j."totalCredits" = NEW."releasedAmount"
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."releasedAmount" AND e."accountId" = NEW."payableAccountId")
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."releasedAmount" AND a."walletId" = NEW."walletId" AND a."purpose" = 'OWNER_WITHDRAWABLE' AND a."category" = 'LIABILITY')
      AND NOT EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" WHERE e."journalId" = j."id" AND a."purpose" = 'CASH_CLEARING')
  ) THEN RAISE EXCEPTION 'store earning release journal evidence is invalid'; END IF;

  IF NEW."reversalLedgerJournalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."reversalLedgerJournalId" AND j."type" = 'STORE_EARNING_REVERSAL' AND j."currency" = 'ZAR'
      AND j."totalDebits" = NEW."reversedAmount" AND j."totalCredits" = NEW."reversedAmount"
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."reversedAmount" AND e."accountId" = NEW."payableAccountId")
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."reversedAmount" AND a."purpose" = 'HELD' AND a."category" = 'LIABILITY' AND w."ownerType" = 'PLATFORM')
  ) THEN RAISE EXCEPTION 'store earning reversal journal evidence is invalid'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "StoreEarning_account_and_journal_evidence" BEFORE INSERT OR UPDATE ON "StoreEarning" FOR EACH ROW EXECUTE FUNCTION "phase16_store_earning_account_and_journal_guard"();

CREATE OR REPLACE FUNCTION "phase16_store_payable_account_guard"() RETURNS TRIGGER AS $$
DECLARE account_wallet "Wallet"%ROWTYPE;
BEGIN
  IF NEW."purpose" <> 'STORE_EARNINGS_PAYABLE' THEN RETURN NEW; END IF;
  SELECT * INTO STRICT account_wallet FROM "Wallet" WHERE "id" = NEW."walletId";
  IF account_wallet."ownerType" <> 'STORE' OR account_wallet."currency" <> 'ZAR' OR account_wallet."status" <> 'ACTIVE' OR NEW."category" <> 'LIABILITY' OR NEW."currency" <> 'ZAR' OR NEW."allowNegative" THEN
    RAISE EXCEPTION 'store earnings payable account policy is invalid';
  END IF;
  IF TG_OP = 'INSERT' AND (NEW."currentBalance" <> 0 OR NEW."debitTotal" <> 0 OR NEW."creditTotal" <> 0) THEN RAISE EXCEPTION 'store earnings payable account must open at zero'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "LedgerAccount_store_payable_policy" BEFORE INSERT OR UPDATE ON "LedgerAccount" FOR EACH ROW EXECUTE FUNCTION "phase16_store_payable_account_guard"();

CREATE OR REPLACE FUNCTION "phase16_store_charge_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN RAISE EXCEPTION 'store commission attribution charge evidence is immutable'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "StoreEarningCommissionCharge_immutable" BEFORE UPDATE OR DELETE ON "StoreEarningCommissionCharge" FOR EACH ROW EXECUTE FUNCTION "phase16_store_charge_guard"();

CREATE OR REPLACE FUNCTION "phase16_store_history_guard"() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'store earning status history is immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "StoreEarningStatusHistory_immutable" BEFORE UPDATE OR DELETE ON "StoreEarningStatusHistory" FOR EACH ROW EXECUTE FUNCTION "phase16_store_history_guard"();

CREATE OR REPLACE FUNCTION "phase16_store_reconciliation_delete_guard"() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'store earning reconciliation evidence cannot be deleted'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "StoreEarningReconciliationCase_no_delete" BEFORE DELETE ON "StoreEarningReconciliationCase" FOR EACH ROW EXECUTE FUNCTION "phase16_store_reconciliation_delete_guard"();

CREATE OR REPLACE FUNCTION "phase16_store_attribution_check"() RETURNS TRIGGER AS $$
DECLARE item RECORD;
BEGIN
  FOR item IN
    SELECT e."id" AS earning_id, e."attributedCommissionAmount" AS expected, COALESCE(SUM(c."amount"), 0) AS actual
    FROM "StoreEarning" e LEFT JOIN "StoreEarningCommissionCharge" c ON c."storeEarningId" = e."id"
    GROUP BY e."id", e."attributedCommissionAmount"
  LOOP
    IF item.expected <> item.actual THEN RAISE EXCEPTION 'store earning commission charges do not equal attributed commission'; END IF;
  END LOOP;
  FOR item IN
    SELECT a."id" AS allocation_id, a."storeAttributedAmount" AS projected, COALESCE(SUM(c."amount"), 0) AS actual, a."amount" AS original
    FROM "CommissionAllocation" a LEFT JOIN "StoreEarningCommissionCharge" c ON c."commissionAllocationId" = a."id"
    GROUP BY a."id", a."storeAttributedAmount", a."amount"
  LOOP
    IF item.projected <> item.actual OR item.actual > item.original THEN RAISE EXCEPTION 'commission allocation store attribution projection is incoherent'; END IF;
  END LOOP;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "StoreEarning_charge_sum" AFTER INSERT OR UPDATE ON "StoreEarning" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase16_store_attribution_check"();
CREATE CONSTRAINT TRIGGER "StoreEarningCommissionCharge_projection" AFTER INSERT OR UPDATE OR DELETE ON "StoreEarningCommissionCharge" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase16_store_attribution_check"();
CREATE CONSTRAINT TRIGGER "CommissionAllocation_store_projection" AFTER INSERT OR UPDATE ON "CommissionAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase16_store_attribution_check"();

CREATE OR REPLACE FUNCTION "phase15_refund_funding_guard"() RETURNS TRIGGER AS $$
DECLARE account_row "LedgerAccount"%ROWTYPE;
DECLARE allocation_row "CommissionAllocation"%ROWTYPE;
DECLARE earning_row "StoreEarning"%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'refund funding evidence cannot be deleted'; END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'refund funding evidence is immutable'; END IF;
  SELECT * INTO STRICT account_row FROM "LedgerAccount" WHERE "id" = NEW."ledgerAccountId";
  IF NEW."sourceType" = 'CUSTOMER_FUNDS_HELD' THEN
    IF NEW."commissionAccrualId" IS NOT NULL OR NEW."commissionAllocationId" IS NOT NULL OR NEW."storeEarningId" IS NOT NULL OR account_row."purpose" <> 'HELD' OR account_row."category" <> 'LIABILITY' THEN RAISE EXCEPTION 'customer-funds refund source is invalid'; END IF;
  ELSIF NEW."sourceType" = 'STORE_EARNINGS_PAYABLE' THEN
    SELECT * INTO STRICT earning_row FROM "StoreEarning" WHERE "id" = NEW."storeEarningId";
    IF NEW."commissionAccrualId" IS NOT NULL OR NEW."commissionAllocationId" IS NOT NULL OR earning_row."payableAccountId" <> NEW."ledgerAccountId" OR earning_row."status" <> 'ACCRUED' OR earning_row."releaseLedgerJournalId" IS NOT NULL OR earning_row."reversalLedgerJournalId" IS NOT NULL OR account_row."purpose" <> 'STORE_EARNINGS_PAYABLE' OR account_row."category" <> 'LIABILITY' THEN RAISE EXCEPTION 'store earning refund source is not safely reservable'; END IF;
  ELSE
    IF NEW."storeEarningId" IS NOT NULL THEN RAISE EXCEPTION 'commission refund source cannot reference a store earning'; END IF;
    SELECT * INTO STRICT allocation_row FROM "CommissionAllocation" WHERE "id" = NEW."commissionAllocationId";
    IF allocation_row."accrualId" <> NEW."commissionAccrualId" OR allocation_row."ledgerAccountId" <> NEW."ledgerAccountId" OR allocation_row."status" <> 'ACCRUED' OR allocation_row."downstreamReleaseJournalId" IS NOT NULL THEN RAISE EXCEPTION 'commission refund source is not safely reversible'; END IF;
    IF NEW."sourceType" = 'PLATFORM_COMMISSION_REVENUE' AND (account_row."purpose" <> 'PLATFORM_REVENUE' OR account_row."category" <> 'REVENUE' OR allocation_row."allocationType" <> 'PLATFORM_COMMISSION_REVENUE') THEN RAISE EXCEPTION 'platform commission refund source is invalid'; END IF;
    IF NEW."sourceType" = 'BENEFICIARY_COMMISSION_PAYABLE' AND (account_row."purpose" <> 'COMMISSION_PAYABLE' OR account_row."category" <> 'LIABILITY' OR allocation_row."allocationType" <> 'BENEFICIARY_COMMISSION_PAYABLE') THEN RAISE EXCEPTION 'beneficiary commission refund source is invalid'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "phase16_store_refund_projection_check"() RETURNS TRIGGER AS $$
DECLARE item RECORD;
BEGIN
  FOR item IN
    SELECT e."id", e."refundReservedAmount", e."refundedAmount",
      COALESCE(SUM(f."amount") FILTER (WHERE r."status" IN ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'RECONCILIATION_REQUIRED')), 0) AS reserved,
      COALESCE(SUM(f."amount") FILTER (WHERE r."status" = 'SUCCEEDED'), 0) AS refunded
    FROM "StoreEarning" e
    LEFT JOIN "RefundFundingAllocation" f ON f."storeEarningId" = e."id" AND f."sourceType" = 'STORE_EARNINGS_PAYABLE'
    LEFT JOIN "PaymentRefund" r ON r."id" = f."refundId"
    GROUP BY e."id", e."refundReservedAmount", e."refundedAmount"
  LOOP
    IF item."refundReservedAmount" <> item.reserved OR item."refundedAmount" <> item.refunded THEN RAISE EXCEPTION 'store earning refund projections do not match funding evidence'; END IF;
  END LOOP;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "StoreEarning_refund_projection" AFTER INSERT OR UPDATE ON "StoreEarning" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase16_store_refund_projection_check"();
CREATE CONSTRAINT TRIGGER "RefundFundingAllocation_store_projection" AFTER INSERT OR UPDATE OR DELETE ON "RefundFundingAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase16_store_refund_projection_check"();
CREATE CONSTRAINT TRIGGER "PaymentRefund_store_projection" AFTER INSERT OR UPDATE ON "PaymentRefund" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase16_store_refund_projection_check"();

COMMENT ON COLUMN "CommissionAllocation"."storeAttributedAmount" IS 'Phase 16 projection backed exactly by immutable StoreEarningCommissionCharge rows.';
COMMENT ON COLUMN "RefundFundingAllocation"."storeEarningId" IS 'Required only for authoritative STORE_EARNINGS_PAYABLE refund funding; generic payment-level inference is prohibited.';
COMMENT ON TABLE "StoreEarning" IS 'Dormant Phase 16 per-store entitlement evidence. Runtime financial mutations remain source-locked pending consolidated validation.';
