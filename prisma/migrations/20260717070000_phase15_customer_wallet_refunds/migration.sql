-- Phase 15: customer wallet liability and refund accounting foundation.
-- Implementation-only migration. It intentionally performs no data synthesis
-- and fails closed when a legacy PaymentRefund placeholder row exists.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "PaymentRefund" LIMIT 1) THEN
    RAISE EXCEPTION 'Phase 15 requires reviewed handling of legacy PaymentRefund placeholder rows';
  END IF;
END $$;

ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'CUSTOMER_WALLET_AVAILABLE';
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'CUSTOMER_REFUND_HELD';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'REFUND_RESERVE';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'REFUND_RELEASE';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'REFUND_WALLET_CREDIT';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'REFUND_EXTERNAL_PAYOUT';

DO $$ BEGIN
  CREATE TYPE "RefundMethod" AS ENUM ('CUSTOMER_WALLET', 'ORIGINAL_PAYMENT_METHOD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'SUCCEEDED', 'REJECTED', 'CANCELLED', 'RECONCILIATION_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RefundReasonCode" AS ENUM ('ORDER_CANCELLED', 'SERVICE_NOT_PROVIDED', 'DUPLICATE_PAYMENT', 'OVERPAYMENT', 'SERVICE_FAILURE', 'CUSTOMER_SERVICE_RESOLUTION', 'OTHER_REVIEWED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RefundFundingSourceType" AS ENUM ('CUSTOMER_FUNDS_HELD', 'PLATFORM_COMMISSION_REVENUE', 'BENEFICIARY_COMMISSION_PAYABLE', 'STORE_EARNINGS_PAYABLE', 'DRIVER_EARNINGS_PAYABLE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RefundAttemptStatus" AS ENUM ('RESERVED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RefundFailureCategory" AS ENUM ('INVALID_REQUEST', 'AUTHENTICATION', 'CONFIGURATION', 'DECLINED', 'RATE_LIMITED', 'TIMEOUT', 'NETWORK', 'PROVIDER_UNAVAILABLE', 'UNSUPPORTED_METHOD', 'MALFORMED_RESPONSE', 'UNKNOWN_OUTCOME', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RefundHistoryActorType" AS ENUM ('SYSTEM', 'CUSTOMER', 'FINANCE_ADMIN', 'PROVIDER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RefundReconciliationReason" AS ENUM ('UNKNOWN_PROVIDER_OUTCOME', 'PROVIDER_QUERY_UNAVAILABLE', 'PROVIDER_REFUND_ID_CONFLICT', 'PAYMENT_REFUND_TOTAL_MISMATCH', 'REFUND_LEDGER_LINK_MISSING', 'REFUND_LEDGER_AMOUNT_MISMATCH', 'COMMISSION_ADJUSTMENT_MISMATCH', 'DOWNSTREAM_COMMISSION_RELEASE', 'INSUFFICIENT_CASH_CLEARING', 'UNSUPPORTED_PROVIDER_REFUND_METHOD', 'APPLICATION_FAILURE_AFTER_PROVIDER_SUCCESS', 'STALE_PROCESSING_ATTEMPT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RefundReconciliationCaseStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "RefundReconciliationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Payment"
  ADD COLUMN "totalRefundedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN "totalRefundReservedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  ADD CONSTRAINT "Payment_refund_projection_check" CHECK (
    "totalRefundedAmount" >= 0
    AND "totalRefundReservedAmount" >= 0
    AND "totalRefundedAmount" + "totalRefundReservedAmount" <= "amount"
  );

-- Preserve every Phase 4 placeholder column under an explicit legacy name.
ALTER TABLE "PaymentRefund" RENAME COLUMN "currency" TO "legacyCurrency";
ALTER TABLE "PaymentRefund" RENAME COLUMN "reason" TO "legacyReason";
ALTER TABLE "PaymentRefund" RENAME COLUMN "providerReference" TO "legacyProviderReference";
ALTER TABLE "PaymentRefund" RENAME COLUMN "status" TO "legacyPaymentStatus";
ALTER TABLE "PaymentRefund" RENAME COLUMN "metadata" TO "legacyMetadata";
ALTER TABLE "PaymentRefund" RENAME COLUMN "createdByUserId" TO "legacyCreatedByUserId";
ALTER TABLE "PaymentRefund" ALTER COLUMN "amount" TYPE DECIMAL(18,2);

ALTER TABLE "PaymentRefund"
  ADD COLUMN "publicReference" TEXT NOT NULL,
  ADD COLUMN "customerUserId" TEXT NOT NULL,
  ADD COLUMN "method" "RefundMethod" NOT NULL,
  ADD COLUMN "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  ADD COLUMN "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  ADD COLUMN "reasonCode" "RefundReasonCode" NOT NULL,
  ADD COLUMN "customerNote" TEXT,
  ADD COLUMN "financeNote" TEXT,
  ADD COLUMN "creationIdempotencyKey" TEXT NOT NULL,
  ADD COLUMN "creationRequestHash" TEXT NOT NULL,
  ADD COLUMN "policyVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "reserveLedgerJournalId" TEXT NOT NULL,
  ADD COLUMN "releaseLedgerJournalId" TEXT,
  ADD COLUMN "completionLedgerJournalId" TEXT,
  ADD COLUMN "currentAttemptId" TEXT,
  ADD COLUMN "latestAttemptNumber" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "approvedByUserId" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedByUserId" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledByUserId" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "completedByUserId" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationRequiredAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "PaymentRefund_amount_currency_check" CHECK ("amount" > 0 AND "currency" = 'ZAR'),
  ADD CONSTRAINT "PaymentRefund_counter_check" CHECK ("latestAttemptNumber" >= 0 AND "policyVersion" > 0 AND "version" >= 0),
  ADD CONSTRAINT "PaymentRefund_state_evidence_check" CHECK (
    ("status" = 'SUCCEEDED' AND "completionLedgerJournalId" IS NOT NULL AND "releaseLedgerJournalId" IS NULL AND "completedAt" IS NOT NULL)
    OR ("status" IN ('REJECTED', 'CANCELLED') AND "releaseLedgerJournalId" IS NOT NULL AND "completionLedgerJournalId" IS NULL)
    OR ("status" NOT IN ('SUCCEEDED', 'REJECTED', 'CANCELLED') AND "releaseLedgerJournalId" IS NULL AND "completionLedgerJournalId" IS NULL)
  );

CREATE TABLE "RefundFundingAllocation" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "sourceType" "RefundFundingSourceType" NOT NULL,
  "ledgerAccountId" TEXT NOT NULL,
  "commissionAccrualId" TEXT,
  "commissionAllocationId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundFundingAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundFundingAllocation_amount_currency_check" CHECK ("amount" > 0 AND "currency" = 'ZAR'),
  CONSTRAINT "RefundFundingAllocation_source_shape_check" CHECK (
    ("sourceType" = 'CUSTOMER_FUNDS_HELD' AND "commissionAccrualId" IS NULL AND "commissionAllocationId" IS NULL)
    OR ("sourceType" IN ('PLATFORM_COMMISSION_REVENUE', 'BENEFICIARY_COMMISSION_PAYABLE') AND "commissionAccrualId" IS NOT NULL AND "commissionAllocationId" IS NOT NULL)
  )
);

CREATE TABLE "RefundExecutionAttempt" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "provider" "PaymentProvider",
  "method" "RefundMethod" NOT NULL,
  "status" "RefundAttemptStatus" NOT NULL DEFAULT 'RESERVED',
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "providerRefundId" TEXT,
  "providerPaymentId" TEXT,
  "credentialVersion" TEXT,
  "safeRequestSnapshot" JSONB,
  "safeResultSnapshot" JSONB,
  "failureCategory" "RefundFailureCategory",
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "initiatedByUserId" TEXT NOT NULL,
  "completedByUserId" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "unknownAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundExecutionAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundExecutionAttempt_counter_check" CHECK ("attemptNumber" > 0 AND "version" >= 0),
  CONSTRAINT "RefundExecutionAttempt_method_check" CHECK ("method" = 'ORIGINAL_PAYMENT_METHOD')
);

CREATE TABLE "RefundStatusHistory" (
  "id" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "attemptId" TEXT,
  "fromStatus" "RefundStatus",
  "toStatus" "RefundStatus" NOT NULL,
  "actorType" "RefundHistoryActorType" NOT NULL DEFAULT 'SYSTEM',
  "actorUserId" TEXT,
  "operationId" TEXT,
  "reasonCode" TEXT NOT NULL,
  "safeMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefundReconciliationCase" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "caseKey" TEXT NOT NULL,
  "refundId" TEXT NOT NULL,
  "attemptId" TEXT,
  "reason" "RefundReconciliationReason" NOT NULL,
  "status" "RefundReconciliationCaseStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "RefundReconciliationPriority" NOT NULL DEFAULT 'MEDIUM',
  "observationCount" INTEGER NOT NULL DEFAULT 1,
  "safeSummary" TEXT NOT NULL,
  "safeEvidence" JSONB,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionCode" TEXT,
  "resolvedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefundReconciliationCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RefundReconciliationCase_observation_check" CHECK ("observationCount" > 0)
);

CREATE UNIQUE INDEX "PaymentRefund_publicReference_key" ON "PaymentRefund"("publicReference");
CREATE UNIQUE INDEX "PaymentRefund_creationIdempotencyKey_key" ON "PaymentRefund"("creationIdempotencyKey");
CREATE UNIQUE INDEX "PaymentRefund_reserveLedgerJournalId_key" ON "PaymentRefund"("reserveLedgerJournalId");
CREATE UNIQUE INDEX "PaymentRefund_releaseLedgerJournalId_key" ON "PaymentRefund"("releaseLedgerJournalId");
CREATE UNIQUE INDEX "PaymentRefund_completionLedgerJournalId_key" ON "PaymentRefund"("completionLedgerJournalId");
CREATE UNIQUE INDEX "PaymentRefund_currentAttemptId_key" ON "PaymentRefund"("currentAttemptId");
CREATE INDEX "PaymentRefund_paymentId_createdAt_idx" ON "PaymentRefund"("paymentId", "createdAt");
CREATE INDEX "PaymentRefund_customerUserId_createdAt_idx" ON "PaymentRefund"("customerUserId", "createdAt");
CREATE INDEX "PaymentRefund_refundStatus_createdAt_idx" ON "PaymentRefund"("status", "createdAt");
CREATE INDEX "PaymentRefund_method_refundStatus_idx" ON "PaymentRefund"("method", "status");
CREATE INDEX "PaymentRefund_reconciliationRequiredAt_idx" ON "PaymentRefund"("reconciliationRequiredAt");

CREATE UNIQUE INDEX "RefundFundingAllocation_publicReference_key" ON "RefundFundingAllocation"("publicReference");
CREATE UNIQUE INDEX "RefundFundingAllocation_refund_commissionAllocation_key" ON "RefundFundingAllocation"("refundId", "commissionAllocationId");
CREATE INDEX "RefundFundingAllocation_refund_source_idx" ON "RefundFundingAllocation"("refundId", "sourceType");
CREATE INDEX "RefundFundingAllocation_account_idx" ON "RefundFundingAllocation"("ledgerAccountId");
CREATE INDEX "RefundFundingAllocation_accrual_idx" ON "RefundFundingAllocation"("commissionAccrualId");
CREATE INDEX "RefundFundingAllocation_commissionAllocation_idx" ON "RefundFundingAllocation"("commissionAllocationId");

CREATE UNIQUE INDEX "RefundExecutionAttempt_publicReference_key" ON "RefundExecutionAttempt"("publicReference");
CREATE UNIQUE INDEX "RefundExecutionAttempt_idempotencyKey_key" ON "RefundExecutionAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "RefundExecutionAttempt_refund_attemptNumber_key" ON "RefundExecutionAttempt"("refundId", "attemptNumber");
CREATE UNIQUE INDEX "RefundExecutionAttempt_provider_providerRefundId_key" ON "RefundExecutionAttempt"("provider", "providerRefundId");
CREATE INDEX "RefundExecutionAttempt_refund_status_idx" ON "RefundExecutionAttempt"("refundId", "status");
CREATE INDEX "RefundExecutionAttempt_provider_status_idx" ON "RefundExecutionAttempt"("provider", "status");
CREATE INDEX "RefundExecutionAttempt_createdAt_idx" ON "RefundExecutionAttempt"("createdAt");

CREATE UNIQUE INDEX "RefundStatusHistory_refund_operation_key" ON "RefundStatusHistory"("refundId", "operationId");
CREATE INDEX "RefundStatusHistory_refund_createdAt_idx" ON "RefundStatusHistory"("refundId", "createdAt");
CREATE INDEX "RefundStatusHistory_attempt_idx" ON "RefundStatusHistory"("attemptId");
CREATE INDEX "RefundStatusHistory_status_createdAt_idx" ON "RefundStatusHistory"("toStatus", "createdAt");

CREATE UNIQUE INDEX "RefundReconciliationCase_publicReference_key" ON "RefundReconciliationCase"("publicReference");
CREATE UNIQUE INDEX "RefundReconciliationCase_caseKey_key" ON "RefundReconciliationCase"("caseKey");
CREATE INDEX "RefundReconciliationCase_status_priority_lastObservedAt_idx" ON "RefundReconciliationCase"("status", "priority", "lastObservedAt");
CREATE INDEX "RefundReconciliationCase_refund_status_idx" ON "RefundReconciliationCase"("refundId", "status");
CREATE INDEX "RefundReconciliationCase_attempt_status_idx" ON "RefundReconciliationCase"("attemptId", "status");
CREATE INDEX "RefundReconciliationCase_reason_status_idx" ON "RefundReconciliationCase"("reason", "status");

ALTER TABLE "PaymentRefund" DROP CONSTRAINT "PaymentRefund_paymentId_fkey";
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_reserveJournal_fkey" FOREIGN KEY ("reserveLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_releaseJournal_fkey" FOREIGN KEY ("releaseLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_completionJournal_fkey" FOREIGN KEY ("completionLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RefundFundingAllocation" ADD CONSTRAINT "RefundFundingAllocation_refund_fkey" FOREIGN KEY ("refundId") REFERENCES "PaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundFundingAllocation" ADD CONSTRAINT "RefundFundingAllocation_account_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundFundingAllocation" ADD CONSTRAINT "RefundFundingAllocation_accrual_fkey" FOREIGN KEY ("commissionAccrualId") REFERENCES "CommissionAccrual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundFundingAllocation" ADD CONSTRAINT "RefundFundingAllocation_allocation_fkey" FOREIGN KEY ("commissionAllocationId") REFERENCES "CommissionAllocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RefundExecutionAttempt" ADD CONSTRAINT "RefundExecutionAttempt_refund_fkey" FOREIGN KEY ("refundId") REFERENCES "PaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundExecutionAttempt" ADD CONSTRAINT "RefundExecutionAttempt_initiatedBy_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundExecutionAttempt" ADD CONSTRAINT "RefundExecutionAttempt_completedBy_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_currentAttempt_fkey" FOREIGN KEY ("currentAttemptId") REFERENCES "RefundExecutionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RefundStatusHistory" ADD CONSTRAINT "RefundStatusHistory_refund_fkey" FOREIGN KEY ("refundId") REFERENCES "PaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundStatusHistory" ADD CONSTRAINT "RefundStatusHistory_attempt_fkey" FOREIGN KEY ("attemptId") REFERENCES "RefundExecutionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundStatusHistory" ADD CONSTRAINT "RefundStatusHistory_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RefundReconciliationCase" ADD CONSTRAINT "RefundReconciliationCase_refund_fkey" FOREIGN KEY ("refundId") REFERENCES "PaymentRefund"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundReconciliationCase" ADD CONSTRAINT "RefundReconciliationCase_attempt_fkey" FOREIGN KEY ("attemptId") REFERENCES "RefundExecutionAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RefundReconciliationCase" ADD CONSTRAINT "RefundReconciliationCase_resolvedBy_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "phase15_refund_identity_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'refund evidence cannot be deleted'; END IF;
  IF (NEW."paymentId", NEW."customerUserId", NEW."method", NEW."amount", NEW."currency", NEW."reasonCode", NEW."customerNote", NEW."creationIdempotencyKey", NEW."creationRequestHash", NEW."policyVersion", NEW."reserveLedgerJournalId")
    IS DISTINCT FROM
    (OLD."paymentId", OLD."customerUserId", OLD."method", OLD."amount", OLD."currency", OLD."reasonCode", OLD."customerNote", OLD."creationIdempotencyKey", OLD."creationRequestHash", OLD."policyVersion", OLD."reserveLedgerJournalId")
  THEN RAISE EXCEPTION 'refund financial identity is immutable'; END IF;
  IF OLD."releaseLedgerJournalId" IS NOT NULL AND NEW."releaseLedgerJournalId" IS DISTINCT FROM OLD."releaseLedgerJournalId" THEN RAISE EXCEPTION 'refund release journal is immutable'; END IF;
  IF OLD."completionLedgerJournalId" IS NOT NULL AND NEW."completionLedgerJournalId" IS DISTINCT FROM OLD."completionLedgerJournalId" THEN RAISE EXCEPTION 'refund completion journal is immutable'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PaymentRefund_identity_immutable" BEFORE UPDATE OR DELETE ON "PaymentRefund" FOR EACH ROW EXECUTE FUNCTION "phase15_refund_identity_guard"();

CREATE OR REPLACE FUNCTION "phase15_refund_attempt_guard"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'refund attempt evidence cannot be deleted'; END IF;
  IF (NEW."refundId", NEW."attemptNumber", NEW."provider", NEW."method", NEW."idempotencyKey", NEW."requestHash", NEW."providerPaymentId", NEW."credentialVersion", NEW."initiatedByUserId")
    IS DISTINCT FROM
    (OLD."refundId", OLD."attemptNumber", OLD."provider", OLD."method", OLD."idempotencyKey", OLD."requestHash", OLD."providerPaymentId", OLD."credentialVersion", OLD."initiatedByUserId")
  THEN RAISE EXCEPTION 'refund attempt identity is immutable'; END IF;
  IF OLD."providerRefundId" IS NOT NULL AND NEW."providerRefundId" IS DISTINCT FROM OLD."providerRefundId" THEN RAISE EXCEPTION 'provider refund ID is immutable'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "RefundExecutionAttempt_identity_immutable" BEFORE UPDATE OR DELETE ON "RefundExecutionAttempt" FOR EACH ROW EXECUTE FUNCTION "phase15_refund_attempt_guard"();

CREATE OR REPLACE FUNCTION "phase15_refund_funding_guard"() RETURNS TRIGGER AS $$
DECLARE account_row "LedgerAccount"%ROWTYPE;
DECLARE allocation_row "CommissionAllocation"%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'refund funding evidence cannot be deleted'; END IF;
  IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'refund funding evidence is immutable'; END IF;
  SELECT * INTO STRICT account_row FROM "LedgerAccount" WHERE "id" = NEW."ledgerAccountId";
  IF NEW."sourceType" = 'CUSTOMER_FUNDS_HELD' THEN
    IF account_row."purpose" <> 'HELD' OR account_row."category" <> 'LIABILITY' THEN RAISE EXCEPTION 'customer-funds refund source is invalid'; END IF;
  ELSE
    SELECT * INTO STRICT allocation_row FROM "CommissionAllocation" WHERE "id" = NEW."commissionAllocationId";
    IF allocation_row."accrualId" <> NEW."commissionAccrualId" OR allocation_row."ledgerAccountId" <> NEW."ledgerAccountId" OR allocation_row."status" <> 'ACCRUED' OR allocation_row."downstreamReleaseJournalId" IS NOT NULL THEN
      RAISE EXCEPTION 'commission refund source is not safely reversible';
    END IF;
    IF NEW."sourceType" = 'PLATFORM_COMMISSION_REVENUE' AND (account_row."purpose" <> 'PLATFORM_REVENUE' OR account_row."category" <> 'REVENUE' OR allocation_row."allocationType" <> 'PLATFORM_COMMISSION_REVENUE') THEN RAISE EXCEPTION 'platform commission refund source is invalid'; END IF;
    IF NEW."sourceType" = 'BENEFICIARY_COMMISSION_PAYABLE' AND (account_row."purpose" <> 'COMMISSION_PAYABLE' OR account_row."category" <> 'LIABILITY' OR allocation_row."allocationType" <> 'BENEFICIARY_COMMISSION_PAYABLE') THEN RAISE EXCEPTION 'beneficiary commission refund source is invalid'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "RefundFundingAllocation_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "RefundFundingAllocation" FOR EACH ROW EXECUTE FUNCTION "phase15_refund_funding_guard"();

CREATE OR REPLACE FUNCTION "phase15_refund_history_guard"() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'refund status history is immutable'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "RefundStatusHistory_immutable" BEFORE UPDATE OR DELETE ON "RefundStatusHistory" FOR EACH ROW EXECUTE FUNCTION "phase15_refund_history_guard"();

CREATE OR REPLACE FUNCTION "phase15_refund_reconciliation_delete_guard"() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'refund reconciliation evidence cannot be deleted'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "RefundReconciliationCase_no_delete" BEFORE DELETE ON "RefundReconciliationCase" FOR EACH ROW EXECUTE FUNCTION "phase15_refund_reconciliation_delete_guard"();

CREATE OR REPLACE FUNCTION "phase15_refund_journal_evidence_check"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."reserveLedgerJournalId" AND j."type" = 'REFUND_RESERVE' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."amount" AND a."purpose" = 'CUSTOMER_REFUND_HELD' AND a."category" = 'LIABILITY' AND a."currency" = 'ZAR' AND NOT a."allowNegative" AND w."ownerType" = 'CUSTOMER' AND w."ownerId" = NEW."customerUserId")
  ) THEN RAISE EXCEPTION 'refund reserve journal evidence is invalid'; END IF;

  IF NEW."releaseLedgerJournalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."releaseLedgerJournalId" AND j."type" = 'REFUND_RELEASE' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."amount" AND a."purpose" = 'CUSTOMER_REFUND_HELD' AND a."category" = 'LIABILITY' AND a."currency" = 'ZAR' AND NOT a."allowNegative" AND w."ownerType" = 'CUSTOMER' AND w."ownerId" = NEW."customerUserId")
  ) THEN RAISE EXCEPTION 'refund release journal evidence is invalid'; END IF;

  IF NEW."completionLedgerJournalId" IS NOT NULL AND NEW."method" = 'CUSTOMER_WALLET' AND NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."completionLedgerJournalId" AND j."type" = 'REFUND_WALLET_CREDIT' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."amount" AND a."purpose" = 'CUSTOMER_REFUND_HELD' AND w."ownerType" = 'CUSTOMER' AND w."ownerId" = NEW."customerUserId")
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."amount" AND a."purpose" = 'CUSTOMER_WALLET_AVAILABLE' AND a."category" = 'LIABILITY' AND a."currency" = 'ZAR' AND NOT a."allowNegative" AND w."ownerType" = 'CUSTOMER' AND w."ownerId" = NEW."customerUserId")
  ) THEN RAISE EXCEPTION 'wallet refund completion journal evidence is invalid'; END IF;

  IF NEW."completionLedgerJournalId" IS NOT NULL AND NEW."method" = 'ORIGINAL_PAYMENT_METHOD' AND NOT EXISTS (
    SELECT 1 FROM "LedgerJournal" j
    WHERE j."id" = NEW."completionLedgerJournalId" AND j."type" = 'REFUND_EXTERNAL_PAYOUT' AND j."currency" = 'ZAR'
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT') = NEW."amount"
      AND (SELECT COALESCE(SUM(e."amount"), 0) FROM "LedgerEntry" e WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT') = NEW."amount"
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE e."journalId" = j."id" AND e."direction" = 'DEBIT' AND e."amount" = NEW."amount" AND a."purpose" = 'CUSTOMER_REFUND_HELD' AND w."ownerType" = 'CUSTOMER' AND w."ownerId" = NEW."customerUserId")
      AND EXISTS (SELECT 1 FROM "LedgerEntry" e JOIN "LedgerAccount" a ON a."id" = e."accountId" JOIN "Wallet" w ON w."id" = a."walletId" WHERE e."journalId" = j."id" AND e."direction" = 'CREDIT' AND e."amount" = NEW."amount" AND a."purpose" = 'CASH_CLEARING' AND a."category" = 'ASSET' AND a."currency" = 'ZAR' AND NOT a."allowNegative" AND w."ownerType" = 'PLATFORM')
  ) THEN RAISE EXCEPTION 'external refund completion journal evidence is invalid'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PaymentRefund_journal_evidence" BEFORE INSERT OR UPDATE ON "PaymentRefund" FOR EACH ROW EXECUTE FUNCTION "phase15_refund_journal_evidence_check"();

