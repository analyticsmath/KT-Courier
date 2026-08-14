ALTER TYPE "PrivateMediaOwnerType" ADD VALUE IF NOT EXISTS 'INCIDENT';
ALTER TYPE "PrivateMediaPurpose" ADD VALUE IF NOT EXISTS 'INCIDENT_EVIDENCE';

CREATE TABLE "OperationalIncidentOperation" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'PENDING',
  "result" JSONB,
  "safeError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperationalIncidentOperation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperationalIncidentOperation_operationId_key" ON "OperationalIncidentOperation"("operationId");
CREATE INDEX "OperationalIncidentOperation_incidentId_operation_idx" ON "OperationalIncidentOperation"("incidentId", "operation");
CREATE INDEX "OperationalIncidentOperation_state_updatedAt_idx" ON "OperationalIncidentOperation"("state", "updatedAt");
ALTER TABLE "OperationalIncidentOperation" ADD CONSTRAINT "OperationalIncidentOperation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
