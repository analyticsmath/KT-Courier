-- Phase 2.7: Delivery Execution, OTP Confirmation, Proof of Delivery
-- Migration: 20260611000004_phase_2_7_delivery_pod
--
-- Changes:
--   1. Extend OrderOperationalEventType enum with delivery event values
--   2. Extend OrderAssignmentEventType enum with delivery event values
--   3. Extend EmailTemplateType enum with DELIVERY_OTP
--   4. Add deliveryExceptionReason column to OrderOperationalEvent
--   5. Create ProofOfDeliveryMethod enum
--   6. Create DeliveryExceptionReason enum
--   7. Create ProofOfDelivery table
--   8. Create DeliveryOtp table
-- ---------------------------------------------------------------------------

-- 1. Extend OrderOperationalEventType
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_STARTED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_OTP_GENERATED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_OTP_VERIFIED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_COMPLETED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_ATTEMPTED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_FAILED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'POD_CREATED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'ADMIN_DELIVERY_OVERRIDE';

-- 2. Extend OrderAssignmentEventType
ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_STARTED';
ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_OTP_SENT';
ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_OTP_VERIFIED';
ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_COMPLETED';
ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_ATTEMPTED';
ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'DELIVERY_FAILED';

-- 3. Extend EmailTemplateType
ALTER TYPE "EmailTemplateType" ADD VALUE IF NOT EXISTS 'DELIVERY_OTP';

-- 4. Add deliveryExceptionReason to OrderOperationalEvent
DO $$ BEGIN
  CREATE TYPE "DeliveryExceptionReason" AS ENUM (
    'RECIPIENT_UNAVAILABLE',
    'WRONG_ADDRESS',
    'ACCESS_ISSUE',
    'RECIPIENT_REFUSED',
    'SAFETY_ISSUE',
    'PARCEL_DAMAGED',
    'PAYMENT_OR_DOCUMENT_ISSUE',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "OrderOperationalEvent"
  ADD COLUMN IF NOT EXISTS "deliveryExceptionReason" "DeliveryExceptionReason";

-- 5. Create ProofOfDeliveryMethod enum
DO $$ BEGIN
  CREATE TYPE "ProofOfDeliveryMethod" AS ENUM (
    'OTP',
    'ADMIN_MANUAL',
    'PHOTO_FUTURE',
    'SIGNATURE_FUTURE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 6. Create ProofOfDelivery table
CREATE TABLE IF NOT EXISTS "ProofOfDelivery" (
  "id"              TEXT          NOT NULL,
  "orderId"         TEXT          NOT NULL,
  "assignmentId"    TEXT,
  "driverProfileId" TEXT,
  "method"          "ProofOfDeliveryMethod" NOT NULL,
  "recipientName"   TEXT          NOT NULL,
  "recipientPhone"  TEXT,
  "otpVerifiedAt"   TIMESTAMP(3),
  "deliveredAt"     TIMESTAMP(3)  NOT NULL,
  "latitude"        DECIMAL(10,7),
  "longitude"       DECIMAL(10,7),
  "publicNote"      TEXT,
  "internalNote"    TEXT,
  "createdByUserId" TEXT          NOT NULL,
  "createdByRole"   TEXT          NOT NULL,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProofOfDelivery_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "ProofOfDelivery_orderId_key"     UNIQUE ("orderId"),
  CONSTRAINT "ProofOfDelivery_assignmentId_key" UNIQUE ("assignmentId")
);

-- FK constraints for ProofOfDelivery
ALTER TABLE "ProofOfDelivery"
  ADD CONSTRAINT "ProofOfDelivery_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProofOfDelivery"
  ADD CONSTRAINT "ProofOfDelivery_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "OrderAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProofOfDelivery"
  ADD CONSTRAINT "ProofOfDelivery_driverProfileId_fkey"
    FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProofOfDelivery"
  ADD CONSTRAINT "ProofOfDelivery_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indices for ProofOfDelivery
CREATE INDEX IF NOT EXISTS "ProofOfDelivery_orderId_idx"         ON "ProofOfDelivery"("orderId");
CREATE INDEX IF NOT EXISTS "ProofOfDelivery_assignmentId_idx"    ON "ProofOfDelivery"("assignmentId");
CREATE INDEX IF NOT EXISTS "ProofOfDelivery_driverProfileId_idx" ON "ProofOfDelivery"("driverProfileId");
CREATE INDEX IF NOT EXISTS "ProofOfDelivery_deliveredAt_idx"     ON "ProofOfDelivery"("deliveredAt");
CREATE INDEX IF NOT EXISTS "ProofOfDelivery_createdAt_idx"       ON "ProofOfDelivery"("createdAt");

-- 7. Create DeliveryOtp table
CREATE TABLE IF NOT EXISTS "DeliveryOtp" (
  "id"              TEXT          NOT NULL,
  "orderId"         TEXT          NOT NULL,
  "assignmentId"    TEXT,
  "codeHash"        TEXT          NOT NULL,
  "expiresAt"       TIMESTAMP(3)  NOT NULL,
  "consumedAt"      TIMESTAMP(3),
  "attempts"        INTEGER       NOT NULL DEFAULT 0,
  "maxAttempts"     INTEGER       NOT NULL DEFAULT 5,
  "resendCount"     INTEGER       NOT NULL DEFAULT 0,
  "lastSentAt"      TIMESTAMP(3),
  "sentToEmail"     TEXT,
  "createdByUserId" TEXT          NOT NULL,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DeliveryOtp_pkey" PRIMARY KEY ("id")
);

-- FK constraints for DeliveryOtp
ALTER TABLE "DeliveryOtp"
  ADD CONSTRAINT "DeliveryOtp_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeliveryOtp"
  ADD CONSTRAINT "DeliveryOtp_assignmentId_fkey"
    FOREIGN KEY ("assignmentId") REFERENCES "OrderAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeliveryOtp"
  ADD CONSTRAINT "DeliveryOtp_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indices for DeliveryOtp
CREATE INDEX IF NOT EXISTS "DeliveryOtp_orderId_idx"      ON "DeliveryOtp"("orderId");
CREATE INDEX IF NOT EXISTS "DeliveryOtp_assignmentId_idx" ON "DeliveryOtp"("assignmentId");
CREATE INDEX IF NOT EXISTS "DeliveryOtp_expiresAt_idx"    ON "DeliveryOtp"("expiresAt");
CREATE INDEX IF NOT EXISTS "DeliveryOtp_createdAt_idx"    ON "DeliveryOtp"("createdAt");
