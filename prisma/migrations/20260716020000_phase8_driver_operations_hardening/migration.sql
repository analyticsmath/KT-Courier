-- Phase 8 is additive. Existing operational history and prior migrations remain immutable.

ALTER TABLE "DriverProfile"
  ADD COLUMN "availabilityRevision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Order"
  ADD COLUMN "custodyEstablishedAt" TIMESTAMP(3),
  ADD COLUMN "transitStartedAt" TIMESTAMP(3);

ALTER TABLE "ProofOfDelivery"
  ADD COLUMN "evidenceReference" TEXT;

ALTER TABLE "DeliveryOtp"
  ADD COLUMN "invalidatedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "lockedAt" TIMESTAMP(3);

CREATE TABLE "DeliveryAttempt" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "reason" "DeliveryExceptionReason" NOT NULL,
  "retryable" BOOLEAN NOT NULL,
  "publicNote" TEXT,
  "internalNote" TEXT,
  "evidenceReference" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeliveryAttempt_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "OrderAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DeliveryAttempt_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DeliveryAttempt_orderId_attemptNumber_key"
  ON "DeliveryAttempt"("orderId", "attemptNumber");
CREATE INDEX "DeliveryAttempt_assignmentId_createdAt_idx"
  ON "DeliveryAttempt"("assignmentId", "createdAt");
CREATE INDEX "DeliveryAttempt_driverProfileId_createdAt_idx"
  ON "DeliveryAttempt"("driverProfileId", "createdAt");

CREATE TABLE "DriverOperationCommand" (
  "id" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "resultSnapshot" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverOperationCommand_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DriverOperationCommand_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DriverOperationCommand_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "OrderAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DriverOperationCommand_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DriverOperationCommand_operationId_key" ON "DriverOperationCommand"("operationId");
CREATE INDEX "DriverOperationCommand_orderId_createdAt_idx" ON "DriverOperationCommand"("orderId", "createdAt");
CREATE INDEX "DriverOperationCommand_assignmentId_createdAt_idx" ON "DriverOperationCommand"("assignmentId", "createdAt");
CREATE INDEX "DriverOperationCommand_driverProfileId_createdAt_idx" ON "DriverOperationCommand"("driverProfileId", "createdAt");
