-- Automatic dispatch must be explicitly approved (maker/checker) before the production
-- worker may offer work, and automated offers are attributed to a typed system actor
-- rather than to an unrelated human administrator. Purely additive; no rows are rewritten.

-- 1. Governed automatic-dispatch approval record. No row means no automatic offers.
CREATE TABLE "DispatchAutomationPolicy" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "regionIds" JSONB NOT NULL,
  "maxOfferAttempts" INTEGER NOT NULL DEFAULT 3,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveUntil" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "activatedByUserId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "rejectionReasonCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DispatchAutomationPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DispatchAutomationPolicy_status_check"
    CHECK ("status" IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED', 'REJECTED')),
  CONSTRAINT "DispatchAutomationPolicy_attempts_check"
    CHECK ("maxOfferAttempts" BETWEEN 1 AND 10),
  CONSTRAINT "DispatchAutomationPolicy_regions_check"
    CHECK (jsonb_typeof("regionIds") = 'array' AND jsonb_array_length("regionIds") > 0),
  CONSTRAINT "DispatchAutomationPolicy_interval_check"
    CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom"),
  -- Independent approval: the approver can never be the author.
  CONSTRAINT "DispatchAutomationPolicy_maker_checker_check"
    CHECK ("approvedByUserId" IS NULL OR "approvedByUserId" <> "createdByUserId"),
  CONSTRAINT "DispatchAutomationPolicy_active_evidence_check"
    CHECK ("status" <> 'ACTIVE' OR ("approvedByUserId" IS NOT NULL AND "approvedAt" IS NOT NULL AND "activatedByUserId" IS NOT NULL AND "activatedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "DispatchAutomationPolicy_publicReference_key" ON "DispatchAutomationPolicy"("publicReference");
CREATE UNIQUE INDEX "DispatchAutomationPolicy_versionNumber_key" ON "DispatchAutomationPolicy"("versionNumber");
CREATE INDEX "DispatchAutomationPolicy_status_effectiveFrom_idx" ON "DispatchAutomationPolicy"("status", "effectiveFrom");
-- At most one ACTIVE policy at a time.
CREATE UNIQUE INDEX "DispatchAutomationPolicy_single_active_key" ON "DispatchAutomationPolicy"(("status")) WHERE "status" = 'ACTIVE';

-- 2. Typed system actor on assignments (exactly one human admin or one system identity).
ALTER TABLE "OrderAssignment" ALTER COLUMN "assignedByAdminId" DROP NOT NULL;
ALTER TABLE "OrderAssignment" ADD COLUMN "assignedBySystemActor" TEXT;
ALTER TABLE "OrderAssignment" ADD COLUMN "dispatchPolicyReference" TEXT;
ALTER TABLE "OrderAssignment" ADD COLUMN "dispatchOperationId" TEXT;
ALTER TABLE "OrderAssignment" ADD CONSTRAINT "OrderAssignment_single_actor_check"
  CHECK (("assignedByAdminId" IS NOT NULL) <> ("assignedBySystemActor" IS NOT NULL)) NOT VALID;
ALTER TABLE "OrderAssignment" VALIDATE CONSTRAINT "OrderAssignment_single_actor_check";

-- 3. Typed system actor on assignment events.
ALTER TABLE "OrderAssignmentEvent" ALTER COLUMN "actorUserId" DROP NOT NULL;
ALTER TABLE "OrderAssignmentEvent" ADD COLUMN "actorSystemIdentity" TEXT;
ALTER TABLE "OrderAssignmentEvent" ADD CONSTRAINT "OrderAssignmentEvent_single_actor_check"
  CHECK (("actorUserId" IS NOT NULL) <> ("actorSystemIdentity" IS NOT NULL)) NOT VALID;
ALTER TABLE "OrderAssignmentEvent" VALIDATE CONSTRAINT "OrderAssignmentEvent_single_actor_check";
