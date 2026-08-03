-- Phase 19: Storefront browsing
-- Additive read-model migration. Do not activate public storefront data here.

CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE "StorefrontDocumentStatus" AS ENUM ('ACTIVE', 'WITHDRAWN', 'INVALID');
CREATE TYPE "StorefrontAvailabilityState" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'MADE_TO_ORDER', 'UNTRACKED', 'CONFIRM_AT_CHECKOUT', 'NOT_AVAILABLE_IN_AREA');
CREATE TYPE "StorefrontStorePublicStatus" AS ENUM ('ACTIVE', 'INELIGIBLE', 'SUSPENDED', 'WITHDRAWN');
CREATE TYPE "StorefrontProjectionCaseStatus" AS ENUM ('OPEN', 'OBSERVED', 'RESOLVED');
CREATE TYPE "StorefrontProjectionCaseReason" AS ENUM ('SNAPSHOT_MISSING', 'SNAPSHOT_NOT_PUBLISHED', 'SNAPSHOT_VERSION_MISMATCH', 'STORE_NOT_ELIGIBLE', 'OFFER_NOT_ELIGIBLE', 'PRICE_NOT_ELIGIBLE', 'PRICE_VERSION_MISMATCH', 'MEDIA_NOT_READY', 'MEDIA_NOT_PUBLISHED', 'CATEGORY_NOT_ELIGIBLE', 'ATTRIBUTE_SCHEMA_MISMATCH', 'SEARCH_DOCUMENT_MISMATCH', 'AVAILABILITY_PROJECTION_MISMATCH', 'PUBLICATION_WITHDRAWAL_NOT_APPLIED', 'CACHE_INVALIDATION_FAILED', 'APPLICATION_FAILURE');
CREATE TYPE "StorefrontEventProcessingStatus" AS ENUM ('PROCESSED', 'FAILED', 'SKIPPED');
CREATE TYPE "StorefrontCacheInvalidationStatus" AS ENUM ('PENDING', 'APPLIED', 'FAILED');
CREATE TYPE "StorefrontSynonymSetStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED', 'REJECTED');
CREATE TYPE "StorefrontCollectionStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED', 'REJECTED');
CREATE TYPE "StorefrontCollectionType" AS ENUM ('EDITORIAL', 'SEASONAL', 'CATEGORY_LANDING');
CREATE TYPE "StorefrontCollectionTargetType" AS ENUM ('CATEGORY', 'PRODUCT', 'VARIANT', 'STORE');
CREATE TYPE "StorefrontTelemetryEventType" AS ENUM ('SEARCH', 'ZERO_RESULTS', 'FILTER_APPLIED', 'RESULT_OPENED');

CREATE TABLE "StorefrontProductDocument" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "publicationSnapshotId" TEXT NOT NULL,
  "publicationVersion" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productPublicReference" TEXT NOT NULL,
  "productSlug" TEXT NOT NULL,
  "productScope" "CatalogProductScope" NOT NULL,
  "variantId" TEXT NOT NULL,
  "variantPublicReference" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "offerPublicReference" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "storePublicReference" TEXT NOT NULL,
  "storeSlug" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "categoryPublicReference" TEXT NOT NULL,
  "categoryPath" TEXT NOT NULL,
  "productTypeCode" TEXT NOT NULL,
  "productTypeVersion" INTEGER NOT NULL,
  "brandPublicReference" TEXT,
  "brandName" TEXT,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "shortDescription" TEXT,
  "publicDescription" TEXT,
  "searchText" TEXT NOT NULL,
  "searchableAttributes" JSONB NOT NULL,
  "filterableAttributes" JSONB NOT NULL,
  "variantOptions" JSONB NOT NULL,
  "condition" "CatalogProductCondition" NOT NULL,
  "fulfilmentMode" "CatalogFulfilmentMode" NOT NULL,
  "sellingUnit" "CatalogSellingUnit" NOT NULL,
  "priceVersionId" TEXT NOT NULL,
  "pricePublicReference" TEXT NOT NULL,
  "priceAmount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "priceIncludesTax" BOOLEAN NOT NULL DEFAULT true,
  "unitPriceAmount" DECIMAL(18,2),
  "unitPriceUnit" TEXT,
  "unitPriceQuantity" DECIMAL(18,4),
  "inventoryTrackingMode" "CatalogInventoryTrackingMode" NOT NULL,
  "availabilityState" "StorefrontAvailabilityState" NOT NULL,
  "primaryMediaPublicReference" TEXT,
  "primaryMediaWidth" INTEGER,
  "primaryMediaHeight" INTEGER,
  "primaryMediaAlt" TEXT,
  "searchable" BOOLEAN NOT NULL DEFAULT true,
  "indexable" BOOLEAN NOT NULL DEFAULT false,
  "status" "StorefrontDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "indexedAt" TIMESTAMP(3) NOT NULL,
  "projectionVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorefrontProductDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontProductDocument_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "StorefrontProductDocument_publicationSnapshotId_key" UNIQUE ("publicationSnapshotId"),
  CONSTRAINT "StorefrontProductDocument_snapshot_variant_offer_key" UNIQUE ("publicationSnapshotId", "variantId", "offerId")
);

