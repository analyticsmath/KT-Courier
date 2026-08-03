-- prisma: disable-transaction
-- Phase 10: provider-neutral payment foundation.
-- No provider integration, capture, webhook, refund, order mutation, or ledger
-- posting is activated by this migration.

-- The Phase 4 payment tables had no runtime writers. Their optional identities,
-- aggregate-level provider result fields, and missing command receipts cannot be
-- backfilled truthfully. Fail closed instead of fabricating payment evidence.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Payment")
     OR EXISTS (SELECT 1 FROM "PaymentAttempt")
     OR EXISTS (SELECT 1 FROM "PaymentRefund")
     OR EXISTS (SELECT 1 FROM "PaymentWebhookEvent") THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Phase 10 migration blocked: legacy payment rows require architect-approved identity, status, and idempotency reconciliation.';
  END IF;
END $$;

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CREATED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PROVIDER_PENDING';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'SUCCEEDED';

ALTER TYPE "PaymentAttemptStatus" ADD VALUE IF NOT EXISTS 'RESERVED';
ALTER TYPE "PaymentAttemptStatus" ADD VALUE IF NOT EXISTS 'REQUESTING';
ALTER TYPE "PaymentAttemptStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_ACTION';
ALTER TYPE "PaymentAttemptStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "PaymentAttemptStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN';

CREATE TYPE "PaymentProviderFailureCategory" AS ENUM (
  'INVALID_REQUEST',
  'AUTHENTICATION',
  'CONFIGURATION',
  'DECLINED',
  'RATE_LIMITED',
  'TIMEOUT',
  'NETWORK',
  'PROVIDER_UNAVAILABLE',
  'MALFORMED_RESPONSE',
  'UNKNOWN_OUTCOME',
  'UNKNOWN'
);

CREATE TYPE "PaymentHistoryActorType" AS ENUM ('SYSTEM', 'PAYER', 'ADMIN', 'PROVIDER');

ALTER TABLE "Payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "PaymentAttempt" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "Payment"
  ALTER COLUMN "userId" SET NOT NULL,
  ALTER COLUMN "orderId" SET NOT NULL,
  ALTER COLUMN "provider" DROP NOT NULL,
  ALTER COLUMN "purpose" SET DEFAULT 'ORDER',
  ALTER COLUMN "status" SET DEFAULT 'CREATED',
  ALTER COLUMN "amount" TYPE DECIMAL(18,2),
  ALTER COLUMN "currency" DROP DEFAULT,
  ALTER COLUMN "currency" TYPE "LedgerCurrency" USING ("currency"::text::"LedgerCurrency"),
  ALTER COLUMN "currency" SET DEFAULT 'ZAR',
  ALTER COLUMN "idempotencyKey" SET NOT NULL,
  ADD COLUMN "creationRequestHash" TEXT NOT NULL,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "latestAttemptNumber" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "expiresAt" TIMESTAMP(3);

ALTER TABLE "PaymentAttempt"
  ALTER COLUMN "status" SET DEFAULT 'RESERVED',
  ALTER COLUMN "amount" TYPE DECIMAL(18,2),
  ALTER COLUMN "currency" DROP DEFAULT,
  ALTER COLUMN "currency" TYPE "LedgerCurrency" USING ("currency"::text::"LedgerCurrency"),
  ALTER COLUMN "currency" SET DEFAULT 'ZAR',
  ADD COLUMN "attemptNumber" INTEGER NOT NULL,
  ADD COLUMN "idempotencyKey" TEXT NOT NULL,
  ADD COLUMN "requestHash" TEXT NOT NULL,
  ADD COLUMN "merchantReference" TEXT NOT NULL,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "providerStatusCode" TEXT,
  ADD COLUMN "failureCategory" "PaymentProviderFailureCategory",
  ADD COLUMN "requestSnapshot" JSONB,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "Payment_currency_zar_check" CHECK ("currency" = 'ZAR'),
  ADD CONSTRAINT "Payment_request_hash_check" CHECK (length("creationRequestHash") = 64),
  ADD CONSTRAINT "Payment_idempotency_key_nonempty_check" CHECK (length(btrim("idempotencyKey")) BETWEEN 8 AND 128),
  ADD CONSTRAINT "Payment_version_counter_check" CHECK ("version" >= 0 AND "latestAttemptNumber" >= 0);

ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "PaymentAttempt_amount_positive_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "PaymentAttempt_currency_zar_check" CHECK ("currency" = 'ZAR'),
  ADD CONSTRAINT "PaymentAttempt_attempt_number_positive_check" CHECK ("attemptNumber" > 0),
  ADD CONSTRAINT "PaymentAttempt_request_hash_check" CHECK (length("requestHash") = 64),
  ADD CONSTRAINT "PaymentAttempt_idempotency_key_nonempty_check" CHECK (length(btrim("idempotencyKey")) BETWEEN 8 AND 128),
  ADD CONSTRAINT "PaymentAttempt_merchant_reference_check" CHECK (length(btrim("merchantReference")) BETWEEN 12 AND 160),
  ADD CONSTRAINT "PaymentAttempt_snapshot_size_check" CHECK (
    ("requestSnapshot" IS NULL OR octet_length("requestSnapshot"::text) <= 32768)
    AND ("providerPayload" IS NULL OR octet_length("providerPayload"::text) <= 32768)
  ),
  ADD CONSTRAINT "PaymentAttempt_version_check" CHECK ("version" >= 0);

