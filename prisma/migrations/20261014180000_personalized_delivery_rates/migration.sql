CREATE TABLE "PersonalizedDeliveryRate" (
 "id" TEXT NOT NULL,
 "ownerType" "PricingQuoteOwnerType" NOT NULL,
 "ownerId" TEXT NOT NULL,
 "serviceKey" TEXT NOT NULL,
 "parcelSize" TEXT NOT NULL,
 "versionNumber" INTEGER NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'DRAFT',
 "baseFee" DECIMAL(12,2) NOT NULL,
 "perKmRate" DECIMAL(12,4) NOT NULL,
 "minimumCharge" DECIMAL(12,2),
 "effectiveFrom" TIMESTAMP(3) NOT NULL,
 "effectiveTo" TIMESTAMP(3),
 "reason" TEXT NOT NULL,
 "createdByUserId" TEXT NOT NULL,
 "activatedByUserId" TEXT,
 "activatedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "PersonalizedDeliveryRate_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "PersonalizedDeliveryRate_positive_total_check" CHECK ("baseFee" >= 0 AND "perKmRate" >= 0 AND ("baseFee" > 0 OR "perKmRate" > 0)),
 CONSTRAINT "PersonalizedDeliveryRate_window_check" CHECK ("effectiveTo" IS NULL OR "effectiveTo" > "effectiveFrom"),
 CONSTRAINT "PersonalizedDeliveryRate_status_check" CHECK ("status" IN ('DRAFT','ACTIVE','INACTIVE'))
);
CREATE UNIQUE INDEX "PersonalizedDeliveryRate_owner_scope_version_key" ON "PersonalizedDeliveryRate"("ownerType","ownerId","serviceKey","parcelSize","versionNumber");
CREATE INDEX "PersonalizedDeliveryRate_current_scope_idx" ON "PersonalizedDeliveryRate"("ownerType","ownerId","serviceKey","parcelSize","status","effectiveFrom");
