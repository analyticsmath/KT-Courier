-- Phase 3: additive courier-execution evidence and marketplace bridge projection.
-- No frozen marketplace commercial or settlement evidence is modified.

ALTER TYPE "StoreOrderDeliveryBridgeStatus" ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE "StoreOrderDeliveryBridgeStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_ATTEMPTED';
ALTER TYPE "StoreOrderDeliveryBridgeStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "StoreOrderDerivedStatus" ADD VALUE IF NOT EXISTS 'IN_TRANSIT';
ALTER TYPE "StoreOrderDerivedStatus" ADD VALUE IF NOT EXISTS 'DELIVERY_ATTEMPTED';
ALTER TYPE "StoreOrderDerivedStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';

CREATE TYPE "DriverLocationSource" AS ENUM ('DEVICE_GPS', 'DRIVER_MANUAL');
CREATE TYPE "DriverLocationValidationStatus" AS ENUM ('ACCEPTED', 'POOR_ACCURACY', 'STALE_TIMESTAMP', 'FUTURE_TIMESTAMP', 'IMPLAUSIBLE_JUMP', 'OUT_OF_SEQUENCE', 'PICKUP_PROXIMITY_MISMATCH', 'DELIVERY_PROXIMITY_MISMATCH');
CREATE TYPE "DeliveryProofEvidenceStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'QUARANTINED', 'REJECTED', 'ARCHIVED');

CREATE TABLE "DriverLocationEvidence" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "accuracyMeters" DECIMAL(10,2),
  "headingDegrees" DECIMAL(7,2),
  "speedMetersPerSecond" DECIMAL(10,3),
  "source" "DriverLocationSource" NOT NULL,
  "validationStatus" "DriverLocationValidationStatus" NOT NULL,
  "clientCapturedAt" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverLocationEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DriverLocationEvidence_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "DriverLocationEvidence_coordinate_bounds" CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180),
  CONSTRAINT "DriverLocationEvidence_accuracy_bounds" CHECK ("accuracyMeters" IS NULL OR "accuracyMeters" >= 0),
  CONSTRAINT "DriverLocationEvidence_heading_bounds" CHECK ("headingDegrees" IS NULL OR "headingDegrees" BETWEEN 0 AND 360),
  CONSTRAINT "DriverLocationEvidence_speed_bounds" CHECK ("speedMetersPerSecond" IS NULL OR "speedMetersPerSecond" >= 0)
);

CREATE TABLE "DeliveryProofEvidence" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "storageReference" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "privateVisibility" BOOLEAN NOT NULL DEFAULT true,
  "status" "DeliveryProofEvidenceStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  "validatedAt" TIMESTAMP(3),
  "usedAt" TIMESTAMP(3),
  "usedByOperationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryProofEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryProofEvidence_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "DeliveryProofEvidence_storageReference_key" UNIQUE ("storageReference"),
  CONSTRAINT "DeliveryProofEvidence_size_bounds" CHECK ("byteSize" > 0 AND "byteSize" <= 10485760),
  CONSTRAINT "DeliveryProofEvidence_content_type" CHECK ("contentType" IN ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'))
);

CREATE INDEX "DriverLocationEvidence_assignment_received_idx" ON "DriverLocationEvidence"("assignmentId", "receivedAt");
CREATE INDEX "DriverLocationEvidence_order_received_idx" ON "DriverLocationEvidence"("orderId", "receivedAt");
CREATE INDEX "DriverLocationEvidence_driver_received_idx" ON "DriverLocationEvidence"("driverProfileId", "receivedAt");
CREATE INDEX "DeliveryProofEvidence_order_status_idx" ON "DeliveryProofEvidence"("orderId", "status");
CREATE INDEX "DeliveryProofEvidence_assignment_status_idx" ON "DeliveryProofEvidence"("assignmentId", "status");
CREATE INDEX "DeliveryProofEvidence_driver_status_idx" ON "DeliveryProofEvidence"("driverProfileId", "status");

ALTER TABLE "DriverLocationEvidence" ADD CONSTRAINT "DriverLocationEvidence_order_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverLocationEvidence" ADD CONSTRAINT "DriverLocationEvidence_assignment_fkey" FOREIGN KEY ("assignmentId") REFERENCES "OrderAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverLocationEvidence" ADD CONSTRAINT "DriverLocationEvidence_driver_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DeliveryProofEvidence" ADD CONSTRAINT "DeliveryProofEvidence_order_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryProofEvidence" ADD CONSTRAINT "DeliveryProofEvidence_assignment_fkey" FOREIGN KEY ("assignmentId") REFERENCES "OrderAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryProofEvidence" ADD CONSTRAINT "DeliveryProofEvidence_driver_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Durable Phase 3 dispatch-candidate evaluation evidence. These records are
-- operational snapshots, not a new dispatch aggregate; assignment remains the
-- canonical decision authority.
CREATE TABLE "DispatchCandidateEvaluation" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "courierOrderId" TEXT NOT NULL,
  "marketplaceStoreOrderId" TEXT,
  "deliveryBridgeReference" TEXT,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "pickupRegion" TEXT,
  "deliveryRegionId" TEXT,
  "requiredCapabilities" JSONB NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DispatchCandidateEvaluation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DispatchCandidateEvaluation_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "DispatchCandidateEvaluation_operationId_key" UNIQUE ("operationId")
);

