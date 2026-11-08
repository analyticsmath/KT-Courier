-- Additive: legacy ACTIVE stores keep their state until separately reviewed.
-- A new PENDING → ACTIVE transition must have independently reviewed evidence.
CREATE TABLE "StoreCheckoutCertification" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "pickupAddressId" TEXT NOT NULL,
  "pickupFingerprint" TEXT NOT NULL,
  "coverageRegionId" TEXT NOT NULL,
  "serviceSignature" TEXT NOT NULL,
  "routeEvidenceReference" TEXT NOT NULL,
  "checkoutEvidenceReference" TEXT NOT NULL,
  "preparedByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "reviewNote" TEXT,
  "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "StoreCheckoutCertification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreCheckoutCertification_status_check"
    CHECK ("status" IN ('PENDING_REVIEW','APPROVED','REVOKED'))
);
CREATE UNIQUE INDEX "StoreCheckoutCertification_storeId_key" ON "StoreCheckoutCertification"("storeId");
CREATE INDEX "StoreCheckoutCertification_status_expiresAt_idx" ON "StoreCheckoutCertification"("status","expiresAt");
CREATE INDEX "StoreCheckoutCertification_preparedByUserId_idx" ON "StoreCheckoutCertification"("preparedByUserId");
ALTER TABLE "StoreCheckoutCertification" ADD CONSTRAINT "StoreCheckoutCertification_storeId_fkey"
  FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