CREATE TABLE "StorefrontStoreDocument" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "storePublicReference" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortDescription" TEXT,
  "logoMediaReference" TEXT,
  "heroMediaReference" TEXT,
  "publicCategoryCodes" JSONB NOT NULL,
  "fulfilmentModes" JSONB NOT NULL,
  "serviceAreaReferences" JSONB NOT NULL,
  "publicStatus" "StorefrontStorePublicStatus" NOT NULL DEFAULT 'INELIGIBLE',
  "publishedOfferCount" INTEGER NOT NULL DEFAULT 0,
  "projectionVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "indexedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorefrontStoreDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontStoreDocument_storeId_key" UNIQUE ("storeId"),
  CONSTRAINT "StorefrontStoreDocument_storePublicReference_key" UNIQUE ("storePublicReference"),
  CONSTRAINT "StorefrontStoreDocument_slug_key" UNIQUE ("slug")
);

CREATE TABLE "StorefrontCategoryDocument" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "categoryPublicReference" TEXT NOT NULL,
  "canonicalPath" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "publicImageReference" TEXT,
  "parentPublicReference" TEXT,
  "childNavigation" JSONB NOT NULL,
  "productCount" INTEGER NOT NULL DEFAULT 0,
  "availableFacetDefinitions" JSONB NOT NULL,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "projectionVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
  "indexedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorefrontCategoryDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontCategoryDocument_categoryId_key" UNIQUE ("categoryId"),
  CONSTRAINT "StorefrontCategoryDocument_categoryPublicReference_key" UNIQUE ("categoryPublicReference"),
  CONSTRAINT "StorefrontCategoryDocument_canonicalPath_key" UNIQUE ("canonicalPath")
);

CREATE TABLE "StorefrontProjectionHistory" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "projectionVersion" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "safeSummary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontProjectionHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontProjectionHistory_document_version_action_key" UNIQUE ("documentId", "projectionVersion", "action")
);

CREATE TABLE "StorefrontProjectionCase" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateReference" TEXT NOT NULL,
  "reason" "StorefrontProjectionCaseReason" NOT NULL,
  "status" "StorefrontProjectionCaseStatus" NOT NULL DEFAULT 'OPEN',
  "version" INTEGER NOT NULL DEFAULT 1,
  "observationCount" INTEGER NOT NULL DEFAULT 1,
  "safeSummary" TEXT NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "resolutionCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorefrontProjectionCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontProjectionCase_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "StorefrontProjectionCase_aggregate_reason_key" UNIQUE ("aggregateType", "aggregateReference", "reason")
);

CREATE TABLE "StorefrontEventProcessing" (
  "id" TEXT NOT NULL,
  "catalogEventId" TEXT NOT NULL,
  "eventPublicReference" TEXT NOT NULL,
  "aggregateReference" TEXT NOT NULL,
  "aggregateVersion" INTEGER NOT NULL,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "status" "StorefrontEventProcessingStatus" NOT NULL,
  "projectionVersion" TEXT,
  "safeSummary" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontEventProcessing_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontEventProcessing_event_attempt_key" UNIQUE ("catalogEventId", "attemptNumber")
);