CREATE OR REPLACE FUNCTION "phase15_refund_funding_sum_check"() RETURNS TRIGGER AS $$
DECLARE target_refund_id TEXT;
DECLARE refund_amount DECIMAL(18,2);
DECLARE funding_amount DECIMAL(18,2);
BEGIN
  IF TG_TABLE_NAME = 'PaymentRefund' THEN
    target_refund_id := NEW."id";
  ELSIF TG_OP = 'DELETE' THEN
    target_refund_id := OLD."refundId";
  ELSE
    target_refund_id := NEW."refundId";
  END IF;
  SELECT "amount" INTO refund_amount FROM "PaymentRefund" WHERE "id" = target_refund_id;
  IF refund_amount IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM("amount"), 0) INTO funding_amount FROM "RefundFundingAllocation" WHERE "refundId" = target_refund_id;
  IF funding_amount <> refund_amount THEN RAISE EXCEPTION 'refund funding allocations must equal refund amount'; END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "PaymentRefund_funding_sum" AFTER INSERT OR UPDATE ON "PaymentRefund" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase15_refund_funding_sum_check"();
CREATE CONSTRAINT TRIGGER "RefundFundingAllocation_sum" AFTER INSERT OR UPDATE OR DELETE ON "RefundFundingAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase15_refund_funding_sum_check"();

