-- Phase B: canonical company identity, versioned commercial configuration,
-- governed modules, and selling-territory separation. This migration is
-- additive and intentionally leaves existing pricing, catalogue and region
-- authorities intact.

CREATE TYPE "CompanyProfileVersionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');
CREATE TYPE "DeliveryServiceDefinitionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED', 'RETIRED');
CREATE TYPE "DeliveryServiceOperationalMode" AS ENUM ('FULL_DIGITAL', 'QUOTE_REQUEST', 'LEAD_ONLY', 'DISABLED');
CREATE TYPE "CommercialSurchargeCalculationType" AS ENUM ('FIXED', 'PERCENTAGE');
CREATE TYPE "PaymentMethodPolicyMode" AS ENUM ('DIGITAL', 'FULL_COD', 'DEPOSIT_PLUS_COD');
CREATE TYPE "StoreSellingTerritoryScope" AS ENUM ('NATIONWIDE', 'PROVINCES', 'ZONES');
CREATE TYPE "BusinessModuleKind" AS ENUM ('MARKETPLACE', 'COURIER', 'HYBRID');

CREATE TABLE "CompanyProfileVersion" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" "CompanyProfileVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "legalName" TEXT NOT NULL,
  "tradingName" TEXT,
  "registrationNumber" TEXT,
  "vatNumber" TEXT,
  "physicalAddress" JSONB,
  "supportEmail" TEXT,
  "businessEmail" TEXT,
  "telephoneNumbers" JSONB,
  "website" TEXT,
  "publicMetadata" JSONB,
  "documentIdentityMetadata" JSONB,
  "effectiveAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "activatedByUserId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyProfileVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyIssuerSnapshot" (
  "id" TEXT NOT NULL,
  "companyProfileVersionId" TEXT NOT NULL,
  "documentType" TEXT NOT NULL,
  "documentReference" TEXT NOT NULL,
  "issuerSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyIssuerSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BusinessModule" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "kind" "BusinessModuleKind" NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "publicEnabled" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "commercialPolicy" JSONB,
  "storeOnboardingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeliveryServiceDefinition" (
  "id" TEXT NOT NULL,
  "stableKey" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" "DeliveryServiceDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
  "operationalMode" "DeliveryServiceOperationalMode" NOT NULL DEFAULT 'FULL_DIGITAL',
  "slaMetadata" JSONB,
  "pricingPolicy" JSONB,
  "coveragePolicy" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DeliveryServiceDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DeliveryServiceDefinition_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "ParcelProfileVersion" (
  "id" TEXT NOT NULL,
  "stableKey" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "displayName" TEXT NOT NULL,
  "lengthCm" DECIMAL(12,3),
  "widthCm" DECIMAL(12,3),
  "heightCm" DECIMAL(12,3),
  "maximumWeightKg" DECIMAL(12,3),
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ParcelProfileVersion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ParcelProfileVersion_non_negative_check" CHECK (("lengthCm" IS NULL OR "lengthCm" >= 0) AND ("widthCm" IS NULL OR "widthCm" >= 0) AND ("heightCm" IS NULL OR "heightCm" >= 0) AND ("maximumWeightKg" IS NULL OR "maximumWeightKg" >= 0)),
  CONSTRAINT "ParcelProfileVersion_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "CommercialSurcharge" (
  "id" TEXT NOT NULL,
  "stableKey" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "calculationType" "CommercialSurchargeCalculationType" NOT NULL,
  "value" DECIMAL(18,4) NOT NULL,
  "reason" TEXT NOT NULL,
  "customerMessage" TEXT,
  "serviceScope" JSONB,
  "moduleScope" JSONB,
  "regionScope" JSONB,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercialSurcharge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommercialSurcharge_non_negative_value_check" CHECK ("value" >= 0),
  CONSTRAINT "CommercialSurcharge_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "PaymentMethodPolicy" (
  "id" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "mode" "PaymentMethodPolicyMode" NOT NULL,
  "businessModuleId" TEXT,
  "storeId" TEXT,
  "deliveryServiceId" TEXT,
  "orderType" TEXT,
  "depositAmount" DECIMAL(18,2),
  "depositPercent" DECIMAL(8,4),
  "policyEvidence" JSONB,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentMethodPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentMethodPolicy_deposit_non_negative_check" CHECK (("depositAmount" IS NULL OR "depositAmount" >= 0) AND ("depositPercent" IS NULL OR ("depositPercent" >= 0 AND "depositPercent" <= 1))),
  CONSTRAINT "PaymentMethodPolicy_effective_range_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom")
);

