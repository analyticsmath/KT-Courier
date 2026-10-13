-- Additive: existing operator zones retain their radius-based behavior.
CREATE TYPE "DeliveryRegionCoverageMode" AS ENUM ('RADIUS', 'PROVINCE');
ALTER TABLE "DeliveryRegion" ADD COLUMN "coverageMode" "DeliveryRegionCoverageMode" NOT NULL DEFAULT 'RADIUS';