CREATE TABLE "StorefrontCacheInvalidation" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "tag" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "status" "StorefrontCacheInvalidationStatus" NOT NULL DEFAULT 'PENDING',
  "safeSummary" TEXT NOT NULL,
  "attemptedAt" TIMESTAMP(3),
  "appliedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorefrontCacheInvalidation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontCacheInvalidation_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "StorefrontCacheInvalidation_tag_source_version_key" UNIQUE ("tag", "sourceReference", "sourceVersion")
);

CREATE TABLE "StorefrontSearchSynonymSet" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" "StorefrontSynonymSetStatus" NOT NULL DEFAULT 'DRAFT',
  "language" TEXT NOT NULL DEFAULT 'en-ZA',
  "terms" JSONB NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorefrontSearchSynonymSet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontSearchSynonymSet_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "StorefrontSearchSynonymSet_name_version_language_key" UNIQUE ("name", "versionNumber", "language")
);

CREATE TABLE "StorefrontCollection" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "StorefrontCollectionStatus" NOT NULL DEFAULT 'DRAFT',
  "collectionType" "StorefrontCollectionType" NOT NULL,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveUntil" TIMESTAMP(3),
  "seoIndexable" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StorefrontCollection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontCollection_publicReference_key" UNIQUE ("publicReference"),
  CONSTRAINT "StorefrontCollection_slug_key" UNIQUE ("slug")
);

CREATE TABLE "StorefrontCollectionItem" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "targetType" "StorefrontCollectionTargetType" NOT NULL,
  "targetReference" TEXT NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  "safeLabelOverride" TEXT,
  "removedAt" TIMESTAMP(3),
  "removedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontCollectionItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontCollectionItem_collection_target_key" UNIQUE ("collectionId", "targetType", "targetReference"),
  CONSTRAINT "StorefrontCollectionItem_collection_displayOrder_key" UNIQUE ("collectionId", "displayOrder")
);

CREATE TABLE "StorefrontCollectionLifecycleHistory" (
  "id" TEXT NOT NULL,
  "collectionId" TEXT NOT NULL,
  "fromStatus" "StorefrontCollectionStatus",
  "toStatus" "StorefrontCollectionStatus" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "safeSummary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontCollectionLifecycleHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontCollectionLifecycleHistory_collection_operation_key" UNIQUE ("collectionId", "operationId")
);

CREATE TABLE "StorefrontSearchSynonymHistory" (
  "id" TEXT NOT NULL,
  "synonymSetId" TEXT NOT NULL,
  "fromStatus" "StorefrontSynonymSetStatus",
  "toStatus" "StorefrontSynonymSetStatus" NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "safeSummary" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontSearchSynonymHistory_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StorefrontSearchSynonymHistory_synonym_operation_key" UNIQUE ("synonymSetId", "operationId")
);