CREATE OR REPLACE FUNCTION "phase15_payment_refund_projection_check"() RETURNS TRIGGER AS $$
DECLARE target_payment_id TEXT;
DECLARE payment_row "Payment"%ROWTYPE;
DECLARE succeeded_total DECIMAL(18,2);
DECLARE reserved_total DECIMAL(18,2);
BEGIN
  IF TG_TABLE_NAME = 'Payment' THEN
    target_payment_id := COALESCE(NEW."id", OLD."id");
  ELSE
    target_payment_id := COALESCE(NEW."paymentId", OLD."paymentId");
  END IF;
  SELECT * INTO payment_row FROM "Payment" WHERE "id" = target_payment_id;
  IF payment_row."id" IS NULL THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM("amount"), 0) INTO succeeded_total FROM "PaymentRefund" WHERE "paymentId" = target_payment_id AND "status" = 'SUCCEEDED';
  SELECT COALESCE(SUM("amount"), 0) INTO reserved_total FROM "PaymentRefund" WHERE "paymentId" = target_payment_id AND "status" IN ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'RECONCILIATION_REQUIRED');
  IF succeeded_total <> payment_row."totalRefundedAmount" OR reserved_total <> payment_row."totalRefundReservedAmount" OR succeeded_total + reserved_total > payment_row."amount" THEN
    RAISE EXCEPTION 'payment refund projections do not match refund evidence';
  END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "Payment_refund_projection_evidence" AFTER INSERT OR UPDATE ON "Payment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase15_payment_refund_projection_check"();
