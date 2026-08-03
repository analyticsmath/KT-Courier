-- KT Couriers Phase 2.6: Pickup Custody Workflow
-- Adds OrderOperationalEvent table, new enums (OrderOperationalEventType,
-- PickupFailureReason, ParcelCondition), and extends OrderAssignmentEventType
-- with pickup operation values.

-- ─── Extend OrderAssignmentEventType with pickup values ───────────────────────
-- ALTER TYPE ... ADD VALUE must be outside a transaction block in older PG versions.
-- Using IF NOT EXISTS (PG 9.3+) for idempotency.

ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'PICKUP_STARTED';
ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'PICKUP_COMPLETED';
ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'PICKUP_FAILED';

-- ─── New enums ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderOperationalEventType') THEN
    CREATE TYPE "OrderOperationalEventType" AS ENUM (
      'PICKUP_STARTED',
      'PICKUP_COMPLETED',
      'PICKUP_FAILED',
      'PARCEL_CONDITION_RECORDED',
      'DRIVER_NOTE_ADDED',
      'ADMIN_OPERATION_NOTE_ADDED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PickupFailureReason') THEN
    CREATE TYPE "PickupFailureReason" AS ENUM (
      'PARCEL_NOT_READY',
      'SENDER_UNAVAILABLE',
      'PICKUP_ADDRESS_ISSUE',
      'ACCESS_ISSUE',
      'ORDER_CANCELLED_AT_PICKUP',
      'SAFETY_ISSUE',
      'OTHER'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ParcelCondition') THEN
    CREATE TYPE "ParcelCondition" AS ENUM (
      'NOT_RECORDED',
      'GOOD',
      'DAMAGED_PACKAGING',
      'FRAGILE',
      'INCOMPLETE',
      'REQUIRES_ADMIN_REVIEW'
    );
  END IF;
END $$;

-- ─── OrderOperationalEvent ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "OrderOperationalEvent" (
  "id"              TEXT NOT NULL,
  "orderId"         TEXT NOT NULL,
  "assignmentId"    TEXT,
  "driverProfileId" TEXT,
  "actorUserId"     TEXT NOT NULL,
  "actorRole"       TEXT NOT NULL,
  "eventType"       "OrderOperationalEventType" NOT NULL,
  "statusBefore"    "OrderStatus",
  "statusAfter"     "OrderStatus",
  "occurredAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "latitude"        DECIMAL(10,7),
  "longitude"       DECIMAL(10,7),
  "publicNote"      TEXT,
  "internalNote"    TEXT,
  "failureReason"   "PickupFailureReason",
  "parcelCondition" "ParcelCondition",
  "parcelCount"     INTEGER,
  "metadata"        JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderOperationalEvent_pkey" PRIMARY KEY ("id")
);

-- ─── Indices ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "OrderOperationalEvent_orderId_idx"         ON "OrderOperationalEvent"("orderId");
CREATE INDEX IF NOT EXISTS "OrderOperationalEvent_assignmentId_idx"    ON "OrderOperationalEvent"("assignmentId");
CREATE INDEX IF NOT EXISTS "OrderOperationalEvent_driverProfileId_idx" ON "OrderOperationalEvent"("driverProfileId");
CREATE INDEX IF NOT EXISTS "OrderOperationalEvent_eventType_idx"       ON "OrderOperationalEvent"("eventType");
CREATE INDEX IF NOT EXISTS "OrderOperationalEvent_occurredAt_idx"      ON "OrderOperationalEvent"("occurredAt");
CREATE INDEX IF NOT EXISTS "OrderOperationalEvent_createdAt_idx"       ON "OrderOperationalEvent"("createdAt");

-- ─── Foreign Keys ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderOperationalEvent_orderId_fkey') THEN
    ALTER TABLE "OrderOperationalEvent"
      ADD CONSTRAINT "OrderOperationalEvent_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderOperationalEvent_assignmentId_fkey') THEN
    ALTER TABLE "OrderOperationalEvent"
      ADD CONSTRAINT "OrderOperationalEvent_assignmentId_fkey"
      FOREIGN KEY ("assignmentId") REFERENCES "OrderAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderOperationalEvent_driverProfileId_fkey') THEN
    ALTER TABLE "OrderOperationalEvent"
      ADD CONSTRAINT "OrderOperationalEvent_driverProfileId_fkey"
      FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderOperationalEvent_actorUserId_fkey') THEN
    ALTER TABLE "OrderOperationalEvent"
      ADD CONSTRAINT "OrderOperationalEvent_actorUserId_fkey"
      FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
