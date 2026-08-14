-- Versioned package/insurance controls and append-only operational evidence.
-- Client insurance limits, high-risk classifications and legal liability prose
-- are deliberately configuration data, not migration constants.

CREATE TABLE "ShippingPackagePolicyVersion" (
  "id" TEXT NOT NULL,
  "stableKey" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "prohibitedClassifications" JSONB,
  "fragileHandlingRequired" BOOLEAN NOT NULL DEFAULT false,
  "highValueDeclarationRequired" BOOLEAN NOT NULL DEFAULT false,
  "declaredValueMinimum" DECIMAL(18,2),
  "declaredValueMaximum" DECIMAL(18,2),
  "insuranceMode" TEXT NOT NULL DEFAULT 'CLIENT_VALUE_REQUIRED',
  "insuranceCoverageLimit" DECIMAL(18,2),
  "packagingRequirements" JSONB,
  "acceptanceRequired" BOOLEAN NOT NULL DEFAULT true,
  "claimsEvidenceRequired" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShippingPackagePolicyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShippingPackagePolicyVersion_stableKey_versionNumber_key" ON "ShippingPackagePolicyVersion"("stableKey", "versionNumber");
CREATE INDEX "ShippingPackagePolicyVersion_stableKey_status_effectiveFrom_effectiveTo_idx" ON "ShippingPackagePolicyVersion"("stableKey", "status", "effectiveFrom", "effectiveTo");

CREATE TABLE "ShipmentPackagePolicyDeclaration" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "policyVersionId" TEXT NOT NULL,
  "declaredValue" DECIMAL(18,2),
  "currency" TEXT,
  "classification" TEXT,
  "fragile" BOOLEAN NOT NULL DEFAULT false,
  "highValue" BOOLEAN NOT NULL DEFAULT false,
  "packagingConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "insuranceRequested" BOOLEAN NOT NULL DEFAULT false,
  "acceptedByUserId" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "policySnapshot" JSONB NOT NULL,
  "operationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentPackagePolicyDeclaration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShipmentPackagePolicyDeclaration_publicReference_key" ON "ShipmentPackagePolicyDeclaration"("publicReference");
CREATE UNIQUE INDEX "ShipmentPackagePolicyDeclaration_orderId_key" ON "ShipmentPackagePolicyDeclaration"("orderId");
CREATE UNIQUE INDEX "ShipmentPackagePolicyDeclaration_operationId_key" ON "ShipmentPackagePolicyDeclaration"("operationId");
CREATE INDEX "ShipmentPackagePolicyDeclaration_policyVersionId_createdAt_idx" ON "ShipmentPackagePolicyDeclaration"("policyVersionId", "createdAt");

CREATE TABLE "ShipmentPreparationObligation" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "preparationDueAt" TIMESTAMP(3),
  "packagingConfirmedAt" TIMESTAMP(3),
  "lawfulListingConfirmedAt" TIMESTAMP(3),
  "handoffReadyAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShipmentPreparationObligation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShipmentPreparationObligation_publicReference_key" ON "ShipmentPreparationObligation"("publicReference");
CREATE UNIQUE INDEX "ShipmentPreparationObligation_orderId_key" ON "ShipmentPreparationObligation"("orderId");
CREATE INDEX "ShipmentPreparationObligation_status_preparationDueAt_idx" ON "ShipmentPreparationObligation"("status", "preparationDueAt");

CREATE TABLE "ShipmentPreparationEvent" (
  "id" TEXT NOT NULL,
  "obligationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "safeNote" TEXT,
  "operationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShipmentPreparationEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShipmentPreparationEvent_operationId_key" ON "ShipmentPreparationEvent"("operationId");
CREATE INDEX "ShipmentPreparationEvent_obligationId_createdAt_idx" ON "ShipmentPreparationEvent"("obligationId", "createdAt");

CREATE TABLE "DriverDeliveryResponsibilityReport" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "reportType" TEXT NOT NULL,
  "safeNote" TEXT,
  "evidenceReference" TEXT,
  "requiresReview" BOOLEAN NOT NULL DEFAULT false,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "operationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverDeliveryResponsibilityReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DriverDeliveryResponsibilityReport_publicReference_key" ON "DriverDeliveryResponsibilityReport"("publicReference");
CREATE UNIQUE INDEX "DriverDeliveryResponsibilityReport_operationId_key" ON "DriverDeliveryResponsibilityReport"("operationId");
CREATE INDEX "DriverDeliveryResponsibilityReport_assignmentId_reportType_createdAt_idx" ON "DriverDeliveryResponsibilityReport"("assignmentId", "reportType", "createdAt");
CREATE INDEX "DriverDeliveryResponsibilityReport_orderId_requiresReview_idx" ON "DriverDeliveryResponsibilityReport"("orderId", "requiresReview");

ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'VENDOR_PACKAGING_CONFIRMED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'VENDOR_LAWFUL_LISTING_CONFIRMED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'VENDOR_HANDOFF_READY';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'DRIVER_SAFETY_CONFIRMED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'DRIVER_LAWFUL_TRANSPORT_CONFIRMED';
ALTER TYPE "OrderOperationalEventType" ADD VALUE IF NOT EXISTS 'DRIVER_SUSPICIOUS_PACKAGE_REPORTED';

ALTER TABLE "ShipmentPackagePolicyDeclaration" ADD CONSTRAINT "ShipmentPackagePolicyDeclaration_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentPackagePolicyDeclaration" ADD CONSTRAINT "ShipmentPackagePolicyDeclaration_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "ShippingPackagePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentPreparationObligation" ADD CONSTRAINT "ShipmentPreparationObligation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShipmentPreparationEvent" ADD CONSTRAINT "ShipmentPreparationEvent_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "ShipmentPreparationObligation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DriverDeliveryResponsibilityReport" ADD CONSTRAINT "DriverDeliveryResponsibilityReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
