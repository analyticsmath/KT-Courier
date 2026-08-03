-- KT Couriers Phase 2.5: Dispatch and Assignment Workflow
-- Creates OrderAssignmentStatus, OrderAssignmentEventType enums,
-- OrderAssignment and OrderAssignmentEvent tables.

-- ─── Enums ───────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderAssignmentStatus') THEN
    CREATE TYPE "OrderAssignmentStatus" AS ENUM (
      'ASSIGNED',
      'ACCEPTED',
      'REJECTED',
      'CANCELLED',
      'COMPLETED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderAssignmentEventType') THEN
    CREATE TYPE "OrderAssignmentEventType" AS ENUM (
      'ASSIGNMENT_CREATED',
      'ASSIGNMENT_ACCEPTED',
      'ASSIGNMENT_REJECTED',
      'ASSIGNMENT_CANCELLED',
      'ASSIGNMENT_REASSIGNED',
      'ASSIGNMENT_COMPLETED',
      'ASSIGNMENT_NOTE_ADDED'
    );
  END IF;
END $$;

-- ─── OrderAssignment ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "OrderAssignment" (
  "id"                   TEXT NOT NULL,
  "orderId"              TEXT NOT NULL,
  "driverProfileId"      TEXT NOT NULL,
  "assignedByAdminId"    TEXT,
  "status"               "OrderAssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
  "assignedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt"           TIMESTAMP(3),
  "rejectedAt"           TIMESTAMP(3),
  "cancelledAt"          TIMESTAMP(3),
  "completedAt"          TIMESTAMP(3),
  "cancelledByAdminId"   TEXT,
  "reassignedFromId"     TEXT,
  "rejectionReason"      TEXT,
  "cancellationReason"   TEXT,
  "adminNote"            TEXT,
  "driverNote"           TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAssignment_pkey" PRIMARY KEY ("id")
);

-- ─── OrderAssignmentEvent ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "OrderAssignmentEvent" (
  "id"              TEXT NOT NULL,
  "assignmentId"    TEXT NOT NULL,
  "orderId"         TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "actorUserId"     TEXT,
  "actorRole"       TEXT,
  "eventType"       "OrderAssignmentEventType" NOT NULL,
  "previousStatus"  "OrderAssignmentStatus",
  "newStatus"       "OrderAssignmentStatus",
  "note"            TEXT,
  "metadata"        JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderAssignmentEvent_pkey" PRIMARY KEY ("id")
);

-- ─── Indices ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS "OrderAssignment_orderId_idx"         ON "OrderAssignment"("orderId");
CREATE INDEX IF NOT EXISTS "OrderAssignment_driverProfileId_idx" ON "OrderAssignment"("driverProfileId");
CREATE INDEX IF NOT EXISTS "OrderAssignment_status_idx"          ON "OrderAssignment"("status");
CREATE INDEX IF NOT EXISTS "OrderAssignment_assignedAt_idx"      ON "OrderAssignment"("assignedAt");
CREATE INDEX IF NOT EXISTS "OrderAssignment_orderId_status_idx"  ON "OrderAssignment"("orderId", "status");

CREATE INDEX IF NOT EXISTS "OrderAssignmentEvent_assignmentId_idx"    ON "OrderAssignmentEvent"("assignmentId");
CREATE INDEX IF NOT EXISTS "OrderAssignmentEvent_orderId_idx"         ON "OrderAssignmentEvent"("orderId");
CREATE INDEX IF NOT EXISTS "OrderAssignmentEvent_driverProfileId_idx" ON "OrderAssignmentEvent"("driverProfileId");
CREATE INDEX IF NOT EXISTS "OrderAssignmentEvent_eventType_idx"       ON "OrderAssignmentEvent"("eventType");
CREATE INDEX IF NOT EXISTS "OrderAssignmentEvent_createdAt_idx"       ON "OrderAssignmentEvent"("createdAt");

-- ─── Foreign Keys ────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderAssignment_orderId_fkey') THEN
    ALTER TABLE "OrderAssignment"
      ADD CONSTRAINT "OrderAssignment_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderAssignment_driverProfileId_fkey') THEN
    ALTER TABLE "OrderAssignment"
      ADD CONSTRAINT "OrderAssignment_driverProfileId_fkey"
      FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderAssignment_reassignedFromId_fkey') THEN
    ALTER TABLE "OrderAssignment"
      ADD CONSTRAINT "OrderAssignment_reassignedFromId_fkey"
      FOREIGN KEY ("reassignedFromId") REFERENCES "OrderAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderAssignmentEvent_assignmentId_fkey') THEN
    ALTER TABLE "OrderAssignmentEvent"
      ADD CONSTRAINT "OrderAssignmentEvent_assignmentId_fkey"
      FOREIGN KEY ("assignmentId") REFERENCES "OrderAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