CREATE CONSTRAINT TRIGGER "PaymentRefund_projection_evidence" AFTER INSERT OR UPDATE ON "PaymentRefund" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase15_payment_refund_projection_check"();

CREATE OR REPLACE FUNCTION "phase15_commission_refund_adjustment_check"() RETURNS TRIGGER AS $$
DECLARE item RECORD;
BEGIN
  FOR item IN
    SELECT f."commissionAllocationId", SUM(f."amount") AS adjusted, a."amount" AS original
    FROM "RefundFundingAllocation" f
    JOIN "PaymentRefund" r ON r."id" = f."refundId"
    JOIN "CommissionAllocation" a ON a."id" = f."commissionAllocationId"
    WHERE f."commissionAllocationId" IS NOT NULL AND r."status" NOT IN ('REJECTED', 'CANCELLED')
    GROUP BY f."commissionAllocationId", a."amount"
  LOOP
    IF item.adjusted > item.original THEN RAISE EXCEPTION 'refund commission adjustment exceeds original allocation'; END IF;
  END LOOP;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "RefundFundingAllocation_commission_limit" AFTER INSERT OR UPDATE OR DELETE ON "RefundFundingAllocation" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase15_commission_refund_adjustment_check"();
CREATE CONSTRAINT TRIGGER "PaymentRefund_commission_limit" AFTER UPDATE ON "PaymentRefund" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "phase15_commission_refund_adjustment_check"();

CREATE OR REPLACE FUNCTION "phase15_refund_external_success_check"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" = 'SUCCEEDED' AND NEW."method" = 'ORIGINAL_PAYMENT_METHOD' AND NOT EXISTS (
    SELECT 1 FROM "RefundExecutionAttempt" a WHERE a."id" = NEW."currentAttemptId" AND a."refundId" = NEW."id" AND a."status" = 'SUCCEEDED' AND a."providerRefundId" IS NOT NULL
  ) THEN RAISE EXCEPTION 'external refund success requires successful provider attempt evidence'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "PaymentRefund_external_success_evidence" BEFORE INSERT OR UPDATE ON "PaymentRefund" FOR EACH ROW EXECUTE FUNCTION "phase15_refund_external_success_check"();

COMMENT ON COLUMN "Payment"."totalRefundedAmount" IS 'Phase 15 projection backed by SUCCEEDED PaymentRefund evidence.';
COMMENT ON COLUMN "Payment"."totalRefundReservedAmount" IS 'Phase 15 projection backed by nonterminal reserved PaymentRefund evidence.';
COMMENT ON COLUMN "PaymentRefund"."legacyPaymentStatus" IS 'Retained Phase 4 placeholder status; never operational Phase 15 evidence.';
