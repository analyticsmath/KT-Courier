-- KT Couriers Phase 2.4: Driver Operations Foundation Migration
-- Create enums if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriverStatus') THEN
    CREATE TYPE "DriverStatus" AS ENUM ('PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriverAvailability') THEN
    CREATE TYPE "DriverAvailability" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'ON_DELIVERY', 'OFFLINE');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriverOnboardingStatus') THEN
    CREATE TYPE "DriverOnboardingStatus" AS ENUM ('INVITED', 'PROFILE_INCOMPLETE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VehicleType') THEN
    CREATE TYPE "VehicleType" AS ENUM ('MOTORBIKE', 'CAR', 'VAN', 'TRUCK', 'BICYCLE', 'WALKER', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentType') THEN
    CREATE TYPE "DocumentType" AS ENUM ('LICENSE', 'ID_DOCUMENT', 'VEHICLE_REGISTRATION', 'PROOF_OF_ADDRESS', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentStatus') THEN
    CREATE TYPE "DocumentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED');
  END IF;
END $$;

-- Alter existing DriverProfile table safely
ALTER TABLE IF EXISTS "DriverProfile"
  ADD COLUMN IF NOT EXISTS "driverCode" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "status" "DriverStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN IF NOT EXISTS "availability" "DriverAvailability" NOT NULL DEFAULT 'OFFLINE',
  ADD COLUMN IF NOT EXISTS "onboardingStatus" "DriverOnboardingStatus" NOT NULL DEFAULT 'PROFILE_INCOMPLETE',
  ADD COLUMN IF NOT EXISTS "vehicleType" "VehicleType",
  ADD COLUMN IF NOT EXISTS "vehicleMake" TEXT,
  ADD COLUMN IF NOT EXISTS "vehicleModel" TEXT,
  ADD COLUMN IF NOT EXISTS "vehicleColor" TEXT,
  ADD COLUMN IF NOT EXISTS "vehicleRegistration" TEXT,
  ADD COLUMN IF NOT EXISTS "licenseNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "licenseExpiryDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "serviceNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "internalNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "suspensionReason" TEXT;

-- Create tables
CREATE TABLE IF NOT EXISTS "DriverServiceRegion" (
  "id" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "deliveryRegionId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriverServiceRegion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DriverDocument" (
  "id" TEXT NOT NULL,
  "driverProfileId" TEXT NOT NULL,
  "documentType" "DocumentType" NOT NULL,
  "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
  "fileUrl" TEXT,
  "fileName" TEXT,
  "expiresAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "reviewedByAdminId" TEXT,
  "rejectionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DriverDocument_pkey" PRIMARY KEY ("id")
);

-- Populate existing rows with a default driverCode if there are any that are null
UPDATE "DriverProfile" SET "driverCode" = 'DRV-' || SUBSTRING("id" FROM 1 FOR 6) WHERE "driverCode" IS NULL;

-- Enforce NOT NULL on driverCode
ALTER TABLE "DriverProfile" ALTER COLUMN "driverCode" SET NOT NULL;

-- Add constraints and indices safely
CREATE UNIQUE INDEX IF NOT EXISTS "DriverProfile_driverCode_key" ON "DriverProfile"("driverCode");
CREATE INDEX IF NOT EXISTS "DriverProfile_status_idx" ON "DriverProfile"("status");
CREATE INDEX IF NOT EXISTS "DriverProfile_availability_idx" ON "DriverProfile"("availability");
CREATE INDEX IF NOT EXISTS "DriverProfile_onboardingStatus_idx" ON "DriverProfile"("onboardingStatus");
CREATE INDEX IF NOT EXISTS "DriverProfile_driverCode_idx" ON "DriverProfile"("driverCode");

CREATE UNIQUE INDEX IF NOT EXISTS "DriverServiceRegion_driverProfileId_deliveryRegionId_key" ON "DriverServiceRegion"("driverProfileId", "deliveryRegionId");
CREATE INDEX IF NOT EXISTS "DriverServiceRegion_driverProfileId_idx" ON "DriverServiceRegion"("driverProfileId");
CREATE INDEX IF NOT EXISTS "DriverServiceRegion_deliveryRegionId_idx" ON "DriverServiceRegion"("deliveryRegionId");

CREATE INDEX IF NOT EXISTS "DriverDocument_driverProfileId_idx" ON "DriverDocument"("driverProfileId");
CREATE INDEX IF NOT EXISTS "DriverDocument_documentType_idx" ON "DriverDocument"("documentType");
CREATE INDEX IF NOT EXISTS "DriverDocument_status_idx" ON "DriverDocument"("status");

-- Add foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverServiceRegion_driverProfileId_fkey') THEN
    ALTER TABLE "DriverServiceRegion" ADD CONSTRAINT "DriverServiceRegion_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverServiceRegion_deliveryRegionId_fkey') THEN
    ALTER TABLE "DriverServiceRegion" ADD CONSTRAINT "DriverServiceRegion_deliveryRegionId_fkey" FOREIGN KEY ("deliveryRegionId") REFERENCES "DeliveryRegion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DriverDocument_driverProfileId_fkey') THEN
    ALTER TABLE "DriverDocument" ADD CONSTRAINT "DriverDocument_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "DriverProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