ALTER TABLE "OrderAssignment" ADD COLUMN "dispatchCandidateEvaluationId" TEXT;

CREATE TABLE "DispatchCandidateEvidence" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "eligible" BOOLEAN NOT NULL,
  "reasonCodes" JSONB NOT NULL,
  "deterministicRank" INTEGER NOT NULL,
  "distanceEvidenceType" TEXT NOT NULL,
  "distanceMeters" DECIMAL(12,2),
  "workloadEvidence" JSONB NOT NULL,
  "availabilityEvidence" JSONB NOT NULL,
  "regionMatch" BOOLEAN NOT NULL,
  "restrictionEvidence" JSONB NOT NULL,
  "dataFreshnessAt" TIMESTAMP(3) NOT NULL,
  "disposition" TEXT NOT NULL DEFAULT 'PENDING',
  "dispositionAt" TIMESTAMP(3),
  "selectedAssignmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DispatchCandidateEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DispatchCandidateEvidence_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "DispatchCandidateEvidence_evaluation_driver_key" UNIQUE ("evaluationId", "driverProfileId"),
  CONSTRAINT "DispatchCandidateEvidence_selected_assignment_key" UNIQUE ("selectedAssignmentId"),
  CONSTRAINT "DispatchCandidateEvidence_rank_positive" CHECK ("deterministicRank" > 0),
  CONSTRAINT "DispatchCandidateEvidence_distance_evidence" CHECK ("distanceEvidenceType" IN ('ROAD_PROVIDER', 'GEOMETRIC_HAVERSINE', 'UNAVAILABLE')),
  CONSTRAINT "DispatchCandidateEvidence_distance_value" CHECK (("distanceEvidenceType" = 'UNAVAILABLE' AND "distanceMeters" IS NULL) OR ("distanceEvidenceType" <> 'UNAVAILABLE' AND "distanceMeters" >= 0)),
  CONSTRAINT "DispatchCandidateEvidence_disposition" CHECK ("disposition" IN ('PENDING', 'SELECTED', 'REJECTED', 'EXPIRED', 'SUPERSEDED'))
);

CREATE INDEX "DispatchCandidateEvaluation_order_evaluated_idx" ON "DispatchCandidateEvaluation"("courierOrderId", "evaluatedAt");
CREATE INDEX "DispatchCandidateEvaluation_store_evaluated_idx" ON "DispatchCandidateEvaluation"("marketplaceStoreOrderId", "evaluatedAt");
CREATE INDEX "DispatchCandidateEvidence_driver_created_idx" ON "DispatchCandidateEvidence"("driverProfileId", "createdAt");
CREATE INDEX "DispatchCandidateEvidence_evaluation_rank_idx" ON "DispatchCandidateEvidence"("evaluationId", "deterministicRank");
CREATE INDEX "DispatchCandidateEvidence_disposition_created_idx" ON "DispatchCandidateEvidence"("disposition", "createdAt");
CREATE INDEX "OrderAssignment_dispatchCandidateEvaluation_idx" ON "OrderAssignment"("dispatchCandidateEvaluationId");

ALTER TABLE "DispatchCandidateEvaluation" ADD CONSTRAINT "DispatchCandidateEvaluation_order_fkey" FOREIGN KEY ("courierOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DispatchCandidateEvaluation" ADD CONSTRAINT "DispatchCandidateEvaluation_store_fkey" FOREIGN KEY ("marketplaceStoreOrderId") REFERENCES "MarketplaceStoreOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderAssignment" ADD CONSTRAINT "OrderAssignment_dispatchCandidateEvaluation_fkey" FOREIGN KEY ("dispatchCandidateEvaluationId") REFERENCES "DispatchCandidateEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DispatchCandidateEvidence" ADD CONSTRAINT "DispatchCandidateEvidence_evaluation_fkey" FOREIGN KEY ("evaluationId") REFERENCES "DispatchCandidateEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DispatchCandidateEvidence" ADD CONSTRAINT "DispatchCandidateEvidence_driver_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DispatchCandidateEvidence" ADD CONSTRAINT "DispatchCandidateEvidence_assignment_fkey" FOREIGN KEY ("selectedAssignmentId") REFERENCES "OrderAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
