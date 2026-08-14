CREATE TYPE "ManagedMarketingCreativeSource" AS ENUM ('PRIVATE_MEDIA', 'CATALOG_MEDIA');

ALTER TABLE "ManagedMarketingRequest" ADD COLUMN "requesterUserId" TEXT, ADD COLUMN "instructions" TEXT, ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "ManagedMarketingRequest" ALTER COLUMN "creativeAssetReference" DROP NOT NULL;

CREATE TABLE "ManagedMarketingRequestChannel" (
  "id" TEXT NOT NULL,
  "managedMarketingRequestId" TEXT NOT NULL,
  "channelDefinitionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagedMarketingRequestChannel_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ManagedMarketingRequestPlacement" (
  "id" TEXT NOT NULL,
  "managedMarketingRequestChannelId" TEXT NOT NULL,
  "placementId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagedMarketingRequestPlacement_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ManagedMarketingRequestCreative" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "managedMarketingRequestId" TEXT NOT NULL,
  "source" "ManagedMarketingCreativeSource" NOT NULL,
  "privateMediaObjectId" TEXT,
  "catalogMediaAssetId" TEXT,
  "role" TEXT NOT NULL DEFAULT 'CREATIVE',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManagedMarketingRequestCreative_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManagedMarketingRequestCreative_source_target" CHECK (("source" = 'PRIVATE_MEDIA' AND "privateMediaObjectId" IS NOT NULL AND "catalogMediaAssetId" IS NULL) OR ("source" = 'CATALOG_MEDIA' AND "privateMediaObjectId" IS NULL AND "catalogMediaAssetId" IS NOT NULL))
);

CREATE UNIQUE INDEX "ManagedMarketingRequestChannel_request_channel_key" ON "ManagedMarketingRequestChannel"("managedMarketingRequestId", "channelDefinitionId");
CREATE UNIQUE INDEX "ManagedMarketingRequestPlacement_channel_placement_key" ON "ManagedMarketingRequestPlacement"("managedMarketingRequestChannelId", "placementId");
CREATE UNIQUE INDEX "ManagedMarketingRequestCreative_publicReference_key" ON "ManagedMarketingRequestCreative"("publicReference");
CREATE UNIQUE INDEX "ManagedMarketingRequestCreative_request_privateMedia_key" ON "ManagedMarketingRequestCreative"("managedMarketingRequestId", "privateMediaObjectId");
CREATE UNIQUE INDEX "ManagedMarketingRequestCreative_request_catalogMedia_key" ON "ManagedMarketingRequestCreative"("managedMarketingRequestId", "catalogMediaAssetId");
CREATE INDEX "ManagedMarketingRequestCreative_request_createdAt_idx" ON "ManagedMarketingRequestCreative"("managedMarketingRequestId", "createdAt");

ALTER TABLE "ManagedMarketingRequestChannel" ADD CONSTRAINT "ManagedMarketingRequestChannel_request_fkey" FOREIGN KEY ("managedMarketingRequestId") REFERENCES "ManagedMarketingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedMarketingRequestChannel" ADD CONSTRAINT "ManagedMarketingRequestChannel_channel_fkey" FOREIGN KEY ("channelDefinitionId") REFERENCES "ManagedMarketingChannelDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedMarketingRequestPlacement" ADD CONSTRAINT "ManagedMarketingRequestPlacement_requestChannel_fkey" FOREIGN KEY ("managedMarketingRequestChannelId") REFERENCES "ManagedMarketingRequestChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedMarketingRequestPlacement" ADD CONSTRAINT "ManagedMarketingRequestPlacement_placement_fkey" FOREIGN KEY ("placementId") REFERENCES "ManagedMarketingChannelPlacement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedMarketingRequestCreative" ADD CONSTRAINT "ManagedMarketingRequestCreative_request_fkey" FOREIGN KEY ("managedMarketingRequestId") REFERENCES "ManagedMarketingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedMarketingRequestCreative" ADD CONSTRAINT "ManagedMarketingRequestCreative_privateMedia_fkey" FOREIGN KEY ("privateMediaObjectId") REFERENCES "PrivateMediaObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManagedMarketingRequestCreative" ADD CONSTRAINT "ManagedMarketingRequestCreative_catalogMedia_fkey" FOREIGN KEY ("catalogMediaAssetId") REFERENCES "CatalogMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
