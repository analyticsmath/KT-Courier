-- Phase 13 is additive and intentionally unexecuted by the implementation workflow.
-- The Phase 4 WithdrawalRequest placeholder has no deterministic financial meaning.
-- Refuse to promote any legacy row rather than fabricating a reserve, destination, or payout.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "WithdrawalRequest" LIMIT 1) THEN
    RAISE EXCEPTION 'Phase 13 preflight failed: WithdrawalRequest contains legacy placeholder rows.';
  END IF;
END $$;

ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'OWNER_WITHDRAWABLE';
ALTER TYPE "LedgerAccountPurpose" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_HELD';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_RESERVE';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_RELEASE';
ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'WITHDRAWAL_PAYOUT';

-- A replacement enum avoids retaining legacy PENDING/FAILED values and avoids
-- using a newly-added enum value as a default within the migration transaction.
CREATE TYPE "WithdrawalStatus_phase13" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'CANCELLED', 'RECONCILIATION_REQUIRED');
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "WithdrawalRequest"
  ALTER COLUMN "status" TYPE "WithdrawalStatus_phase13"
  USING (
    CASE "status"::text
      WHEN 'PENDING' THEN 'REQUESTED'
      WHEN 'FAILED' THEN 'RECONCILIATION_REQUIRED'
      ELSE "status"::text
    END
  )::"WithdrawalStatus_phase13";
ALTER TYPE "WithdrawalStatus" RENAME TO "WithdrawalStatus_legacy_phase4";
ALTER TYPE "WithdrawalStatus_phase13" RENAME TO "WithdrawalStatus";
-- The unused legacy enum type is retained as a physical compatibility artifact.