CREATE TABLE "StoreSellingTerritory" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "scope" "StoreSellingTerritoryScope" NOT NULL DEFAULT 'NATIONWIDE',
  "provinces" JSONB,
  "zoneIds" JSONB,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreSellingTerritory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CatalogCategory" ADD COLUMN "businessModuleId" TEXT;

CREATE UNIQUE INDEX "CompanyProfileVersion_publicReference_key" ON "CompanyProfileVersion"("publicReference");
CREATE UNIQUE INDEX "CompanyProfileVersion_versionNumber_key" ON "CompanyProfileVersion"("versionNumber");
CREATE INDEX "CompanyProfileVersion_status_effectiveAt_idx" ON "CompanyProfileVersion"("status", "effectiveAt");
CREATE UNIQUE INDEX "CompanyIssuerSnapshot_documentType_documentReference_key" ON "CompanyIssuerSnapshot"("documentType", "documentReference");
CREATE INDEX "CompanyIssuerSnapshot_companyProfileVersionId_createdAt_idx" ON "CompanyIssuerSnapshot"("companyProfileVersionId", "createdAt");
CREATE UNIQUE INDEX "BusinessModule_code_key" ON "BusinessModule"("code");
CREATE INDEX "BusinessModule_enabled_publicEnabled_archivedAt_sortOrder_idx" ON "BusinessModule"("enabled", "publicEnabled", "archivedAt", "sortOrder");
CREATE UNIQUE INDEX "DeliveryServiceDefinition_stableKey_versionNumber_key" ON "DeliveryServiceDefinition"("stableKey", "versionNumber");
CREATE INDEX "DeliveryServiceDefinition_stableKey_status_effectiveFrom_effectiveTo_idx" ON "DeliveryServiceDefinition"("stableKey", "status", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "ParcelProfileVersion_stableKey_versionNumber_key" ON "ParcelProfileVersion"("stableKey", "versionNumber");
CREATE INDEX "ParcelProfileVersion_stableKey_status_effectiveFrom_effectiveTo_idx" ON "ParcelProfileVersion"("stableKey", "status", "effectiveFrom", "effectiveTo");
CREATE UNIQUE INDEX "CommercialSurcharge_stableKey_versionNumber_key" ON "CommercialSurcharge"("stableKey", "versionNumber");
CREATE INDEX "CommercialSurcharge_enabled_effectiveFrom_effectiveTo_priority_idx" ON "CommercialSurcharge"("enabled", "effectiveFrom", "effectiveTo", "priority");
CREATE INDEX "PaymentMethodPolicy_status_effectiveFrom_effectiveTo_idx" ON "PaymentMethodPolicy"("status", "effectiveFrom", "effectiveTo");
CREATE INDEX "PaymentMethodPolicy_businessModuleId_storeId_deliveryServiceId_idx" ON "PaymentMethodPolicy"("businessModuleId", "storeId", "deliveryServiceId");
CREATE UNIQUE INDEX "StoreSellingTerritory_storeId_key" ON "StoreSellingTerritory"("storeId");
CREATE INDEX "CatalogCategory_businessModuleId_status_displayOrder_idx" ON "CatalogCategory"("businessModuleId", "status", "displayOrder");

ALTER TABLE "CompanyIssuerSnapshot" ADD CONSTRAINT "CompanyIssuerSnapshot_companyProfileVersionId_fkey" FOREIGN KEY ("companyProfileVersionId") REFERENCES "CompanyProfileVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreSellingTerritory" ADD CONSTRAINT "StoreSellingTerritory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogCategory" ADD CONSTRAINT "CatalogCategory_businessModuleId_fkey" FOREIGN KEY ("businessModuleId") REFERENCES "BusinessModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- At most one active company issuer can exist at a time. Historical versions
-- remain immutable and may still be referenced by issuer snapshots.
CREATE UNIQUE INDEX "CompanyProfileVersion_single_active" ON "CompanyProfileVersion" ((1)) WHERE "status" = 'ACTIVE';
