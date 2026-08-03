-- Phase 7 dispatch hardening. Additive only; historical assignments/events remain intact.
ALTER TYPE "OrderAssignmentStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
ALTER TYPE "OrderAssignmentStatus" ADD VALUE IF NOT EXISTS 'REVOKED';
ALTER TYPE "OrderAssignmentStatus" ADD VALUE IF NOT EXISTS 'SUPERSEDED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_OFFERED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_ACCEPTED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_REJECTED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_EXPIRED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_REVOKED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_SUPERSEDED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_COMPLETED';
ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_EXPIRED';
ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_REVOKED';
ALTER TYPE "OrderAssignmentEventType" ADD VALUE IF NOT EXISTS 'ASSIGNMENT_SUPERSEDED';

ALTER TABLE "DriverProfile"
  ADD COLUMN "maxConcurrentAssignments" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "availabilityUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "currentDriverProfileId" TEXT;
ALTER TABLE "OrderAssignment"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "respondedAt" TIMESTAMP(3),
  ADD COLUMN "expiredAt" TIMESTAMP(3),
  ADD COLUMN "revokedAt" TIMESTAMP(3),
  ADD COLUMN "supersededAt" TIMESTAMP(3),
  ADD COLUMN "activeOrderGuard" TEXT,
  ADD COLUMN "dispatchPolicyVersion" TEXT NOT NULL DEFAULT 'dispatch-v1',
  ADD COLUMN "eligibilitySnapshot" JSONB,
  ADD COLUMN "reasonCode" TEXT,
  ADD COLUMN "reasonNote" TEXT;
ALTER TABLE "OrderAssignmentEvent" ADD COLUMN "reasonCode" TEXT;

-- Refuse ambiguous legacy data instead of silently selecting a current assignment.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM "OrderAssignment"
    WHERE "status" IN ('ASSIGNED', 'ACCEPTED')
    GROUP BY "orderId" HAVING count(*) > 1
  ) THEN RAISE EXCEPTION 'Phase 7 preflight failed: an order has multiple active legacy assignments.'; END IF;
END $$;

UPDATE "OrderAssignment"
SET "offeredAt" = COALESCE("assignedAt", "createdAt"),
    "activeOrderGuard" = CASE WHEN "status" IN ('ASSIGNED', 'ACCEPTED') THEN "orderId" ELSE NULL END;

UPDATE "Order" AS o
SET "currentDriverProfileId" = a."driverProfileId"
FROM "OrderAssignment" AS a
WHERE a."orderId" = o."id" AND a."status" = 'ACCEPTED';

CREATE UNIQUE INDEX "OrderAssignment_activeOrderGuard_key" ON "OrderAssignment"("activeOrderGuard");
CREATE INDEX "DriverProfile_availability_status_idx" ON "DriverProfile"("availability", "status");
CREATE INDEX "Order_currentDriverProfileId_idx" ON "Order"("currentDriverProfileId");
CREATE INDEX "OrderAssignment_orderId_status_createdAt_idx" ON "OrderAssignment"("orderId", "status", "createdAt");
CREATE INDEX "OrderAssignment_driverProfileId_status_expiresAt_idx" ON "OrderAssignment"("driverProfileId", "status", "expiresAt");
CREATE INDEX "OrderAssignment_status_expiresAt_idx" ON "OrderAssignment"("status", "expiresAt");
CREATE INDEX "OrderAssignment_driverProfileId_createdAt_idx" ON "OrderAssignment"("driverProfileId", "createdAt");

ALTER TABLE "Order" ADD CONSTRAINT "Order_currentDriverProfileId_fkey" FOREIGN KEY ("currentDriverProfileId") REFERENCES "DriverProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