CREATE TABLE "PaymentStatusHistory" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "attemptId" TEXT,
  "fromStatus" "PaymentStatus",
  "toStatus" "PaymentStatus" NOT NULL,
  "reasonCode" TEXT,
  "actorType" "PaymentHistoryActorType" NOT NULL DEFAULT 'SYSTEM',
  "actorId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentStatusHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentStatusHistory_metadata_size_check" CHECK (
    "metadata" IS NULL OR octet_length("metadata"::text) <= 16384
  )
);

-- Indexes follow the safe column/type changes above.
CREATE UNIQUE INDEX "PaymentAttempt_paymentId_attemptNumber_key" ON "PaymentAttempt"("paymentId", "attemptNumber");
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");
CREATE UNIQUE INDEX "PaymentAttempt_merchantReference_key" ON "PaymentAttempt"("merchantReference");
CREATE UNIQUE INDEX "PaymentAttempt_provider_providerReference_key" ON "PaymentAttempt"("provider", "providerReference");
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId", "status");
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");
CREATE INDEX "Payment_provider_status_idx" ON "Payment"("provider", "status");
CREATE INDEX "PaymentAttempt_paymentId_status_idx" ON "PaymentAttempt"("paymentId", "status");
CREATE INDEX "PaymentStatusHistory_paymentId_createdAt_idx" ON "PaymentStatusHistory"("paymentId", "createdAt");
CREATE INDEX "PaymentStatusHistory_attemptId_idx" ON "PaymentStatusHistory"("attemptId");
CREATE INDEX "PaymentStatusHistory_toStatus_createdAt_idx" ON "PaymentStatusHistory"("toStatus", "createdAt");

ALTER TABLE "Payment" DROP CONSTRAINT "Payment_userId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_orderId_fkey";
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentStatusHistory"
  ADD CONSTRAINT "PaymentStatusHistory_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "PaymentStatusHistory_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMENT ON COLUMN "Payment"."providerReference" IS 'Deprecated empty Phase 4 compatibility column. Provider references belong to PaymentAttempt and this column is ignored by Prisma.';
COMMENT ON COLUMN "Payment"."checkoutUrl" IS 'Deprecated empty Phase 4 compatibility column. Redirect URLs belong to PaymentAttempt and this column is ignored by Prisma.';
COMMENT ON COLUMN "Payment"."refundedAt" IS 'Deprecated empty Phase 4 compatibility column. Refund behavior is outside Phase 10 and this column is ignored by Prisma.';
COMMENT ON COLUMN "PaymentAttempt"."providerPayload" IS 'Phase 10 safe normalized result snapshot only; raw provider responses are prohibited.';
COMMENT ON TABLE "PaymentWebhookEvent" IS 'Inactive Phase 4 placeholder. Phase 10 performs no webhook processing.';
COMMENT ON TABLE "PaymentRefund" IS 'Inactive Phase 4 placeholder. Phase 10 performs no refund processing.';

CREATE FUNCTION "protect_payment_identity_and_success"()
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
  IF OLD."status" = 'SUCCEEDED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Succeeded payments are immutable.';
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

CREATE TRIGGER "Payment_identity_and_success_immutable"
BEFORE UPDATE ON "Payment"
FOR EACH ROW EXECUTE FUNCTION "protect_payment_identity_and_success"();

CREATE FUNCTION "protect_payment_attempt_identity"()
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
     OR OLD."currency" IS DISTINCT FROM NEW."currency" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment attempt identity is immutable.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PaymentAttempt_identity_immutable"
BEFORE UPDATE ON "PaymentAttempt"
FOR EACH ROW EXECUTE FUNCTION "protect_payment_attempt_identity"();

CREATE FUNCTION "validate_payment_attempt_provider"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE payment_provider "PaymentProvider";
BEGIN
  SELECT "provider" INTO payment_provider FROM "Payment" WHERE "id" = NEW."paymentId";
  IF payment_provider IS NULL OR payment_provider IS DISTINCT FROM NEW."provider" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment attempt provider does not match the payment current-provider policy.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PaymentAttempt_provider_matches_payment"
BEFORE INSERT OR UPDATE ON "PaymentAttempt"
FOR EACH ROW EXECUTE FUNCTION "validate_payment_attempt_provider"();

CREATE FUNCTION "validate_payment_history_attempt"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."attemptId" IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM "PaymentAttempt"
       WHERE "id" = NEW."attemptId" AND "paymentId" = NEW."paymentId"
     ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment history attempt must belong to the same payment.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "PaymentStatusHistory_attempt_matches_payment"
BEFORE INSERT ON "PaymentStatusHistory"
FOR EACH ROW EXECUTE FUNCTION "validate_payment_history_attempt"();

CREATE FUNCTION "protect_payment_history_immutability"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment lifecycle history is immutable.';
END $$;

CREATE TRIGGER "PaymentStatusHistory_immutability"
BEFORE UPDATE OR DELETE ON "PaymentStatusHistory"
FOR EACH ROW EXECUTE FUNCTION "protect_payment_history_immutability"();
