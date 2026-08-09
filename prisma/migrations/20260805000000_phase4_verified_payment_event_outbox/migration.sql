-- Phase 4: immutable verified-payment hand-off. This additive migration does
-- not modify historical payment evidence and intentionally performs no
-- backfill: old provider evidence cannot safely become a newly-created event.

CREATE TYPE "PaymentVerifiedEventConsumerStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'RECONCILIATION_REQUIRED'
);

CREATE TABLE "PaymentVerifiedEventIntent" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "eventIdentity" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "successfulAttemptId" TEXT NOT NULL,
  "webhookEventId" TEXT NOT NULL,
  "paymentReference" TEXT NOT NULL,
  "subjectType" "PaymentSubjectType" NOT NULL,
  "subjectReference" TEXT NOT NULL,
  "payerUserId" TEXT,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" "LedgerCurrency" NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "verifiedAt" TIMESTAMP(3) NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentVerifiedEventIntent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentVerifiedEventIntent_amount_positive_check" CHECK ("amount" > 0),
  CONSTRAINT "PaymentVerifiedEventIntent_currency_check" CHECK ("currency"::text = 'ZAR'),
  CONSTRAINT "PaymentVerifiedEventIntent_type_check" CHECK ("eventType" = 'PAYMENT_SUCCEEDED_VERIFIED'),
  CONSTRAINT "PaymentVerifiedEventIntent_schema_version_check" CHECK ("schemaVersion" = 1),
  CONSTRAINT "PaymentVerifiedEventIntent_reference_check" CHECK (
    "publicReference" ~ '^pve_[A-Za-z0-9_-]{20,80}$'
    AND length("eventIdentity") BETWEEN 24 AND 240
    AND length("paymentReference") BETWEEN 8 AND 100
    AND length("subjectReference") BETWEEN 1 AND 180
  )
);

CREATE TABLE "PaymentVerifiedEventConsumerReceipt" (
  "id" TEXT NOT NULL,
  "eventIntentId" TEXT NOT NULL,
  "consumer" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "status" "PaymentVerifiedEventConsumerStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "lastErrorCode" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentVerifiedEventConsumerReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentVerifiedEventConsumerReceipt_consumer_check" CHECK ("consumer" = 'PAYMENT_SUCCESS_DISPATCH_V1'),
  CONSTRAINT "PaymentVerifiedEventConsumerReceipt_attempt_count_check" CHECK ("attemptCount" > 0),
  CONSTRAINT "PaymentVerifiedEventConsumerReceipt_error_check" CHECK ("lastErrorCode" IS NULL OR length("lastErrorCode") BETWEEN 1 AND 120),
  CONSTRAINT "PaymentVerifiedEventConsumerReceipt_completion_check" CHECK (
    ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "lastErrorCode" IS NULL)
    OR ("status" = 'RECONCILIATION_REQUIRED' AND "completedAt" IS NOT NULL AND "lastErrorCode" IS NOT NULL)
    OR ("status" IN ('PENDING', 'PROCESSING') AND "completedAt" IS NULL)
  )
);

CREATE UNIQUE INDEX "PaymentVerifiedEventIntent_publicReference_key" ON "PaymentVerifiedEventIntent"("publicReference");
CREATE UNIQUE INDEX "PaymentVerifiedEventIntent_eventIdentity_key" ON "PaymentVerifiedEventIntent"("eventIdentity");
CREATE UNIQUE INDEX "PaymentVerifiedEventIntent_paymentId_key" ON "PaymentVerifiedEventIntent"("paymentId");
CREATE UNIQUE INDEX "PaymentVerifiedEventIntent_successfulAttemptId_key" ON "PaymentVerifiedEventIntent"("successfulAttemptId");
CREATE UNIQUE INDEX "PaymentVerifiedEventIntent_webhookEventId_key" ON "PaymentVerifiedEventIntent"("webhookEventId");
CREATE INDEX "PaymentVerifiedEventIntent_eventType_createdAt_idx" ON "PaymentVerifiedEventIntent"("eventType", "createdAt");
CREATE INDEX "PaymentVerifiedEventIntent_subjectType_createdAt_idx" ON "PaymentVerifiedEventIntent"("subjectType", "createdAt");
CREATE UNIQUE INDEX "PaymentVerifiedEventConsumerReceipt_operationId_key" ON "PaymentVerifiedEventConsumerReceipt"("operationId");
CREATE UNIQUE INDEX "PaymentVerifiedEventConsumerReceipt_eventIntentId_consumer_key" ON "PaymentVerifiedEventConsumerReceipt"("eventIntentId", "consumer");
CREATE INDEX "PaymentVerifiedEventConsumerReceipt_status_updatedAt_idx" ON "PaymentVerifiedEventConsumerReceipt"("status", "updatedAt");