CREATE TYPE "PayoutMethod" AS ENUM ('MANUAL_EXTERNAL');
CREATE TYPE "PayoutDestinationStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'REVOKED');
CREATE TYPE "PayoutAttemptStatus" AS ENUM ('RESERVED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'UNKNOWN');
CREATE TYPE "PayoutFailureCategory" AS ENUM ('OPERATOR_CONFIRMED', 'EXTERNAL_SYSTEM_REJECTED', 'LIQUIDITY_UNAVAILABLE', 'DESTINATION_UNAVAILABLE', 'EVIDENCE_REJECTED', 'OTHER_SAFE_FAILURE');
CREATE TYPE "WithdrawalHistoryActorType" AS ENUM ('OWNER', 'FINANCE_ADMIN', 'SYSTEM');
CREATE TYPE "WithdrawalReconciliationReason" AS ENUM ('UNKNOWN_PAYOUT_OUTCOME', 'CONFLICTING_EXTERNAL_REFERENCE', 'PAYOUT_EVIDENCE_INCOMPLETE', 'PAID_WITHOUT_LEDGER_LINK', 'LEDGER_LINK_WITHOUT_PAID_STATE', 'HELD_BALANCE_MISMATCH', 'STALE_PROCESSING_ATTEMPT', 'DESTINATION_CHANGED', 'CREDENTIAL_OR_SYSTEM_VERSION_MISMATCH', 'APPLICATION_FAILURE_AFTER_EXTERNAL_PAYOUT', 'DUPLICATE_PAYOUT_REFERENCE', 'INSUFFICIENT_CASH_CLEARING');
CREATE TYPE "WithdrawalReconciliationCaseStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED');
CREATE TYPE "WithdrawalReconciliationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TABLE "PayoutDestination" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "walletId" TEXT NOT NULL,
  "ownerType" "WalletOwnerType" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "method" "PayoutMethod" NOT NULL DEFAULT 'MANUAL_EXTERNAL',
  "providerCode" TEXT NOT NULL,
  "externalReference" TEXT NOT NULL,
  "maskedLabel" TEXT NOT NULL,
  "institutionName" TEXT,
  "accountLast4" TEXT,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "countryCode" TEXT NOT NULL DEFAULT 'ZA',
  "status" "PayoutDestinationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "verifiedAt" TIMESTAMP(3),
  "verifiedByUserId" TEXT,
  "disabledAt" TIMESTAMP(3),
  "disabledByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayoutDestination_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WithdrawalPolicy" (
  "id" TEXT NOT NULL,
  "ownerType" "WalletOwnerType" NOT NULL,
  "currency" "LedgerCurrency" NOT NULL DEFAULT 'ZAR',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "minimumAmount" DECIMAL(18,2),
  "maximumAmount" DECIMAL(18,2),
  "dailyMaximumAmount" DECIMAL(18,2),
  "requiresReview" BOOLEAN NOT NULL DEFAULT true,
  "requiresDualControl" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WithdrawalPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WithdrawalPayoutAttempt" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "withdrawalId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "method" "PayoutMethod" NOT NULL DEFAULT 'MANUAL_EXTERNAL',
  "status" "PayoutAttemptStatus" NOT NULL DEFAULT 'RESERVED',
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "completionIdempotencyKey" TEXT,
  "completionRequestHash" TEXT,
  "externalReference" TEXT,
  "safeEvidenceReference" TEXT,
  "failureCategory" "PayoutFailureCategory",
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
  CONSTRAINT "WithdrawalPayoutAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WithdrawalStatusHistory" (
  "id" TEXT NOT NULL,
  "withdrawalId" TEXT NOT NULL,
  "payoutAttemptId" TEXT,
  "fromStatus" "WithdrawalStatus",
  "toStatus" "WithdrawalStatus" NOT NULL,
  "actorType" "WithdrawalHistoryActorType" NOT NULL,
  "actorUserId" TEXT,
  "reasonCode" TEXT,
  "safeMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WithdrawalStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WithdrawalReconciliationCase" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "caseKey" TEXT NOT NULL,
  "withdrawalId" TEXT NOT NULL,
  "payoutAttemptId" TEXT,
  "reason" "WithdrawalReconciliationReason" NOT NULL,
  "status" "WithdrawalReconciliationCaseStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "WithdrawalReconciliationPriority" NOT NULL DEFAULT 'MEDIUM',
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
  CONSTRAINT "WithdrawalReconciliationCase_pkey" PRIMARY KEY ("id")
);

-- Existing Phase 4 placeholder columns are retained exactly as physical compatibility
-- fields: reviewedByUserId, bankName, accountHolder, accountLast4, rejectionReason,
-- metadata, reviewedAt, and paidAt. They are intentionally not copied into a payout
-- destination or otherwise promoted into the structured withdrawal aggregate.
-- New Phase 13 columns make the aggregate explicit.
ALTER TABLE "WithdrawalRequest"
  ADD COLUMN "ownerType" "WalletOwnerType" NOT NULL,
  ADD COLUMN "ownerId" TEXT NOT NULL,
  ADD COLUMN "sourceAccountId" TEXT NOT NULL,
  ADD COLUMN "heldAccountId" TEXT NOT NULL,
  ADD COLUMN "payoutDestinationId" TEXT NOT NULL,
  ADD COLUMN "creationIdempotencyKey" TEXT NOT NULL,
  ADD COLUMN "creationRequestHash" TEXT NOT NULL,
  ADD COLUMN "policyVersion" INTEGER NOT NULL,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "latestAttemptNumber" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "reserveLedgerJournalId" TEXT NOT NULL,
  ADD COLUMN "releaseLedgerJournalId" TEXT,
  ADD COLUMN "payoutLedgerJournalId" TEXT,
  ADD COLUMN "currentPayoutAttemptId" TEXT,
  ADD COLUMN "approvedByUserId" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedByUserId" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReasonCode" TEXT,
  ADD COLUMN "cancellationReasonCode" TEXT,
  ADD COLUMN "cancelledByUserId" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "completedByUserId" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationRequiredAt" TIMESTAMP(3);

ALTER TABLE "WithdrawalRequest" ALTER COLUMN "requestedByUserId" SET NOT NULL;
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "amount" TYPE DECIMAL(18,2);
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "currency" DROP DEFAULT;
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "currency" TYPE "LedgerCurrency" USING "currency"::"LedgerCurrency";
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "currency" SET DEFAULT 'ZAR';
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';

CREATE UNIQUE INDEX "PayoutDestination_publicReference_key" ON "PayoutDestination"("publicReference");
CREATE UNIQUE INDEX "PayoutDestination_providerCode_externalReference_key" ON "PayoutDestination"("providerCode", "externalReference");
CREATE INDEX "PayoutDestination_walletId_status_idx" ON "PayoutDestination"("walletId", "status");
CREATE INDEX "PayoutDestination_ownerType_ownerId_status_idx" ON "PayoutDestination"("ownerType", "ownerId", "status");
CREATE INDEX "PayoutDestination_status_createdAt_idx" ON "PayoutDestination"("status", "createdAt");
CREATE UNIQUE INDEX "WithdrawalPolicy_ownerType_currency_key" ON "WithdrawalPolicy"("ownerType", "currency");
CREATE INDEX "WithdrawalPolicy_enabled_ownerType_idx" ON "WithdrawalPolicy"("enabled", "ownerType");
CREATE UNIQUE INDEX "WithdrawalPayoutAttempt_publicReference_key" ON "WithdrawalPayoutAttempt"("publicReference");
CREATE UNIQUE INDEX "WithdrawalPayoutAttempt_idempotencyKey_key" ON "WithdrawalPayoutAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "WithdrawalPayoutAttempt_completionIdempotencyKey_key" ON "WithdrawalPayoutAttempt"("completionIdempotencyKey");
CREATE UNIQUE INDEX "WithdrawalPayoutAttempt_externalReference_key" ON "WithdrawalPayoutAttempt"("externalReference");
CREATE UNIQUE INDEX "WithdrawalPayoutAttempt_withdrawalId_attemptNumber_key" ON "WithdrawalPayoutAttempt"("withdrawalId", "attemptNumber");
CREATE INDEX "WithdrawalPayoutAttempt_withdrawalId_status_idx" ON "WithdrawalPayoutAttempt"("withdrawalId", "status");
CREATE INDEX "WithdrawalPayoutAttempt_status_updatedAt_idx" ON "WithdrawalPayoutAttempt"("status", "updatedAt");
CREATE INDEX "WithdrawalStatusHistory_withdrawalId_createdAt_idx" ON "WithdrawalStatusHistory"("withdrawalId", "createdAt");
CREATE INDEX "WithdrawalStatusHistory_payoutAttemptId_createdAt_idx" ON "WithdrawalStatusHistory"("payoutAttemptId", "createdAt");
CREATE UNIQUE INDEX "WithdrawalReconciliationCase_publicReference_key" ON "WithdrawalReconciliationCase"("publicReference");
CREATE UNIQUE INDEX "WithdrawalReconciliationCase_caseKey_key" ON "WithdrawalReconciliationCase"("caseKey");
CREATE INDEX "WithdrawalReconciliationCase_status_priority_lastObservedAt_idx" ON "WithdrawalReconciliationCase"("status", "priority", "lastObservedAt");
CREATE INDEX "WithdrawalReconciliationCase_withdrawalId_status_idx" ON "WithdrawalReconciliationCase"("withdrawalId", "status");
CREATE INDEX "WithdrawalReconciliationCase_payoutAttemptId_status_idx" ON "WithdrawalReconciliationCase"("payoutAttemptId", "status");
CREATE INDEX "WithdrawalReconciliationCase_reason_status_idx" ON "WithdrawalReconciliationCase"("reason", "status");
CREATE UNIQUE INDEX "WithdrawalRequest_creationIdempotencyKey_key" ON "WithdrawalRequest"("creationIdempotencyKey");
CREATE UNIQUE INDEX "WithdrawalRequest_reserveLedgerJournalId_key" ON "WithdrawalRequest"("reserveLedgerJournalId");
CREATE UNIQUE INDEX "WithdrawalRequest_releaseLedgerJournalId_key" ON "WithdrawalRequest"("releaseLedgerJournalId");
CREATE UNIQUE INDEX "WithdrawalRequest_payoutLedgerJournalId_key" ON "WithdrawalRequest"("payoutLedgerJournalId");
CREATE UNIQUE INDEX "WithdrawalRequest_currentPayoutAttemptId_key" ON "WithdrawalRequest"("currentPayoutAttemptId");
CREATE INDEX "WithdrawalRequest_ownerType_ownerId_idx" ON "WithdrawalRequest"("ownerType", "ownerId");
CREATE INDEX "WithdrawalRequest_status_requestedAt_idx" ON "WithdrawalRequest"("status", "requestedAt");
CREATE INDEX "WithdrawalRequest_payoutDestinationId_idx" ON "WithdrawalRequest"("payoutDestinationId");
CREATE INDEX "WithdrawalRequest_approvedByUserId_idx" ON "WithdrawalRequest"("approvedByUserId");
CREATE INDEX "WithdrawalRequest_reconciliationRequiredAt_idx" ON "WithdrawalRequest"("reconciliationRequiredAt");

ALTER TABLE "WithdrawalRequest" DROP CONSTRAINT "WithdrawalRequest_requestedByUserId_fkey";
ALTER TABLE "WithdrawalRequest"
  ADD CONSTRAINT "WithdrawalRequest_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalRequest_heldAccountId_fkey" FOREIGN KEY ("heldAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalRequest_payoutDestinationId_fkey" FOREIGN KEY ("payoutDestinationId") REFERENCES "PayoutDestination"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalRequest_reserveLedgerJournalId_fkey" FOREIGN KEY ("reserveLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalRequest_releaseLedgerJournalId_fkey" FOREIGN KEY ("releaseLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalRequest_payoutLedgerJournalId_fkey" FOREIGN KEY ("payoutLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalRequest_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalRequest_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalRequest_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalRequest_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WithdrawalPayoutAttempt"
  ADD CONSTRAINT "WithdrawalPayoutAttempt_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalPayoutAttempt_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalPayoutAttempt_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_currentPayoutAttemptId_fkey" FOREIGN KEY ("currentPayoutAttemptId") REFERENCES "WithdrawalPayoutAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PayoutDestination"
  ADD CONSTRAINT "PayoutDestination_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PayoutDestination_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "PayoutDestination_disabledByUserId_fkey" FOREIGN KEY ("disabledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WithdrawalStatusHistory"
  ADD CONSTRAINT "WithdrawalStatusHistory_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalStatusHistory_payoutAttemptId_fkey" FOREIGN KEY ("payoutAttemptId") REFERENCES "WithdrawalPayoutAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WithdrawalReconciliationCase"
  ADD CONSTRAINT "WithdrawalReconciliationCase_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "WithdrawalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalReconciliationCase_payoutAttemptId_fkey" FOREIGN KEY ("payoutAttemptId") REFERENCES "WithdrawalPayoutAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "WithdrawalReconciliationCase_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WithdrawalRequest"
  ADD CONSTRAINT "WithdrawalRequest_amount_positive" CHECK ("amount" > 0),
  ADD CONSTRAINT "WithdrawalRequest_currency_zar" CHECK ("currency" = 'ZAR'),
  ADD CONSTRAINT "WithdrawalRequest_owner_type_supported" CHECK ("ownerType" IN ('STORE', 'DRIVER', 'PROMOTER')),
  ADD CONSTRAINT "WithdrawalRequest_source_held_differ" CHECK ("sourceAccountId" <> "heldAccountId"),
  ADD CONSTRAINT "WithdrawalRequest_phase13_legacy_compatibility_null" CHECK (
    "reviewedByUserId" IS NULL
    AND "bankName" IS NULL
    AND "accountHolder" IS NULL
    AND "accountLast4" IS NULL
    AND "rejectionReason" IS NULL
    AND "metadata" IS NULL
    AND "reviewedAt" IS NULL
    AND "paidAt" IS NULL
  ),
  ADD CONSTRAINT "WithdrawalRequest_terminal_journal_coherence" CHECK (
    ("status" NOT IN ('CANCELLED', 'REJECTED') OR "releaseLedgerJournalId" IS NOT NULL)
    AND ("status" <> 'PAID' OR "payoutLedgerJournalId" IS NOT NULL)
    AND ("status" <> 'PAID' OR "releaseLedgerJournalId" IS NULL)
  );
ALTER TABLE "WithdrawalPolicy"
  ADD CONSTRAINT "WithdrawalPolicy_supported_owner_type" CHECK ("ownerType" IN ('STORE', 'DRIVER', 'PROMOTER')),
  ADD CONSTRAINT "WithdrawalPolicy_limits_non_negative" CHECK (
    ("minimumAmount" IS NULL OR "minimumAmount" >= 0)
    AND ("maximumAmount" IS NULL OR "maximumAmount" >= 0)
    AND ("dailyMaximumAmount" IS NULL OR "dailyMaximumAmount" >= 0)
    AND ("minimumAmount" IS NULL OR "maximumAmount" IS NULL OR "minimumAmount" <= "maximumAmount")
  );
ALTER TABLE "PayoutDestination"
  ADD CONSTRAINT "PayoutDestination_currency_zar" CHECK ("currency" = 'ZAR'),
  ADD CONSTRAINT "PayoutDestination_supported_owner_type" CHECK ("ownerType" IN ('STORE', 'DRIVER', 'PROMOTER')),
  ADD CONSTRAINT "PayoutDestination_no_raw_reference" CHECK (
    "providerCode" = 'MANUAL_FINANCE'
    AND "externalReference" ~ '^manual-finance:[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$'
    AND length("maskedLabel") BETWEEN 1 AND 160
    AND ("accountLast4" IS NULL OR "accountLast4" ~ '^[A-Za-z0-9]{1,4}$')
  );
ALTER TABLE "WithdrawalPayoutAttempt"
  ADD CONSTRAINT "WithdrawalPayoutAttempt_number_positive" CHECK ("attemptNumber" > 0),
  ADD CONSTRAINT "WithdrawalPayoutAttempt_external_reference_safe" CHECK (
    "externalReference" IS NULL OR "externalReference" ~ '^manual-bank:[A-Za-z0-9][A-Za-z0-9._:-]{2,119}$'
  ),
  ADD CONSTRAINT "WithdrawalPayoutAttempt_success_evidence" CHECK (
    "status" <> 'SUCCEEDED' OR "externalReference" IS NOT NULL
  );
ALTER TABLE "WithdrawalReconciliationCase"
  ADD CONSTRAINT "WithdrawalReconciliationCase_observation_positive" CHECK ("observationCount" > 0),
  ADD CONSTRAINT "WithdrawalReconciliationCase_terminal_coherence" CHECK (
    ("status" NOT IN ('RESOLVED', 'CLOSED')) OR ("resolvedAt" IS NOT NULL AND "resolutionCode" IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION "phase13_withdrawal_history_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Withdrawal status history is immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "WithdrawalStatusHistory_immutable"
  BEFORE UPDATE OR DELETE ON "WithdrawalStatusHistory"
  FOR EACH ROW EXECUTE FUNCTION "phase13_withdrawal_history_immutable"();

CREATE OR REPLACE FUNCTION "phase13_withdrawal_request_guard"() RETURNS trigger AS $$
BEGIN
  IF OLD."withdrawalNumber" IS DISTINCT FROM NEW."withdrawalNumber"
    OR OLD."walletId" IS DISTINCT FROM NEW."walletId"
    OR OLD."ownerType" IS DISTINCT FROM NEW."ownerType"
    OR OLD."ownerId" IS DISTINCT FROM NEW."ownerId"
    OR OLD."sourceAccountId" IS DISTINCT FROM NEW."sourceAccountId"
    OR OLD."heldAccountId" IS DISTINCT FROM NEW."heldAccountId"
    OR OLD."payoutDestinationId" IS DISTINCT FROM NEW."payoutDestinationId"
    OR OLD."amount" IS DISTINCT FROM NEW."amount"
    OR OLD."currency" IS DISTINCT FROM NEW."currency"
    OR OLD."creationIdempotencyKey" IS DISTINCT FROM NEW."creationIdempotencyKey"
    OR OLD."creationRequestHash" IS DISTINCT FROM NEW."creationRequestHash"
    OR OLD."policyVersion" IS DISTINCT FROM NEW."policyVersion"
    OR OLD."reserveLedgerJournalId" IS DISTINCT FROM NEW."reserveLedgerJournalId" THEN
    RAISE EXCEPTION 'Withdrawal financial identity is immutable';
  END IF;
  IF OLD."status" IN ('PAID', 'REJECTED', 'CANCELLED') AND OLD."status" IS DISTINCT FROM NEW."status" THEN
    RAISE EXCEPTION 'Terminal withdrawal state cannot be reopened';
  END IF;
  IF OLD."releaseLedgerJournalId" IS NOT NULL AND OLD."releaseLedgerJournalId" IS DISTINCT FROM NEW."releaseLedgerJournalId" THEN
    RAISE EXCEPTION 'Withdrawal release journal link is immutable';
  END IF;
  IF OLD."payoutLedgerJournalId" IS NOT NULL AND OLD."payoutLedgerJournalId" IS DISTINCT FROM NEW."payoutLedgerJournalId" THEN
    RAISE EXCEPTION 'Withdrawal payout journal link is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "WithdrawalRequest_guard"
  BEFORE UPDATE ON "WithdrawalRequest"
  FOR EACH ROW EXECUTE FUNCTION "phase13_withdrawal_request_guard"();

CREATE OR REPLACE FUNCTION "phase13_withdrawal_paid_evidence_guard"() RETURNS trigger AS $$
BEGIN
  IF NEW."status" = 'PAID' AND NOT EXISTS (
    SELECT 1 FROM "WithdrawalPayoutAttempt"
    WHERE "withdrawalId" = NEW."id" AND "status" = 'SUCCEEDED' AND "externalReference" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Paid withdrawal requires a successful payout attempt with an external reference';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "WithdrawalRequest_paid_evidence_guard"
  BEFORE INSERT OR UPDATE ON "WithdrawalRequest"
  FOR EACH ROW EXECUTE FUNCTION "phase13_withdrawal_paid_evidence_guard"();

CREATE OR REPLACE FUNCTION "phase13_payout_attempt_guard"() RETURNS trigger AS $$
BEGIN
  IF OLD."publicReference" IS DISTINCT FROM NEW."publicReference"
    OR OLD."withdrawalId" IS DISTINCT FROM NEW."withdrawalId"
    OR OLD."attemptNumber" IS DISTINCT FROM NEW."attemptNumber"
    OR OLD."method" IS DISTINCT FROM NEW."method"
    OR OLD."idempotencyKey" IS DISTINCT FROM NEW."idempotencyKey"
    OR OLD."requestHash" IS DISTINCT FROM NEW."requestHash" THEN
    RAISE EXCEPTION 'Withdrawal payout attempt identity is immutable';
  END IF;
  IF OLD."externalReference" IS NOT NULL AND OLD."externalReference" IS DISTINCT FROM NEW."externalReference" THEN
    RAISE EXCEPTION 'External payout reference is immutable once recorded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "WithdrawalPayoutAttempt_guard"
  BEFORE UPDATE ON "WithdrawalPayoutAttempt"
  FOR EACH ROW EXECUTE FUNCTION "phase13_payout_attempt_guard"();

CREATE OR REPLACE FUNCTION "phase13_payout_destination_guard"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND EXISTS (SELECT 1 FROM "WithdrawalRequest" WHERE "payoutDestinationId" = OLD."id") THEN
    RAISE EXCEPTION 'A payout destination used by a withdrawal cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    OLD."walletId" IS DISTINCT FROM NEW."walletId"
    OR OLD."ownerType" IS DISTINCT FROM NEW."ownerType"
    OR OLD."ownerId" IS DISTINCT FROM NEW."ownerId"
    OR OLD."method" IS DISTINCT FROM NEW."method"
    OR OLD."providerCode" IS DISTINCT FROM NEW."providerCode"
    OR OLD."externalReference" IS DISTINCT FROM NEW."externalReference"
    OR OLD."maskedLabel" IS DISTINCT FROM NEW."maskedLabel"
    OR OLD."institutionName" IS DISTINCT FROM NEW."institutionName"
    OR OLD."accountLast4" IS DISTINCT FROM NEW."accountLast4"
    OR OLD."currency" IS DISTINCT FROM NEW."currency"
    OR OLD."countryCode" IS DISTINCT FROM NEW."countryCode"
  ) THEN
    RAISE EXCEPTION 'Payout destination identity is immutable; create a replacement destination';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "PayoutDestination_guard"
  BEFORE UPDATE OR DELETE ON "PayoutDestination"
  FOR EACH ROW EXECUTE FUNCTION "phase13_payout_destination_guard"();

CREATE OR REPLACE FUNCTION "phase13_reconciliation_terminal_guard"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" IN ('RESOLVED', 'CLOSED') AND OLD."status" IS DISTINCT FROM NEW."status" THEN
    RAISE EXCEPTION 'Terminal withdrawal reconciliation case cannot be reopened';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "WithdrawalReconciliationCase_terminal_guard"
  BEFORE UPDATE ON "WithdrawalReconciliationCase"
  FOR EACH ROW EXECUTE FUNCTION "phase13_reconciliation_terminal_guard"();
