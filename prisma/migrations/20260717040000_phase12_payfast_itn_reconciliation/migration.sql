-- Phase 12: South African Payfast authoritative ITN evidence, reconciliation,
-- and atomic external-payment receipt posting. This migration stores no raw
-- ITN body, signature, signature base, credential, payer contact data, cookie,
-- authorization header, or full request headers.

-- The Phase 4 webhook table was a deliberately inactive placeholder. Its rows
-- have no trustworthy fingerprint, source, signature, amount, or confirmation
-- evidence and therefore cannot be promoted safely.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PaymentWebhookEvent") THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Phase 12 migration blocked: placeholder webhook rows require architect-approved reconciliation and cannot be fabricated as verified evidence.';
  END IF;
END $$;

CREATE TYPE "PaymentWebhookNormalizedStatus" AS ENUM ('COMPLETE', 'PENDING', 'FAILED', 'UNKNOWN');
CREATE TYPE "PaymentWebhookProcessingStatus" AS ENUM (
  'RECEIVED',
  'REJECTED',
  'VERIFIED',
  'APPLIED',
  'DUPLICATE',
  'IGNORED_STALE',
  'RECONCILIATION_REQUIRED',
  'TEMPORARY_FAILURE'
);
CREATE TYPE "PaymentReconciliationReason" AS ENUM (
  'UNKNOWN_OUTCOME',
  'CREDENTIAL_VERSION_MISMATCH',
  'PROVIDER_CONFIRMATION_UNAVAILABLE',
  'CONFLICTING_PROVIDER_STATUS',
  'OUT_OF_ORDER_EVENT',
  'AMOUNT_MISMATCH',
  'MERCHANT_MISMATCH',
  'PROVIDER_REFERENCE_CONFLICT',
  'UNRECOGNIZED_PROVIDER_STATUS',
  'APPLICATION_FAILURE_AFTER_VERIFICATION',
  'STALE_PROCESSING_ATTEMPT'
);
CREATE TYPE "PaymentReconciliationCaseStatus" AS ENUM ('OPEN', 'MONITORING', 'RESOLVED', 'CLOSED');
CREATE TYPE "PaymentReconciliationPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "PaymentReconciliationState" AS ENUM ('CLEAR', 'REQUIRED', 'RESOLVED');

ALTER TYPE "LedgerJournalType" ADD VALUE IF NOT EXISTS 'EXTERNAL_PAYMENT_RECEIPT';

-- Keep Phase 4 placeholder columns intact. They are compatibility-only,
-- non-authoritative, not used by Phase 12 services, and scheduled for the
-- consolidated cleanup gate. Relax their old required constraints so every
-- newly structured receipt can leave them NULL without fabricating evidence.
ALTER TABLE "PaymentWebhookEvent"
  ALTER COLUMN "eventType" DROP NOT NULL,
  ALTER COLUMN "processingStatus" DROP NOT NULL,
  ALTER COLUMN "processingStatus" DROP DEFAULT,
  ALTER COLUMN "payload" DROP NOT NULL;

ALTER TABLE "PaymentWebhookEvent"
  ADD COLUMN "publicReference" TEXT NOT NULL,
  ADD COLUMN "environment" "PaymentProviderEnvironment" NOT NULL,
  ADD COLUMN "eventFingerprint" TEXT NOT NULL,
  ADD COLUMN "merchantReference" TEXT NOT NULL,
  ADD COLUMN "providerPaymentId" TEXT,
  ADD COLUMN "providerStatus" TEXT NOT NULL,
  ADD COLUMN "normalizedStatus" "PaymentWebhookNormalizedStatus" NOT NULL,
  ADD COLUMN "itnProcessingStatus" "PaymentWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  ADD COLUMN "attemptId" TEXT,
  ADD COLUMN "ledgerJournalId" TEXT,
  ADD COLUMN "credentialVersion" TEXT,
  ADD COLUMN "sourceAddress" TEXT,
  ADD COLUMN "sourceAddressVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "merchantVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "amountVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "providerDataVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "safePayloadSnapshot" JSONB,
  ADD COLUMN "unknownFieldCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rejectionCode" TEXT,
  ADD COLUMN "reconciliationReason" "PaymentReconciliationReason",
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "appliedAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Payment"
  ADD COLUMN "successfulAttemptId" TEXT,
  ADD COLUMN "successWebhookEventId" TEXT,
  ADD COLUMN "successLedgerJournalId" TEXT,
  ADD COLUMN "providerConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "reconciliationStatus" "PaymentReconciliationState" NOT NULL DEFAULT 'CLEAR';

