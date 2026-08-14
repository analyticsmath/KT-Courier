-- Phase B ENG-PRIV-007/008: access-controlled location and security incident evidence.
ALTER TABLE "OperationalIncident" ADD COLUMN "affectedDataClasses" JSONB;
ALTER TABLE "OperationalIncident" ADD COLUMN "affectedUserId" TEXT;
ALTER TABLE "OperationalIncident" ADD COLUMN "affectedResourceType" TEXT;
ALTER TABLE "OperationalIncident" ADD COLUMN "affectedResourceRef" TEXT;
ALTER TABLE "OperationalIncident" ADD COLUMN "notificationDecision" JSONB;
CREATE TABLE "OperationalIncidentEvidence" (
  "id" TEXT NOT NULL, "incidentId" TEXT NOT NULL, "privateMediaObjectId" TEXT, "evidenceType" TEXT NOT NULL,
  "safeReference" TEXT, "createdByUserId" TEXT NOT NULL, "operationId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationalIncidentEvidence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OperationalIncidentEvidence_operationId_key" ON "OperationalIncidentEvidence"("operationId");
CREATE INDEX "OperationalIncidentEvidence_incidentId_createdAt_idx" ON "OperationalIncidentEvidence"("incidentId", "createdAt");
ALTER TABLE "OperationalIncidentEvidence" ADD CONSTRAINT "OperationalIncidentEvidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "OperationalIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperationalIncidentEvidence" ADD CONSTRAINT "OperationalIncidentEvidence_privateMediaObjectId_fkey" FOREIGN KEY ("privateMediaObjectId") REFERENCES "PrivateMediaObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
