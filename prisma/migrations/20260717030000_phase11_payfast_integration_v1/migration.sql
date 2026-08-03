-- Phase 11: South African Payfast custom form-POST checkout audit fields.
-- No credentials, signatures, signed form fields, ITNs, success evidence,
-- ledger posting, wallet movement, or order mutation are introduced here.

CREATE TYPE "PaymentProviderEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');
CREATE TYPE "PaymentCustomerActionType" AS ENUM ('FORM_POST', 'REDIRECT_GET');

ALTER TABLE "PaymentAttempt"
  ADD COLUMN "publicReference" TEXT,
  ADD COLUMN "providerEnvironment" "PaymentProviderEnvironment",
  ADD COLUMN "checkoutActionType" "PaymentCustomerActionType",
  ADD COLUMN "checkoutPreparedAt" TIMESTAMP(3),
  ADD COLUMN "providerProtocolVersion" TEXT,
  ADD COLUMN "configurationFingerprint" TEXT;

CREATE UNIQUE INDEX "PaymentAttempt_publicReference_key" ON "PaymentAttempt"("publicReference");

ALTER TABLE "PaymentAttempt"
  ADD CONSTRAINT "PaymentAttempt_public_reference_check" CHECK (
    "publicReference" IS NULL OR (
      length("publicReference") BETWEEN 20 AND 100
      AND "publicReference" ~ '^pat_[A-Za-z0-9_-]+$'
    )
  ),
  ADD CONSTRAINT "PaymentAttempt_payfast_audit_length_check" CHECK (
    ("providerProtocolVersion" IS NULL OR length("providerProtocolVersion") BETWEEN 1 AND 80)
    AND ("configurationFingerprint" IS NULL OR length("configurationFingerprint") BETWEEN 1 AND 80)
  ),
  ADD CONSTRAINT "PaymentAttempt_payfast_merchant_reference_length_check" CHECK (
    "provider"::text <> 'PAYFAST' OR length("merchantReference") <= 100
  ),
  ADD CONSTRAINT "PaymentAttempt_checkout_action_audit_check" CHECK (
    "checkoutActionType" IS NULL OR (
      "publicReference" IS NOT NULL
      AND "providerEnvironment" IS NOT NULL
      AND "checkoutPreparedAt" IS NOT NULL
      AND "providerProtocolVersion" IS NOT NULL
      AND "configurationFingerprint" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "PaymentAttempt_form_post_has_no_redirect_check" CHECK (
    "checkoutActionType" IS DISTINCT FROM 'FORM_POST' OR "redirectUrl" IS NULL
  );

COMMENT ON COLUMN "PaymentAttempt"."publicReference" IS 'Random immutable URL-safe attempt reference; never a database identifier.';
COMMENT ON COLUMN "PaymentAttempt"."providerEnvironment" IS 'Non-secret provider environment audit only.';
COMMENT ON COLUMN "PaymentAttempt"."checkoutActionType" IS 'Normalized browser handoff type; Payfast Phase 11 uses FORM_POST.';
COMMENT ON COLUMN "PaymentAttempt"."configurationFingerprint" IS 'Static non-secret configuration/version identity; never a digest of credentials.';

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
     OR OLD."configurationFingerprint" IS DISTINCT FROM NEW."configurationFingerprint" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment attempt identity is immutable.';
  END IF;
  IF OLD."checkoutActionType" IS NOT NULL
     AND OLD."checkoutActionType" IS DISTINCT FROM NEW."checkoutActionType" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment customer action type is immutable after preparation.';
  END IF;
  IF OLD."checkoutPreparedAt" IS NOT NULL
     AND OLD."checkoutPreparedAt" IS DISTINCT FROM NEW."checkoutPreparedAt" THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Payment checkout preparation time is immutable.';
  END IF;
  RETURN NEW;
END $$;