CREATE TABLE "StorefrontTelemetryEvent" (
  "id" TEXT NOT NULL,
  "eventType" "StorefrontTelemetryEventType" NOT NULL,
  "queryCategory" TEXT,
  "resultCount" INTEGER,
  "selectedFilterCodes" JSONB,
  "targetReference" TEXT,
  "latencyMs" INTEGER,
  "searchIndexVersion" TEXT,
  "serviceAreaReference" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorefrontTelemetryEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorefrontProductDocument_status_indexable_searchable_publishedAt_idx" ON "StorefrontProductDocument"("status", "indexable", "searchable", "publishedAt");
CREATE INDEX "StorefrontProductDocument_productPublicReference_status_idx" ON "StorefrontProductDocument"("productPublicReference", "status");
CREATE INDEX "StorefrontProductDocument_variantPublicReference_status_idx" ON "StorefrontProductDocument"("variantPublicReference", "status");
CREATE INDEX "StorefrontProductDocument_offerPublicReference_status_idx" ON "StorefrontProductDocument"("offerPublicReference", "status");
CREATE INDEX "StorefrontProductDocument_storeSlug_status_idx" ON "StorefrontProductDocument"("storeSlug", "status");
CREATE INDEX "StorefrontProductDocument_categoryPath_status_idx" ON "StorefrontProductDocument"("categoryPath", "status");
CREATE INDEX "StorefrontProductDocument_priceAmount_publicReference_idx" ON "StorefrontProductDocument"("priceAmount", "publicReference");
CREATE INDEX "StorefrontStoreDocument_publicStatus_slug_idx" ON "StorefrontStoreDocument"("publicStatus", "slug");
CREATE INDEX "StorefrontStoreDocument_publicStatus_publishedOfferCount_idx" ON "StorefrontStoreDocument"("publicStatus", "publishedOfferCount");
CREATE INDEX "StorefrontCategoryDocument_productCount_idx" ON "StorefrontCategoryDocument"("productCount");
CREATE INDEX "StorefrontProjectionHistory_documentId_createdAt_idx" ON "StorefrontProjectionHistory"("documentId", "createdAt");
CREATE INDEX "StorefrontProjectionCase_status_lastObservedAt_idx" ON "StorefrontProjectionCase"("status", "lastObservedAt");
CREATE INDEX "StorefrontProjectionCase_reason_status_idx" ON "StorefrontProjectionCase"("reason", "status");
CREATE INDEX "StorefrontEventProcessing_status_processedAt_idx" ON "StorefrontEventProcessing"("status", "processedAt");
CREATE INDEX "StorefrontEventProcessing_aggregateReference_aggregateVersion_idx" ON "StorefrontEventProcessing"("aggregateReference", "aggregateVersion");
CREATE INDEX "StorefrontCacheInvalidation_status_createdAt_idx" ON "StorefrontCacheInvalidation"("status", "createdAt");
CREATE INDEX "StorefrontSearchSynonymSet_status_language_idx" ON "StorefrontSearchSynonymSet"("status", "language");
CREATE INDEX "StorefrontCollection_status_effectiveFrom_effectiveUntil_idx" ON "StorefrontCollection"("status", "effectiveFrom", "effectiveUntil");
CREATE INDEX "StorefrontCollection_seoIndexable_status_idx" ON "StorefrontCollection"("seoIndexable", "status");
CREATE INDEX "StorefrontCollectionItem_targetType_targetReference_idx" ON "StorefrontCollectionItem"("targetType", "targetReference");
CREATE INDEX "StorefrontCollectionLifecycleHistory_collectionId_createdAt_idx" ON "StorefrontCollectionLifecycleHistory"("collectionId", "createdAt");
CREATE INDEX "StorefrontSearchSynonymHistory_synonymSetId_createdAt_idx" ON "StorefrontSearchSynonymHistory"("synonymSetId", "createdAt");
CREATE INDEX "StorefrontTelemetryEvent_eventType_createdAt_idx" ON "StorefrontTelemetryEvent"("eventType", "createdAt");
CREATE INDEX "StorefrontTelemetryEvent_expiresAt_idx" ON "StorefrontTelemetryEvent"("expiresAt");
CREATE INDEX "StorefrontProductDocument_search_trgm_idx" ON "StorefrontProductDocument" USING GIN ("searchText" gin_trgm_ops);

ALTER TABLE "StorefrontProductDocument" ADD CONSTRAINT "StorefrontProductDocument_snapshot_fkey" FOREIGN KEY ("publicationSnapshotId") REFERENCES "CatalogPublicationSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontProductDocument" ADD CONSTRAINT "StorefrontProductDocument_product_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontProductDocument" ADD CONSTRAINT "StorefrontProductDocument_variant_fkey" FOREIGN KEY ("variantId") REFERENCES "CatalogProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontProductDocument" ADD CONSTRAINT "StorefrontProductDocument_offer_fkey" FOREIGN KEY ("offerId") REFERENCES "StoreCatalogOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontProductDocument" ADD CONSTRAINT "StorefrontProductDocument_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontProductDocument" ADD CONSTRAINT "StorefrontProductDocument_category_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontProductDocument" ADD CONSTRAINT "StorefrontProductDocument_price_fkey" FOREIGN KEY ("priceVersionId") REFERENCES "StoreOfferPriceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontStoreDocument" ADD CONSTRAINT "StorefrontStoreDocument_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontCategoryDocument" ADD CONSTRAINT "StorefrontCategoryDocument_category_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontProjectionHistory" ADD CONSTRAINT "StorefrontProjectionHistory_document_fkey" FOREIGN KEY ("documentId") REFERENCES "StorefrontProductDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontEventProcessing" ADD CONSTRAINT "StorefrontEventProcessing_event_fkey" FOREIGN KEY ("catalogEventId") REFERENCES "CatalogChangeEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontCollectionItem" ADD CONSTRAINT "StorefrontCollectionItem_collection_fkey" FOREIGN KEY ("collectionId") REFERENCES "StorefrontCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontCollectionLifecycleHistory" ADD CONSTRAINT "StorefrontCollectionLifecycleHistory_collection_fkey" FOREIGN KEY ("collectionId") REFERENCES "StorefrontCollection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorefrontSearchSynonymHistory" ADD CONSTRAINT "StorefrontSearchSynonymHistory_synonym_fkey" FOREIGN KEY ("synonymSetId") REFERENCES "StorefrontSearchSynonymSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StorefrontProductDocument" ADD CONSTRAINT "StorefrontProductDocument_source_shape_check" CHECK (
  length("publicationVersion") BETWEEN 16 AND 128
  AND length("title") BETWEEN 1 AND 300
  AND length("searchText") BETWEEN 1 AND 10000
  AND "productTypeVersion" > 0
  AND "projectionVersion" > 0
  AND "priceAmount" > 0
  AND "currency" = 'ZAR'
  AND "priceIncludesTax" = true
  AND ("unitPriceAmount" IS NULL OR "unitPriceAmount" > 0)
  AND ("unitPriceQuantity" IS NULL OR "unitPriceQuantity" > 0)
  AND ("primaryMediaPublicReference" IS NULL OR "primaryMediaPublicReference" !~ '/')
  AND ("primaryMediaWidth" IS NULL OR "primaryMediaWidth" > 0)
  AND ("primaryMediaHeight" IS NULL OR "primaryMediaHeight" > 0)
  AND jsonb_typeof("searchableAttributes") = 'object'
  AND jsonb_typeof("filterableAttributes") = 'object'
  AND jsonb_typeof("variantOptions") = 'object'
);
ALTER TABLE "StorefrontStoreDocument" ADD CONSTRAINT "StorefrontStoreDocument_public_shape_check" CHECK (
  length("name") BETWEEN 1 AND 240 AND "publishedOfferCount" >= 0 AND "projectionVersion" > 0
  AND jsonb_typeof("publicCategoryCodes") = 'array' AND jsonb_typeof("fulfilmentModes") = 'array' AND jsonb_typeof("serviceAreaReferences") = 'array'
);
ALTER TABLE "StorefrontCategoryDocument" ADD CONSTRAINT "StorefrontCategoryDocument_shape_check" CHECK (
  length("name") BETWEEN 1 AND 240 AND "productCount" >= 0 AND "projectionVersion" > 0
  AND jsonb_typeof("childNavigation") = 'array' AND jsonb_typeof("availableFacetDefinitions") = 'object'
);
ALTER TABLE "StorefrontProjectionHistory" ADD CONSTRAINT "StorefrontProjectionHistory_safe_check" CHECK (length("sourceVersion") BETWEEN 16 AND 128 AND "projectionVersion" > 0 AND length("action") BETWEEN 3 AND 80 AND length("safeSummary") BETWEEN 1 AND 500);
ALTER TABLE "StorefrontEventProcessing" ADD CONSTRAINT "StorefrontEventProcessing_attempt_check" CHECK ("attemptNumber" > 0 AND length("safeSummary") BETWEEN 1 AND 500);
ALTER TABLE "StorefrontProjectionCase" ADD CONSTRAINT "StorefrontProjectionCase_lifecycle_check" CHECK ("version" > 0 AND "observationCount" > 0 AND length("safeSummary") BETWEEN 1 AND 500 AND (("status" = 'RESOLVED' AND "resolvedAt" IS NOT NULL AND "resolutionCode" IS NOT NULL) OR ("status" <> 'RESOLVED' AND "resolvedAt" IS NULL)));
ALTER TABLE "StorefrontCacheInvalidation" ADD CONSTRAINT "StorefrontCacheInvalidation_shape_check" CHECK (length("tag") BETWEEN 3 AND 180 AND length("sourceReference") BETWEEN 3 AND 160 AND length("sourceVersion") BETWEEN 16 AND 128 AND length("safeSummary") BETWEEN 1 AND 500);
ALTER TABLE "StorefrontSearchSynonymSet" ADD CONSTRAINT "StorefrontSearchSynonymSet_shape_check" CHECK ("versionNumber" > 0 AND "version" > 0 AND jsonb_typeof("terms") = 'array' AND length("language") BETWEEN 2 AND 20 AND ("status" <> 'ACTIVE' OR ("approvedByUserId" IS NOT NULL AND "activatedAt" IS NOT NULL)));
ALTER TABLE "StorefrontCollection" ADD CONSTRAINT "StorefrontCollection_window_check" CHECK (("effectiveUntil" IS NULL OR "effectiveFrom" IS NULL OR "effectiveUntil" > "effectiveFrom") AND "version" > 0 AND (NOT "seoIndexable" OR "status" = 'ACTIVE'));
ALTER TABLE "StorefrontCollectionItem" ADD CONSTRAINT "StorefrontCollectionItem_shape_check" CHECK ("displayOrder" >= 0 AND length("targetReference") BETWEEN 3 AND 160 AND length("sourceVersion") BETWEEN 3 AND 128 AND ("safeLabelOverride" IS NULL OR length("safeLabelOverride") BETWEEN 1 AND 240));
ALTER TABLE "StorefrontCollectionLifecycleHistory" ADD CONSTRAINT "StorefrontCollectionLifecycleHistory_shape_check" CHECK (length("operationId") BETWEEN 8 AND 160 AND length("safeSummary") BETWEEN 1 AND 500);
ALTER TABLE "StorefrontSearchSynonymHistory" ADD CONSTRAINT "StorefrontSearchSynonymHistory_shape_check" CHECK (length("operationId") BETWEEN 8 AND 160 AND length("safeSummary") BETWEEN 1 AND 500);
ALTER TABLE "StorefrontTelemetryEvent" ADD CONSTRAINT "StorefrontTelemetryEvent_privacy_check" CHECK (("resultCount" IS NULL OR "resultCount" >= 0) AND ("latencyMs" IS NULL OR "latencyMs" >= 0) AND "expiresAt" > "createdAt" AND ("selectedFilterCodes" IS NULL OR jsonb_typeof("selectedFilterCodes") = 'array'));

CREATE UNIQUE INDEX "StorefrontSearchSynonymSet_one_active_per_name_language" ON "StorefrontSearchSynonymSet"("name", "language") WHERE "status" = 'ACTIVE';

CREATE FUNCTION storefront_product_document_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE snapshot_status "CatalogPublicationStatus"; snapshot_version TEXT; source_offer TEXT; source_variant TEXT; source_product TEXT; source_price TEXT;
BEGIN
  SELECT "status", "publicationVersion", "offerId", "variantId", "productId" INTO snapshot_status, snapshot_version, source_offer, source_variant, source_product FROM "CatalogPublicationSnapshot" WHERE "id" = NEW."publicationSnapshotId";
  IF NOT FOUND OR snapshot_status <> 'PUBLISHED' THEN RAISE EXCEPTION 'storefront projection requires a published snapshot'; END IF;
  IF snapshot_version <> NEW."publicationVersion" OR source_offer <> NEW."offerId" OR source_variant <> NEW."variantId" OR source_product <> NEW."productId" THEN RAISE EXCEPTION 'storefront projection source version mismatch'; END IF;
  SELECT "id" INTO source_price FROM "StoreOfferPriceVersion" WHERE "id" = NEW."priceVersionId" AND "offerId" = NEW."offerId" AND "status" = 'ACTIVE';
  IF source_price IS NULL THEN RAISE EXCEPTION 'storefront projection requires an active price version'; END IF;
  IF NEW."status" = 'ACTIVE' AND (NEW."indexable" = true OR NEW."searchable" = true) THEN
    IF NOT EXISTS (SELECT 1 FROM "CatalogProduct" WHERE "id" = NEW."productId" AND "status" = 'ACTIVE' AND "publicationStatus" = 'PUBLISHED')
      OR NOT EXISTS (SELECT 1 FROM "CatalogProductVariant" WHERE "id" = NEW."variantId" AND "status" = 'ACTIVE')
      OR NOT EXISTS (SELECT 1 FROM "StoreCatalogOffer" WHERE "id" = NEW."offerId" AND "status" = 'ACTIVE' AND "publicationStatus" = 'PUBLISHED')
      OR NOT EXISTS (SELECT 1 FROM "Store" WHERE "id" = NEW."storeId" AND "status" = 'ACTIVE')
      OR NOT EXISTS (SELECT 1 FROM "CatalogCategory" WHERE "id" = NEW."categoryId" AND "status" = 'ACTIVE') THEN
      RAISE EXCEPTION 'storefront projection source is not publicly eligible';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "StorefrontProductDocument_guard" BEFORE INSERT OR UPDATE ON "StorefrontProductDocument" FOR EACH ROW EXECUTE FUNCTION storefront_product_document_guard();

CREATE FUNCTION storefront_active_synonym_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'ACTIVE' AND (TG_OP = 'DELETE' OR NEW."name" <> OLD."name" OR NEW."language" <> OLD."language" OR NEW."versionNumber" <> OLD."versionNumber" OR NEW."terms" <> OLD."terms" OR NEW."createdByUserId" <> OLD."createdByUserId") THEN
    RAISE EXCEPTION 'active storefront synonym versions are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "StorefrontSearchSynonymSet_active_immutable" BEFORE UPDATE OR DELETE ON "StorefrontSearchSynonymSet" FOR EACH ROW EXECUTE FUNCTION storefront_active_synonym_immutable();

CREATE FUNCTION storefront_active_collection_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'ACTIVE' AND (TG_OP = 'DELETE' OR NEW."name" <> OLD."name" OR NEW."slug" <> OLD."slug" OR NEW."description" IS DISTINCT FROM OLD."description" OR NEW."collectionType" <> OLD."collectionType" OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom" OR NEW."effectiveUntil" IS DISTINCT FROM OLD."effectiveUntil" OR NEW."seoIndexable" <> OLD."seoIndexable") THEN
    RAISE EXCEPTION 'active storefront collections are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "StorefrontCollection_active_immutable" BEFORE UPDATE OR DELETE ON "StorefrontCollection" FOR EACH ROW EXECUTE FUNCTION storefront_active_collection_immutable();

CREATE FUNCTION storefront_collection_item_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "StorefrontCollection" WHERE "id" = COALESCE(NEW."collectionId", OLD."collectionId") AND "status" = 'ACTIVE') THEN
    RAISE EXCEPTION 'active storefront collection items are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "StorefrontCollectionItem_guard" BEFORE INSERT OR UPDATE OR DELETE ON "StorefrontCollectionItem" FOR EACH ROW EXECUTE FUNCTION storefront_collection_item_guard();

CREATE FUNCTION storefront_projection_case_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'RESOLVED' THEN RAISE EXCEPTION 'resolved storefront projection cases are historical evidence'; END IF;
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'storefront projection cases are historical evidence'; END IF;
  IF NEW."observationCount" < OLD."observationCount" OR NEW."openedAt" <> OLD."openedAt" THEN RAISE EXCEPTION 'storefront projection case evidence is append-only'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "StorefrontProjectionCase_guard" BEFORE UPDATE OR DELETE ON "StorefrontProjectionCase" FOR EACH ROW EXECUTE FUNCTION storefront_projection_case_guard();

CREATE FUNCTION storefront_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'storefront processing evidence is append-only';
END;
$$;
CREATE TRIGGER "StorefrontProjectionHistory_immutable" BEFORE UPDATE OR DELETE ON "StorefrontProjectionHistory" FOR EACH ROW EXECUTE FUNCTION storefront_append_only();
CREATE TRIGGER "StorefrontEventProcessing_immutable" BEFORE UPDATE OR DELETE ON "StorefrontEventProcessing" FOR EACH ROW EXECUTE FUNCTION storefront_append_only();
CREATE TRIGGER "StorefrontCollectionLifecycleHistory_immutable" BEFORE UPDATE OR DELETE ON "StorefrontCollectionLifecycleHistory" FOR EACH ROW EXECUTE FUNCTION storefront_append_only();
CREATE TRIGGER "StorefrontSearchSynonymHistory_immutable" BEFORE UPDATE OR DELETE ON "StorefrontSearchSynonymHistory" FOR EACH ROW EXECUTE FUNCTION storefront_append_only();
