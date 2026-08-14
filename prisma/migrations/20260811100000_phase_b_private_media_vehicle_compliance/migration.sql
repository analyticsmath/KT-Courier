-- Phase B: private evidence and independently approved vehicles.
-- This migration is additive. Legacy DriverProfile vehicle columns remain until
-- Phase D data retirement so existing demo records remain valid.

CREATE TYPE "PrivateMediaStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'QUARANTINED', 'RETAINED', 'DELETE_REQUESTED', 'DELETED');
CREATE TYPE "PrivateMediaOwnerType" AS ENUM ('DRIVER', 'VEHICLE', 'CLAIM', 'PROOF_OF_DELIVERY', 'STORE', 'APPLICANT');
CREATE TYPE "PrivateMediaPurpose" AS ENUM ('DRIVER_IDENTITY_DOCUMENT', 'DRIVER_LICENCE', 'DRIVER_PROFILE_PHOTO', 'VEHICLE_REGISTRATION', 'VEHICLE_LICENCE_DISC', 'VEHICLE_INSURANCE', 'VEHICLE_COMPLIANCE_IMAGE', 'CLAIM_EVIDENCE', 'POD_EVIDENCE', 'STORE_VERIFICATION_DOCUMENT', 'OTHER');
CREATE TYPE "VehicleComplianceStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "VehicleDocumentType" AS ENUM ('REGISTRATION', 'LICENCE_DISC', 'INSURANCE', 'ROADWORTHINESS', 'OTHER');
CREATE TYPE "VehicleMediaPurpose" AS ENUM ('FRONT', 'REAR', 'SIDE', 'INTERIOR', 'OTHER');

ALTER TABLE "DriverDocument" ADD COLUMN "privateMediaObjectId" TEXT;
-- Existing demo profiles are retained without fabricating KYC evidence. New
-- driver profiles are opted into strict vehicle compliance by the service.
ALTER TABLE "DriverProfile" ADD COLUMN "vehicleComplianceRequiredAt" TIMESTAMP(3);

CREATE TABLE "PrivateMediaObject" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "ownerType" "PrivateMediaOwnerType" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "purpose" "PrivateMediaPurpose" NOT NULL,
  "status" "PrivateMediaStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  "storageProvider" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "declaredMimeType" TEXT NOT NULL,
  "detectedMimeType" TEXT,
  "byteSize" INTEGER,
  "checksum" TEXT,
  "retentionUntil" TIMESTAMP(3),
  "deleteRequestedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "metadata" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PrivateMediaObject_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PrivateMediaObject_deleted_status_check" CHECK (("deletedAt" IS NULL) OR ("status" = 'DELETED')),
  CONSTRAINT "PrivateMediaObject_ready_evidence_check" CHECK (("status" <> 'READY') OR ("detectedMimeType" IS NOT NULL AND "byteSize" IS NOT NULL AND "checksum" IS NOT NULL))
);

CREATE TABLE "PrivateMediaAccessLog" (
  "id" TEXT NOT NULL,
  "privateMediaObjectId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "requestReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrivateMediaAccessLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vehicle" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "year" INTEGER,
  "colour" TEXT,
  "registrationNumber" TEXT NOT NULL,
  "vehicleType" "VehicleType" NOT NULL,
  "capacityKg" DECIMAL(12,3),
  "status" "VehicleComplianceStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "approvedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectedByUserId" TEXT,
  "rejectionReason" TEXT,
  "suspendedAt" TIMESTAMP(3),
  "suspendedByUserId" TEXT,
  "suspensionReason" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Vehicle_year_check" CHECK (("year" IS NULL) OR ("year" BETWEEN 1886 AND 2100)),
  CONSTRAINT "Vehicle_approved_evidence_check" CHECK (("status" <> 'APPROVED') OR ("approvedAt" IS NOT NULL AND "approvedByUserId" IS NOT NULL))
);

CREATE TABLE "VehicleDocument" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "documentType" "VehicleDocumentType" NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
  "privateMediaObjectId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByUserId" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleMedia" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "purpose" "VehicleMediaPurpose" NOT NULL,
  "privateMediaObjectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleMedia_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriverDocument_privateMediaObjectId_key" ON "DriverDocument"("privateMediaObjectId");