ALTER TABLE "PaymentVerifiedEventIntent"
  ADD CONSTRAINT "PaymentVerifiedEventIntent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentVerifiedEventIntent_successfulAttemptId_fkey" FOREIGN KEY ("successfulAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentVerifiedEventIntent_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "PaymentWebhookEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentVerifiedEventConsumerReceipt"
  ADD CONSTRAINT "PaymentVerifiedEventConsumerReceipt_eventIntentId_fkey" FOREIGN KEY ("eventIntentId") REFERENCES "PaymentVerifiedEventIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "protect_payment_verified_event_intent"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Verified payment event intents cannot be deleted.';
  END IF;
  IF OLD."publicReference" IS DISTINCT FROM NEW."publicReference"
     OR OLD."eventIdentity" IS DISTINCT FROM NEW."eventIdentity"
     OR OLD."eventType" IS DISTINCT FROM NEW."eventType"
     OR OLD."paymentId" IS DISTINCT FROM NEW."paymentId"
     OR OLD."successfulAttemptId" IS DISTINCT FROM NEW."successfulAttemptId"
     OR OLD."webhookEventId" IS DISTINCT FROM NEW."webhookEventId"
     OR OLD."paymentReference" IS DISTINCT FROM NEW."paymentReference"
     OR OLD."subjectType" IS DISTINCT FROM NEW."subjectType"
     OR OLD."subjectReference" IS DISTINCT FROM NEW."subjectReference"
     OR OLD."payerUserId" IS DISTINCT FROM NEW."payerUserId"
     OR OLD."amount" IS DISTINCT FROM NEW."amount"
     OR OLD."currency" IS DISTINCT FROM NEW."currency"
     OR OLD."provider" IS DISTINCT FROM NEW."provider"
     OR OLD."verifiedAt" IS DISTINCT FROM NEW."verifiedAt"
     OR OLD."schemaVersion" IS DISTINCT FROM NEW."schemaVersion"
     OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Verified payment event evidence is immutable.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PaymentVerifiedEventIntent_immutable"
BEFORE UPDATE OR DELETE ON "PaymentVerifiedEventIntent"
FOR EACH ROW EXECUTE FUNCTION "protect_payment_verified_event_intent"();

CREATE FUNCTION "validate_payment_verified_event_intent"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "Payment" p
    JOIN "PaymentAttempt" a ON a."id" = NEW."successfulAttemptId"
    JOIN "PaymentWebhookEvent" e ON e."id" = NEW."webhookEventId"
    WHERE p."id" = NEW."paymentId"
      AND p."status"::text = 'SUCCEEDED'
      AND p."successfulAttemptId" = a."id"
      AND p."successWebhookEventId" = e."id"
      AND p."successLedgerJournalId" IS NOT NULL
      AND a."paymentId" = p."id"
      AND a."status"::text = 'SUCCEEDED'
      AND e."paymentId" = p."id"
      AND e."attemptId" = a."id"
      AND e."normalizedStatus"::text = 'COMPLETE'
      AND e."itnProcessingStatus"::text = 'APPLIED'
      AND e."providerDataVerified"
      AND NEW."amount" = p."amount"
      AND NEW."currency" = p."currency"
      AND NEW."provider" = e."provider"
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Verified payment event must be derived from canonical successful payment evidence.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PaymentVerifiedEventIntent_evidence_coherent"
BEFORE INSERT ON "PaymentVerifiedEventIntent"
FOR EACH ROW EXECUTE FUNCTION "validate_payment_verified_event_intent"();