ALTER TABLE "PaymentAttempt"
  ADD COLUMN "providerCredentialVersion" TEXT,
  ADD COLUMN "providerConfirmedAt" TIMESTAMP(3);

CREATE TABLE "PaymentReconciliationCase" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "caseKey" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "attemptId" TEXT,
  "webhookEventId" TEXT,
  "provider" "PaymentProvider" NOT NULL,
  "reason" "PaymentReconciliationReason" NOT NULL,
  "status" "PaymentReconciliationCaseStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "PaymentReconciliationPriority" NOT NULL DEFAULT 'MEDIUM',
  "summary" TEXT NOT NULL,
  "safeEvidence" JSONB,
  "observationCount" INTEGER NOT NULL DEFAULT 1,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolutionCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentReconciliationCase_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PaymentWebhookEvent"
  ADD CONSTRAINT "PaymentWebhookEvent_public_reference_check" CHECK (
    length("publicReference") BETWEEN 20 AND 100
    AND "publicReference" ~ '^pwe_[A-Za-z0-9_-]+$'
  ),
  ADD CONSTRAINT "PaymentWebhookEvent_fingerprint_check" CHECK ("eventFingerprint" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "PaymentWebhookEvent_identity_length_check" CHECK (
    length(btrim("merchantReference")) BETWEEN 12 AND 100
    AND length(btrim("providerStatus")) BETWEEN 1 AND 64
    AND ("providerPaymentId" IS NULL OR length("providerPaymentId") BETWEEN 1 AND 128)
    AND ("credentialVersion" IS NULL OR length("credentialVersion") BETWEEN 1 AND 80)
    AND ("sourceAddress" IS NULL OR length("sourceAddress") BETWEEN 3 AND 64)
    AND ("rejectionCode" IS NULL OR length("rejectionCode") BETWEEN 1 AND 100)
  ),
  ADD CONSTRAINT "PaymentWebhookEvent_safe_snapshot_check" CHECK (
    "safePayloadSnapshot" IS NULL OR octet_length("safePayloadSnapshot"::text) <= 8192
  ),
  ADD CONSTRAINT "PaymentWebhookEvent_legacy_compatibility_null_check" CHECK (
    "providerEventId" IS NULL
    AND "eventType" IS NULL
    AND "processingStatus" IS NULL
    AND "signatureValid" IS NULL
    AND "payload" IS NULL
    AND "errorMessage" IS NULL
    AND "processedAt" IS NULL
  ),
  ADD CONSTRAINT "PaymentWebhookEvent_unknown_field_count_check" CHECK ("unknownFieldCount" BETWEEN 0 AND 64),
  ADD CONSTRAINT "PaymentWebhookEvent_verified_coherence_check" CHECK (
    "itnProcessingStatus" NOT IN ('VERIFIED', 'APPLIED', 'DUPLICATE', 'IGNORED_STALE')
    OR (
      "sourceAddressVerified"
      AND "signatureVerified"
      AND "merchantVerified"
      AND "amountVerified"
      AND "providerDataVerified"
      AND "verifiedAt" IS NOT NULL
      AND "paymentId" IS NOT NULL
      AND "attemptId" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "PaymentWebhookEvent_applied_coherence_check" CHECK (
    "itnProcessingStatus" <> 'APPLIED'
    OR (
      "appliedAt" IS NOT NULL
      AND ("normalizedStatus" <> 'COMPLETE' OR "ledgerJournalId" IS NOT NULL)
    )
  );

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_success_evidence_coherence_check" CHECK (
    (
      "successfulAttemptId" IS NULL
      AND "successWebhookEventId" IS NULL
      AND "successLedgerJournalId" IS NULL
      AND "providerConfirmedAt" IS NULL
    )
    OR (
      "successfulAttemptId" IS NOT NULL
      AND "successWebhookEventId" IS NOT NULL
      AND "successLedgerJournalId" IS NOT NULL
      AND "providerConfirmedAt" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "Payment_succeeded_requires_provider_evidence_check" CHECK (
    "status"::text <> 'SUCCEEDED'
    OR (
      "successfulAttemptId" IS NOT NULL
      AND "successWebhookEventId" IS NOT NULL
      AND "successLedgerJournalId" IS NOT NULL
      AND "providerConfirmedAt" IS NOT NULL
    )
  );

ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "PaymentAttempt_credential_version_check" CHECK (
    "providerCredentialVersion" IS NULL OR length("providerCredentialVersion") BETWEEN 1 AND 80
  );

ALTER TABLE "PaymentReconciliationCase"
  ADD CONSTRAINT "PaymentReconciliationCase_public_reference_check" CHECK (
    length("publicReference") BETWEEN 20 AND 100
    AND "publicReference" ~ '^prc_[A-Za-z0-9_-]+$'
  ),
  ADD CONSTRAINT "PaymentReconciliationCase_case_key_check" CHECK (length("caseKey") BETWEEN 12 AND 512),
  ADD CONSTRAINT "PaymentReconciliationCase_summary_check" CHECK (length("summary") BETWEEN 1 AND 500),
  ADD CONSTRAINT "PaymentReconciliationCase_evidence_check" CHECK (
    "safeEvidence" IS NULL OR octet_length("safeEvidence"::text) <= 8192
  ),
  ADD CONSTRAINT "PaymentReconciliationCase_observation_check" CHECK ("observationCount" > 0),
  ADD CONSTRAINT "PaymentReconciliationCase_resolution_check" CHECK (
    ("status" IN ('RESOLVED', 'CLOSED') AND "resolvedAt" IS NOT NULL AND "resolutionCode" IS NOT NULL)
    OR ("status" IN ('OPEN', 'MONITORING') AND "resolvedAt" IS NULL AND "resolutionCode" IS NULL)
  );

ALTER TABLE "LedgerAccount"
  ADD CONSTRAINT "LedgerAccount_phase12_purpose_category_check" CHECK (
    ("purpose" <> 'HELD' OR "category" = 'LIABILITY')
    AND ("purpose" <> 'CASH_CLEARING' OR "category" = 'ASSET')
  );

-- Indexes and unique financial cardinalities follow the additive Phase 12
-- columns. Legacy placeholder indexes remain for compatibility until cleanup.
CREATE UNIQUE INDEX "PaymentWebhookEvent_publicReference_key" ON "PaymentWebhookEvent"("publicReference");
CREATE UNIQUE INDEX "PaymentWebhookEvent_eventFingerprint_key" ON "PaymentWebhookEvent"("eventFingerprint");
CREATE UNIQUE INDEX "PaymentWebhookEvent_ledgerJournalId_key" ON "PaymentWebhookEvent"("ledgerJournalId");
CREATE INDEX "PaymentWebhookEvent_attemptId_idx" ON "PaymentWebhookEvent"("attemptId");
CREATE INDEX "PaymentWebhookEvent_environment_receivedAt_idx" ON "PaymentWebhookEvent"("environment", "receivedAt");
CREATE INDEX "PaymentWebhookEvent_providerStatus_idx" ON "PaymentWebhookEvent"("providerStatus");
CREATE INDEX "PaymentWebhookEvent_normalizedStatus_idx" ON "PaymentWebhookEvent"("normalizedStatus");
CREATE INDEX "PaymentWebhookEvent_itnProcessingStatus_idx" ON "PaymentWebhookEvent"("itnProcessingStatus");
CREATE INDEX "PaymentWebhookEvent_merchantReference_idx" ON "PaymentWebhookEvent"("merchantReference");
CREATE INDEX "PaymentWebhookEvent_provider_providerPaymentId_idx" ON "PaymentWebhookEvent"("provider", "providerPaymentId");
CREATE INDEX "PaymentWebhookEvent_paymentId_attemptId_receivedAt_idx" ON "PaymentWebhookEvent"("paymentId", "attemptId", "receivedAt");

CREATE UNIQUE INDEX "Payment_successfulAttemptId_key" ON "Payment"("successfulAttemptId");
CREATE UNIQUE INDEX "Payment_successWebhookEventId_key" ON "Payment"("successWebhookEventId");
CREATE UNIQUE INDEX "Payment_successLedgerJournalId_key" ON "Payment"("successLedgerJournalId");
CREATE INDEX "Payment_reconciliationStatus_updatedAt_idx" ON "Payment"("reconciliationStatus", "updatedAt");
CREATE INDEX "PaymentAttempt_provider_providerCredentialVersion_status_idx" ON "PaymentAttempt"("provider", "providerCredentialVersion", "status");

CREATE UNIQUE INDEX "PaymentReconciliationCase_publicReference_key" ON "PaymentReconciliationCase"("publicReference");
CREATE UNIQUE INDEX "PaymentReconciliationCase_caseKey_key" ON "PaymentReconciliationCase"("caseKey");
CREATE INDEX "PaymentReconciliationCase_status_priority_lastObservedAt_idx" ON "PaymentReconciliationCase"("status", "priority", "lastObservedAt");
CREATE INDEX "PaymentReconciliationCase_paymentId_status_idx" ON "PaymentReconciliationCase"("paymentId", "status");
CREATE INDEX "PaymentReconciliationCase_attemptId_status_idx" ON "PaymentReconciliationCase"("attemptId", "status");
CREATE INDEX "PaymentReconciliationCase_webhookEventId_idx" ON "PaymentReconciliationCase"("webhookEventId");
CREATE INDEX "PaymentReconciliationCase_provider_reason_status_idx" ON "PaymentReconciliationCase"("provider", "reason", "status");

ALTER TABLE "PaymentWebhookEvent"
  ADD CONSTRAINT "PaymentWebhookEvent_paymentId_phase12_restrict_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentWebhookEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentWebhookEvent_ledgerJournalId_fkey" FOREIGN KEY ("ledgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_successfulAttemptId_fkey" FOREIGN KEY ("successfulAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Payment_successWebhookEventId_fkey" FOREIGN KEY ("successWebhookEventId") REFERENCES "PaymentWebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Payment_successLedgerJournalId_fkey" FOREIGN KEY ("successLedgerJournalId") REFERENCES "LedgerJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentReconciliationCase"
  ADD CONSTRAINT "PaymentReconciliationCase_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentReconciliationCase_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentReconciliationCase_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "PaymentWebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Payment/attempt/event structural coherence is protected in SQL while the
-- application remains the owner of transition precedence.
CREATE OR REPLACE FUNCTION "protect_payment_identity_and_success"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."latestAttemptNumber" < OLD."latestAttemptNumber" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment attempt counter cannot decrease.';
  END IF;
  IF OLD."status" IS DISTINCT FROM NEW."status" AND NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment version must increase with every state change.';
  END IF;
  -- Successful financial/provider evidence is immutable. The reconciliation
  -- classification may still be changed when later verified evidence conflicts.
  IF OLD."status"::text = 'SUCCEEDED'
     AND (to_jsonb(OLD) - 'reconciliationStatus' - 'updatedAt')
         IS DISTINCT FROM (to_jsonb(NEW) - 'reconciliationStatus' - 'updatedAt') THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Succeeded payment evidence is immutable.';
  END IF;
  IF EXISTS (SELECT 1 FROM "PaymentAttempt" WHERE "paymentId" = OLD."id")
     AND (
       OLD."amount" IS DISTINCT FROM NEW."amount"
       OR OLD."currency" IS DISTINCT FROM NEW."currency"
       OR OLD."orderId" IS DISTINCT FROM NEW."orderId"
       OR OLD."userId" IS DISTINCT FROM NEW."userId"
       OR OLD."provider" IS DISTINCT FROM NEW."provider"
       OR OLD."purpose" IS DISTINCT FROM NEW."purpose"
       OR OLD."idempotencyKey" IS DISTINCT FROM NEW."idempotencyKey"
       OR OLD."creationRequestHash" IS DISTINCT FROM NEW."creationRequestHash"
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment financial and subject identity is immutable after an attempt exists.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION "protect_payment_attempt_identity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" IS DISTINCT FROM NEW."status" AND NEW."version" <= OLD."version" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment attempt version must increase with every state change.';
  END IF;
  IF OLD."paymentId" IS DISTINCT FROM NEW."paymentId"
     OR OLD."attemptNumber" IS DISTINCT FROM NEW."attemptNumber"
     OR OLD."provider" IS DISTINCT FROM NEW."provider"
     OR OLD."idempotencyKey" IS DISTINCT FROM NEW."idempotencyKey"
     OR OLD."requestHash" IS DISTINCT FROM NEW."requestHash"
     OR OLD."merchantReference" IS DISTINCT FROM NEW."merchantReference"
     OR OLD."amount" IS DISTINCT FROM NEW."amount"
     OR OLD."currency" IS DISTINCT FROM NEW."currency"
     OR OLD."publicReference" IS DISTINCT FROM NEW."publicReference"
     OR OLD."providerEnvironment" IS DISTINCT FROM NEW."providerEnvironment"
     OR OLD."providerProtocolVersion" IS DISTINCT FROM NEW."providerProtocolVersion"
     OR OLD."configurationFingerprint" IS DISTINCT FROM NEW."configurationFingerprint"
     OR (OLD."providerCredentialVersion" IS NOT NULL AND OLD."providerCredentialVersion" IS DISTINCT FROM NEW."providerCredentialVersion") THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment attempt identity is immutable.';
  END IF;
  IF OLD."providerReference" IS NOT NULL AND OLD."providerReference" IS DISTINCT FROM NEW."providerReference" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Established provider payment reference is immutable.';
  END IF;
  IF OLD."checkoutActionType" IS NOT NULL AND OLD."checkoutActionType" IS DISTINCT FROM NEW."checkoutActionType" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment customer action type is immutable after preparation.';
  END IF;
  IF OLD."checkoutPreparedAt" IS NOT NULL AND OLD."checkoutPreparedAt" IS DISTINCT FROM NEW."checkoutPreparedAt" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment checkout preparation time is immutable.';
  END IF;
  IF OLD."providerConfirmedAt" IS NOT NULL AND OLD."providerConfirmedAt" IS DISTINCT FROM NEW."providerConfirmedAt" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Provider confirmation time is immutable.';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION "validate_payment_success_evidence"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."successfulAttemptId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PaymentAttempt" a
    WHERE a."id" = NEW."successfulAttemptId"
      AND a."paymentId" = NEW."id"
      AND a."status"::text = 'SUCCEEDED'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment success attempt evidence is incoherent.';
  END IF;
  IF NEW."successWebhookEventId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PaymentWebhookEvent" e
    WHERE e."id" = NEW."successWebhookEventId"
      AND e."paymentId" = NEW."id"
      AND e."normalizedStatus" = 'COMPLETE'
      AND e."providerDataVerified"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment success webhook evidence is incoherent.';
  END IF;
  IF NEW."successLedgerJournalId" IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM "LedgerJournal" j
    JOIN "PaymentWebhookEvent" e ON e."id" = NEW."successWebhookEventId"
    WHERE j."id" = NEW."successLedgerJournalId"
      AND j."type"::text = 'EXTERNAL_PAYMENT_RECEIPT'
      AND j."currency"::text = 'ZAR'
      AND j."correlationId" = NEW."paymentNumber"
      AND j."totalDebits" = NEW."amount"
      AND j."totalCredits" = NEW."amount"
      AND e."ledgerJournalId" = j."id"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment success journal evidence is incoherent.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "Payment_success_evidence_coherent"
BEFORE INSERT OR UPDATE ON "Payment"
FOR EACH ROW EXECUTE FUNCTION "validate_payment_success_evidence"();

CREATE FUNCTION "protect_payment_webhook_event"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment webhook receipts cannot be deleted.';
  END IF;
  IF OLD."publicReference" IS DISTINCT FROM NEW."publicReference"
     OR OLD."provider" IS DISTINCT FROM NEW."provider"
     OR OLD."environment" IS DISTINCT FROM NEW."environment"
     OR OLD."eventFingerprint" IS DISTINCT FROM NEW."eventFingerprint"
     OR OLD."merchantReference" IS DISTINCT FROM NEW."merchantReference"
     OR OLD."providerPaymentId" IS DISTINCT FROM NEW."providerPaymentId"
     OR OLD."providerStatus" IS DISTINCT FROM NEW."providerStatus"
     OR OLD."normalizedStatus" IS DISTINCT FROM NEW."normalizedStatus"
     OR OLD."credentialVersion" IS DISTINCT FROM NEW."credentialVersion"
     OR OLD."sourceAddress" IS DISTINCT FROM NEW."sourceAddress"
     OR OLD."safePayloadSnapshot" IS DISTINCT FROM NEW."safePayloadSnapshot"
     OR OLD."unknownFieldCount" IS DISTINCT FROM NEW."unknownFieldCount"
     OR OLD."receivedAt" IS DISTINCT FROM NEW."receivedAt"
     OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment webhook receipt identity and provider evidence are immutable.';
  END IF;
  IF OLD."sourceAddressVerified" AND NOT NEW."sourceAddressVerified"
     OR OLD."signatureVerified" AND NOT NEW."signatureVerified"
     OR OLD."merchantVerified" AND NOT NEW."merchantVerified"
     OR OLD."amountVerified" AND NOT NEW."amountVerified"
     OR OLD."providerDataVerified" AND NOT NEW."providerDataVerified" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Verified webhook evidence cannot be downgraded.';
  END IF;
  IF OLD."paymentId" IS NOT NULL AND OLD."paymentId" IS DISTINCT FROM NEW."paymentId"
     OR OLD."attemptId" IS NOT NULL AND OLD."attemptId" IS DISTINCT FROM NEW."attemptId"
     OR OLD."ledgerJournalId" IS NOT NULL AND OLD."ledgerJournalId" IS DISTINCT FROM NEW."ledgerJournalId"
     OR OLD."verifiedAt" IS NOT NULL AND OLD."verifiedAt" IS DISTINCT FROM NEW."verifiedAt"
     OR OLD."appliedAt" IS NOT NULL AND OLD."appliedAt" IS DISTINCT FROM NEW."appliedAt" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Established webhook relations and timestamps are immutable.';
  END IF;
  IF OLD."itnProcessingStatus" IN ('REJECTED', 'APPLIED', 'DUPLICATE', 'IGNORED_STALE', 'RECONCILIATION_REQUIRED')
     AND OLD."itnProcessingStatus" IS DISTINCT FROM NEW."itnProcessingStatus" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Terminal webhook processing state is immutable.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PaymentWebhookEvent_identity_and_deletion_protection"
BEFORE UPDATE OR DELETE ON "PaymentWebhookEvent"
FOR EACH ROW EXECUTE FUNCTION "protect_payment_webhook_event"();

CREATE FUNCTION "validate_payment_webhook_relations"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."attemptId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "PaymentAttempt" a
    WHERE a."id" = NEW."attemptId"
      AND a."paymentId" = NEW."paymentId"
      AND a."merchantReference" = NEW."merchantReference"
      AND a."provider" = NEW."provider"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Webhook attempt/payment identity is incoherent.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PaymentWebhookEvent_relations_coherent"
BEFORE INSERT OR UPDATE ON "PaymentWebhookEvent"
FOR EACH ROW EXECUTE FUNCTION "validate_payment_webhook_relations"();

CREATE FUNCTION "protect_reconciliation_identity"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."caseKey" IS DISTINCT FROM NEW."caseKey"
     OR OLD."publicReference" IS DISTINCT FROM NEW."publicReference"
     OR OLD."paymentId" IS DISTINCT FROM NEW."paymentId"
     OR OLD."attemptId" IS DISTINCT FROM NEW."attemptId"
     OR OLD."webhookEventId" IS DISTINCT FROM NEW."webhookEventId"
     OR OLD."provider" IS DISTINCT FROM NEW."provider"
     OR OLD."reason" IS DISTINCT FROM NEW."reason"
     OR OLD."safeEvidence" IS DISTINCT FROM NEW."safeEvidence"
     OR OLD."openedAt" IS DISTINCT FROM NEW."openedAt"
     OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment reconciliation identity is immutable.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PaymentReconciliationCase_identity_immutable"
BEFORE UPDATE ON "PaymentReconciliationCase"
FOR EACH ROW EXECUTE FUNCTION "protect_reconciliation_identity"();

COMMENT ON TABLE "PaymentWebhookEvent" IS 'Phase 12 durable Payfast delivery receipts. Exact raw bodies, signatures, credentials, payer identity, full headers, and request hashes are prohibited.';
COMMENT ON COLUMN "PaymentWebhookEvent"."eventFingerprint" IS 'Internal SHA-256 identity over provider, environment, and exact request bytes; excluded from ordinary APIs.';
COMMENT ON COLUMN "PaymentWebhookEvent"."safePayloadSnapshot" IS 'Allowlisted non-contact reconciliation evidence only; never a raw provider payload.';
COMMENT ON COLUMN "PaymentWebhookEvent"."providerEventId" IS 'Deprecated Phase 4 compatibility field. Must remain NULL. Not used by the Phase 12 Payfast verification pipeline; cleanup is deferred.';
COMMENT ON COLUMN "PaymentWebhookEvent"."eventType" IS 'Deprecated Phase 4 compatibility field. Must remain NULL. Not used by the Phase 12 Payfast verification pipeline; cleanup is deferred.';
COMMENT ON COLUMN "PaymentWebhookEvent"."processingStatus" IS 'Deprecated Phase 4 compatibility field. Must remain NULL. Not used by the Phase 12 Payfast verification pipeline; cleanup is deferred.';
COMMENT ON COLUMN "PaymentWebhookEvent"."signatureValid" IS 'Deprecated Phase 4 compatibility field. Must remain NULL. Not used by the Phase 12 Payfast verification pipeline; cleanup is deferred.';
COMMENT ON COLUMN "PaymentWebhookEvent"."payload" IS 'Deprecated Phase 4 compatibility field. Must remain NULL. Not used by the Phase 12 Payfast verification pipeline; cleanup is deferred.';
COMMENT ON COLUMN "PaymentWebhookEvent"."errorMessage" IS 'Deprecated Phase 4 compatibility field. Must remain NULL. Not used by the Phase 12 Payfast verification pipeline; cleanup is deferred.';
COMMENT ON COLUMN "PaymentWebhookEvent"."processedAt" IS 'Deprecated Phase 4 compatibility field. Must remain NULL. Not used by the Phase 12 Payfast verification pipeline; cleanup is deferred.';
COMMENT ON COLUMN "PaymentAttempt"."providerCredentialVersion" IS 'Stable non-secret credential-set identifier captured when the attempt is prepared.';
COMMENT ON TABLE "PaymentReconciliationCase" IS 'Read-only operational case evidence. It grants no manual payment-success or ledger-posting authority.';