CREATE UNIQUE INDEX "PrivateMediaObject_publicReference_key" ON "PrivateMediaObject"("publicReference");
CREATE UNIQUE INDEX "PrivateMediaObject_storageKey_key" ON "PrivateMediaObject"("storageKey");
CREATE INDEX "PrivateMediaObject_ownerType_ownerId_status_idx" ON "PrivateMediaObject"("ownerType", "ownerId", "status");
CREATE INDEX "PrivateMediaObject_status_retentionUntil_idx" ON "PrivateMediaObject"("status", "retentionUntil");
CREATE INDEX "PrivateMediaObject_purpose_status_idx" ON "PrivateMediaObject"("purpose", "status");
CREATE INDEX "PrivateMediaAccessLog_privateMediaObjectId_createdAt_idx" ON "PrivateMediaAccessLog"("privateMediaObjectId", "createdAt");
CREATE INDEX "PrivateMediaAccessLog_actorUserId_createdAt_idx" ON "PrivateMediaAccessLog"("actorUserId", "createdAt");
CREATE UNIQUE INDEX "Vehicle_publicReference_key" ON "Vehicle"("publicReference");
CREATE INDEX "Vehicle_driverProfileId_status_idx" ON "Vehicle"("driverProfileId", "status");
CREATE INDEX "Vehicle_registrationNumber_idx" ON "Vehicle"("registrationNumber");
CREATE INDEX "Vehicle_status_vehicleType_idx" ON "Vehicle"("status", "vehicleType");
CREATE UNIQUE INDEX "Vehicle_active_registration_unique" ON "Vehicle"("registrationNumber") WHERE "archivedAt" IS NULL;
CREATE UNIQUE INDEX "VehicleDocument_privateMediaObjectId_key" ON "VehicleDocument"("privateMediaObjectId");
CREATE INDEX "VehicleDocument_vehicleId_documentType_status_idx" ON "VehicleDocument"("vehicleId", "documentType", "status");
CREATE INDEX "VehicleDocument_status_expiresAt_idx" ON "VehicleDocument"("status", "expiresAt");
CREATE UNIQUE INDEX "VehicleMedia_privateMediaObjectId_key" ON "VehicleMedia"("privateMediaObjectId");
CREATE UNIQUE INDEX "VehicleMedia_vehicleId_purpose_key" ON "VehicleMedia"("vehicleId", "purpose");
CREATE INDEX "VehicleMedia_vehicleId_idx" ON "VehicleMedia"("vehicleId");

ALTER TABLE "DriverDocument" ADD CONSTRAINT "DriverDocument_privateMediaObjectId_fkey" FOREIGN KEY ("privateMediaObjectId") REFERENCES "PrivateMediaObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PrivateMediaAccessLog" ADD CONSTRAINT "PrivateMediaAccessLog_privateMediaObjectId_fkey" FOREIGN KEY ("privateMediaObjectId") REFERENCES "PrivateMediaObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_privateMediaObjectId_fkey" FOREIGN KEY ("privateMediaObjectId") REFERENCES "PrivateMediaObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleMedia" ADD CONSTRAINT "VehicleMedia_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleMedia" ADD CONSTRAINT "VehicleMedia_privateMediaObjectId_fkey" FOREIGN KEY ("privateMediaObjectId") REFERENCES "PrivateMediaObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Do not allow a private object belonging to a different vehicle to be linked as
-- compliance evidence. Polymorphic owners are deliberately kept explicit here.
CREATE OR REPLACE FUNCTION "phase_b_validate_vehicle_private_media_owner"() RETURNS TRIGGER AS $$
DECLARE owner_type "PrivateMediaOwnerType"; owner_id TEXT;
BEGIN
  SELECT "ownerType", "ownerId" INTO owner_type, owner_id FROM "PrivateMediaObject" WHERE "id" = NEW."privateMediaObjectId";
  IF owner_type <> 'VEHICLE' OR owner_id <> NEW."vehicleId" THEN
    RAISE EXCEPTION 'private media object must belong to the linked vehicle' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "VehicleDocument_private_media_owner_trigger" BEFORE INSERT OR UPDATE OF "vehicleId", "privateMediaObjectId" ON "VehicleDocument" FOR EACH ROW EXECUTE FUNCTION "phase_b_validate_vehicle_private_media_owner"();
CREATE TRIGGER "VehicleMedia_private_media_owner_trigger" BEFORE INSERT OR UPDATE OF "vehicleId", "privateMediaObjectId" ON "VehicleMedia" FOR EACH ROW EXECUTE FUNCTION "phase_b_validate_vehicle_private_media_owner"();
