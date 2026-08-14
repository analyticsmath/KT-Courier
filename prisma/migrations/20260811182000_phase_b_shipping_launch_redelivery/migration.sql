-- Phase B ENG-SHIP-001..005 explicit launch and redelivery evidence.
ALTER TABLE "DeliveryServiceDefinition" ADD COLUMN "launchScope" TEXT NOT NULL DEFAULT 'FULL_DIGITAL';
CREATE TABLE "RedeliveryRequest" (
  "id" TEXT NOT NULL, "publicReference" TEXT NOT NULL, "orderId" TEXT NOT NULL, "priorAttemptId" TEXT NOT NULL,
  "requestedByUserId" TEXT, "status" TEXT NOT NULL DEFAULT 'REQUESTED', "scheduledFor" TIMESTAMP(3), "responsibilityCode" TEXT,
  "safeNote" TEXT, "commercialEvidence" JSONB, "operationId" TEXT NOT NULL, "decidedByUserId" TEXT, "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RedeliveryRequest_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "RedeliveryRequest_publicReference_key" ON "RedeliveryRequest"("publicReference"); CREATE UNIQUE INDEX "RedeliveryRequest_operationId_key" ON "RedeliveryRequest"("operationId"); CREATE INDEX "RedeliveryRequest_orderId_status_idx" ON "RedeliveryRequest"("orderId", "status"); CREATE INDEX "RedeliveryRequest_priorAttemptId_idx" ON "RedeliveryRequest"("priorAttemptId");
