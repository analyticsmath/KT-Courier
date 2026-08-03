-- Phase 6: Pricing Engine v1.  This is deliberately additive; the initial
-- baseline migration remains immutable.
CREATE TYPE "PricingQuoteStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "PricingQuoteOwnerType" AS ENUM ('CUSTOMER', 'STORE');
CREATE TYPE "PricingLineItemCode" AS ENUM ('BASE_FEE', 'DISTANCE_FEE', 'RULE_SURCHARGE', 'HIGH_RISK_SURCHARGE', 'VEHICLE_SURCHARGE', 'WEIGHT_SURCHARGE', 'MINIMUM_CHARGE_ADJUSTMENT', 'VAT');

ALTER TABLE "DeliveryRegion"
  ADD COLUMN "pricingEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "highRiskSurcharge" DECIMAL(12,2);

ALTER TABLE "PricingRule"
  ADD COLUMN "baseFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "perKmRate" DECIMAL(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN "includedDistanceKm" DECIMAL(12,4) NOT NULL DEFAULT 0,
  ADD COLUMN "distanceIncrementKm" DECIMAL(12,4) NOT NULL DEFAULT 0.1,
  ADD COLUMN "minimumCharge" DECIMAL(12,2),
  ADD COLUMN "flatSurcharge" DECIMAL(12,2),
  ADD COLUMN "vehicleClass" "VehicleType",
  ADD COLUMN "vehicleSurcharge" DECIMAL(12,2),
  ADD COLUMN "includedWeightKg" DECIMAL(12,4),
  ADD COLUMN "perAdditionalKgRate" DECIMAL(12,4),
  ADD COLUMN "maximumWeightKg" DECIMAL(12,4),
  ADD COLUMN "weightIncrementKg" DECIMAL(12,4),
  ADD COLUMN "dimensionalPricingEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "volumetricDivisor" DECIMAL(12,4),
  ADD COLUMN "maxDistanceKm" DECIMAL(12,4),
  ADD COLUMN "allowGlobalFallback" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "effectiveFrom" TIMESTAMP(3),
  ADD COLUMN "effectiveTo" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "Order"
  ADD COLUMN "pricingQuoteId" TEXT,
  ADD COLUMN "pricingSnapshot" JSONB,
  ADD COLUMN "pricingSubtotal" DECIMAL(12,2),
  ADD COLUMN "pricingTaxAmount" DECIMAL(12,2),
  ADD COLUMN "pricingTaxRate" DECIMAL(12,4);

CREATE TABLE "PricingQuote" (
  "id" TEXT NOT NULL,
  "status" "PricingQuoteStatus" NOT NULL DEFAULT 'ACTIVE',
  "ownerType" "PricingQuoteOwnerType" NOT NULL,
  "ownerId" TEXT NOT NULL,
  "storeId" TEXT,
  "deliveryType" "DeliveryType" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "calculationVersion" TEXT NOT NULL,
  "inputHash" TEXT NOT NULL,
  "distanceMeters" INTEGER NOT NULL,
  "durationSeconds" INTEGER,
  "routeProvider" TEXT,
  "destinationRegionId" TEXT,
  "originRegionId" TEXT,
  "ruleId" TEXT,
  "rawDistanceKm" DECIMAL(12,4) NOT NULL,
  "billableDistanceKm" DECIMAL(12,4) NOT NULL,
  "subtotal" DECIMAL(12,2) NOT NULL,
  "taxRate" DECIMAL(12,4) NOT NULL,
  "taxAmount" DECIMAL(12,2) NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "inputSnapshot" JSONB NOT NULL,
  "ruleSnapshot" JSONB NOT NULL,
  "regionSnapshot" JSONB NOT NULL,
  "taxSnapshot" JSONB NOT NULL,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingQuote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingQuoteLineItem" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "code" "PricingLineItemCode" NOT NULL,
  "label" TEXT NOT NULL,
  "quantity" DECIMAL(12,4),
  "unitRate" DECIMAL(12,4),
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PricingQuoteLineItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_pricingQuoteId_key" ON "Order"("pricingQuoteId");
CREATE INDEX "Order_pricingQuoteId_idx" ON "Order"("pricingQuoteId");
CREATE INDEX "PricingRule_active_archivedAt_deliveryType_regionId_idx" ON "PricingRule"("active", "archivedAt", "deliveryType", "regionId");
CREATE INDEX "PricingRule_effectiveFrom_effectiveTo_idx" ON "PricingRule"("effectiveFrom", "effectiveTo");
CREATE INDEX "PricingQuote_ownerType_ownerId_status_idx" ON "PricingQuote"("ownerType", "ownerId", "status");
CREATE INDEX "PricingQuote_storeId_status_idx" ON "PricingQuote"("storeId", "status");
CREATE INDEX "PricingQuote_expiresAt_idx" ON "PricingQuote"("expiresAt");
CREATE INDEX "PricingQuote_status_idx" ON "PricingQuote"("status");
CREATE INDEX "PricingQuote_ruleId_idx" ON "PricingQuote"("ruleId");
CREATE INDEX "PricingQuoteLineItem_quoteId_idx" ON "PricingQuoteLineItem"("quoteId");
CREATE INDEX "PricingQuoteLineItem_code_idx" ON "PricingQuoteLineItem"("code");

ALTER TABLE "Order" ADD CONSTRAINT "Order_pricingQuoteId_fkey" FOREIGN KEY ("pricingQuoteId") REFERENCES "PricingQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PricingQuote" ADD CONSTRAINT "PricingQuote_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "PricingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PricingQuoteLineItem" ADD CONSTRAINT "PricingQuoteLineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "PricingQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
