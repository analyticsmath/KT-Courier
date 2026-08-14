CREATE TYPE "ManagedMarketingPlacementKind" AS ENUM ('ON_PLATFORM', 'MANUAL_EXTERNAL');

CREATE TABLE "ManagedMarketingChannelPlacement" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "channelDefinitionId" TEXT NOT NULL,
  "kind" "ManagedMarketingPlacementKind" NOT NULL,
  "advertisingPlacementDefinitionId" TEXT,
  "externalPlacementReference" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManagedMarketingChannelPlacement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManagedMarketingChannelPlacement_kind_target" CHECK (("kind" = 'ON_PLATFORM' AND "advertisingPlacementDefinitionId" IS NOT NULL AND "externalPlacementReference" IS NULL) OR ("kind" = 'MANUAL_EXTERNAL' AND "advertisingPlacementDefinitionId" IS NULL AND "externalPlacementReference" IS NOT NULL))
);

CREATE UNIQUE INDEX "ManagedMarketingChannelPlacement_publicReference_key" ON "ManagedMarketingChannelPlacement"("publicReference");
CREATE UNIQUE INDEX "ManagedMarketingChannelPlacement_code_key" ON "ManagedMarketingChannelPlacement"("code");
CREATE UNIQUE INDEX "ManagedMarketingChannelPlacement_channelDefinitionId_displayName_key" ON "ManagedMarketingChannelPlacement"("channelDefinitionId", "displayName");
CREATE INDEX "ManagedMarketingChannelPlacement_channelDefinitionId_active_sortOrder_idx" ON "ManagedMarketingChannelPlacement"("channelDefinitionId", "active", "sortOrder");

ALTER TABLE "ManagedMarketingChannelPlacement" ADD CONSTRAINT "ManagedMarketingChannelPlacement_channelDefinitionId_fkey" FOREIGN KEY ("channelDefinitionId") REFERENCES "ManagedMarketingChannelDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedMarketingChannelPlacement" ADD CONSTRAINT "ManagedMarketingChannelPlacement_advertisingPlacementDefinitionId_fkey" FOREIGN KEY ("advertisingPlacementDefinitionId") REFERENCES "AdvertisingPlacementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
