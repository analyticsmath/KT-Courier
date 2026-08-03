-- Phase 18 product catalog
-- Additive only. Legacy Product/ProductCategory/ProductImage/Inventory* tables
-- remain untouched and are rejected by the Phase 18 preflight if operational.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE "CatalogCategoryStatus" AS ENUM ('DRAFT', 'ACTIVE', 'HIDDEN', 'ARCHIVED');
CREATE TYPE "ProductTypeDefinitionStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'ACTIVE', 'RETIRED', 'REJECTED');
CREATE TYPE "CatalogBrandStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "CatalogProductScope" AS ENUM ('GLOBAL_CANONICAL', 'STORE_PRIVATE');
CREATE TYPE "CatalogProductCondition" AS ENUM ('NEW', 'REFURBISHED', 'RECONDITIONED', 'USED');
CREATE TYPE "CatalogProductStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_CHANGES', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "CatalogModerationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "CatalogVariantStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "CatalogGtinType" AS ENUM ('GTIN_8', 'GTIN_12', 'GTIN_13', 'GTIN_14');
CREATE TYPE "CatalogOptionPresentationType" AS ENUM ('TEXT', 'COLOR_SWATCH', 'IMAGE_SWATCH', 'SIZE');
CREATE TYPE "StoreCatalogOfferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'NEEDS_CHANGES', 'ACTIVE', 'PAUSED', 'OUT_OF_STOCK', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "CatalogPublicationStatus" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'BLOCKED', 'PUBLISHED', 'WITHDRAWN');
CREATE TYPE "CatalogInventoryTrackingMode" AS ENUM ('TRACKED', 'UNTRACKED', 'MADE_TO_ORDER');
CREATE TYPE "CatalogFulfilmentMode" AS ENUM ('COURIER_DELIVERY', 'STORE_PICKUP', 'PICKUP_AND_DELIVERY');
CREATE TYPE "CatalogSellingUnit" AS ENUM ('EACH', 'FIXED_WEIGHT', 'VARIABLE_WEIGHT', 'VOLUME', 'LENGTH');
CREATE TYPE "StoreOfferPriceStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'RETIRED', 'CANCELLED');
CREATE TYPE "InventoryLocationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "CatalogInventoryMovementType" AS ENUM ('INITIAL_STOCK', 'STOCK_RECEIPT', 'STOCK_COUNT_CORRECTION', 'DAMAGE', 'LOSS', 'RETURN_TO_STOCK', 'MANUAL_CORRECTION', 'REMOVAL', 'RESERVATION', 'RESERVATION_RELEASE', 'SALE_COMMITMENT', 'ORDER_SUBSTITUTION_RESERVATION', 'ORDER_SUBSTITUTION_RELEASE', 'ORDER_SUBSTITUTION_COMMITMENT', 'ORDER_CANCELLATION_RESTOCK', 'ORDER_DAMAGE_QUARANTINE');
CREATE TYPE "CatalogMediaAssetStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'VALIDATING', 'READY', 'QUARANTINED', 'REJECTED', 'ARCHIVED');
CREATE TYPE "CatalogMediaOwnerType" AS ENUM ('PLATFORM', 'STORE');
CREATE TYPE "CatalogMediaPurpose" AS ENUM ('PRODUCT_IMAGE', 'VARIANT_IMAGE', 'CATEGORY_IMAGE', 'BRAND_LOGO', 'COMPLIANCE_DOCUMENT');
CREATE TYPE "CatalogMediaUploadIntentStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'COMPLETED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "CatalogProductMediaRole" AS ENUM ('PRIMARY', 'GALLERY', 'VARIANT', 'SWATCH', 'LABEL', 'COMPLIANCE_DOCUMENT');
CREATE TYPE "StoreModifierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "CatalogModerationCaseType" AS ENUM ('PRODUCT', 'OFFER', 'MEDIA', 'COMPLIANCE');
CREATE TYPE "CatalogModerationCaseStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED', 'SUSPENDED', 'RESOLVED');
CREATE TYPE "CatalogModerationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "CatalogDuplicateReason" AS ENUM ('EXACT_GTIN', 'BRAND_MPN', 'NORMALIZED_TITLE', 'ATTRIBUTE_FINGERPRINT', 'VARIANT_DIMENSIONS');
CREATE TYPE "CatalogDuplicateConfidenceBand" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'EXACT');
CREATE TYPE "CatalogDuplicateStatus" AS ENUM ('OPEN', 'CONFIRMED_DISTINCT', 'SOURCE_REJECTED', 'LINKED_TO_EXISTING', 'MERGE_REVIEW_REQUESTED');
CREATE TYPE "CatalogImportJobStatus" AS ENUM ('UPLOADED', 'VALIDATING', 'VALIDATED', 'APPLYING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "CatalogImportRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'APPLIED', 'FAILED');
CREATE TYPE "CatalogChangeAggregateType" AS ENUM ('CATEGORY', 'PRODUCT_TYPE', 'PRODUCT', 'VARIANT', 'OFFER', 'PRICE', 'INVENTORY', 'MODERATION', 'IMPORT', 'SNAPSHOT', 'MEDIA');
CREATE TYPE "CatalogChangeEventType" AS ENUM ('CATEGORY_UPDATED', 'PRODUCT_TYPE_UPDATED', 'PRODUCT_PUBLISHED', 'PRODUCT_UPDATED', 'PRODUCT_SUSPENDED', 'VARIANT_UPDATED', 'OFFER_PUBLISHED', 'OFFER_UPDATED', 'PRICE_ACTIVATED', 'INVENTORY_CHANGED', 'MODERATION_RECORDED', 'IMPORT_APPLIED', 'SNAPSHOT_REBUILT', 'MEDIA_UPDATED');

CREATE TABLE "CatalogCategory" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "parentId" TEXT,
  "depth" INTEGER NOT NULL DEFAULT 0,
  "path" TEXT NOT NULL,
  "status" "CatalogCategoryStatus" NOT NULL DEFAULT 'DRAFT',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "imageAssetId" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductTypeDefinition" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "versionNumber" INTEGER NOT NULL,
  "status" "ProductTypeDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "attributeSchema" JSONB NOT NULL,
  "variantSchema" JSONB NOT NULL,
  "complianceSchema" JSONB NOT NULL,
  "searchFacetSchema" JSONB NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "submittedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "supersedesDefinitionId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductTypeDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogCategoryProductType" (
  "categoryId" TEXT NOT NULL,
  "productTypeDefinitionId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogCategoryProductType_pkey" PRIMARY KEY ("categoryId", "productTypeDefinitionId")
);

CREATE TABLE "CatalogBrand" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "status" "CatalogBrandStatus" NOT NULL DEFAULT 'PENDING',
  "logoAssetId" TEXT,
  "website" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "approvedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogBrand_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogProduct" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "scope" "CatalogProductScope" NOT NULL,
  "sourceStoreId" TEXT,
  "productTypeDefinitionId" TEXT NOT NULL,
  "productTypeVersionNumber" INTEGER NOT NULL,
  "primaryCategoryId" TEXT NOT NULL,
  "brandId" TEXT,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "shortDescription" TEXT,
  "description" TEXT,
  "manufacturer" TEXT,
  "modelNumber" TEXT,
  "countryOfOrigin" TEXT,
  "condition" "CatalogProductCondition" NOT NULL DEFAULT 'NEW',
  "attributeValues" JSONB NOT NULL,
  "complianceValues" JSONB NOT NULL,
  "status" "CatalogProductStatus" NOT NULL DEFAULT 'DRAFT',
  "moderationStatus" "CatalogModerationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "publicationStatus" "CatalogPublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "slug" TEXT NOT NULL,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "qualityScore" INTEGER NOT NULL DEFAULT 0,
  "qualityIssues" JSONB NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "submittedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "suspendedByUserId" TEXT,
  "suspensionReasonCode" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogProductVariant" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "normalizedTitle" TEXT NOT NULL,
  "skuReference" TEXT,
  "gtin" TEXT,
  "gtinType" "CatalogGtinType",
  "mpn" TEXT,
  "optionFingerprint" TEXT NOT NULL,
  "attributeValues" JSONB NOT NULL,
  "weight" DECIMAL(18,4),
  "weightUnit" TEXT,
  "length" DECIMAL(18,4),
  "width" DECIMAL(18,4),
  "height" DECIMAL(18,4),
  "dimensionUnit" TEXT,
  "status" "CatalogVariantStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogProductVariant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogMediaAsset" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "ownerType" "CatalogMediaOwnerType" NOT NULL,
  "ownerStoreId" TEXT,
  "purpose" "CatalogMediaPurpose" NOT NULL,
  "storageKey" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "declaredMimeType" TEXT NOT NULL,
  "mimeType" TEXT,
  "declaredByteSize" INTEGER NOT NULL,
  "byteSize" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "checksum" TEXT,
  "privacyInspectionPassed" BOOLEAN NOT NULL DEFAULT false,
  "validationSummary" JSONB,
  "quarantineReasonCode" TEXT,
  "rejectionReasonCode" TEXT,
  "status" "CatalogMediaAssetStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  "storageConfirmedAt" TIMESTAMP(3),
  "validatedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogMediaUploadIntent" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "ownerType" "CatalogMediaOwnerType" NOT NULL,
  "ownerStoreId" TEXT,
  "assetId" TEXT NOT NULL,
  "status" "CatalogMediaUploadIntentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  "purpose" "CatalogMediaPurpose" NOT NULL,
  "expectedMimeType" TEXT NOT NULL,
  "expectedByteSize" INTEGER NOT NULL,
  "maximumBytes" INTEGER NOT NULL,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "completedAt" TIMESTAMP(3),
  "completionCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogMediaUploadIntent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogMediaHistory" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "uploadIntentId" TEXT,
  "fromStatus" "CatalogMediaAssetStatus",
  "toStatus" "CatalogMediaAssetStatus" NOT NULL,
  "action" TEXT NOT NULL,
  "reasonCode" TEXT,
  "safeDetails" JSONB,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogMediaHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogProductOption" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "presentationType" "CatalogOptionPresentationType" NOT NULL DEFAULT 'TEXT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogProductOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogProductOptionValue" (
  "id" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "normalizedValue" TEXT NOT NULL,
  "swatchValue" TEXT,
  "mediaAssetId" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogProductOptionValue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogVariantOptionValue" (
  "variantId" TEXT NOT NULL,
  "optionValueId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogVariantOptionValue_pkey" PRIMARY KEY ("variantId", "optionValueId")
);

CREATE TABLE "StoreCatalogOffer" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "storeSku" TEXT NOT NULL,
  "merchantTitle" TEXT,
  "merchantDescription" TEXT,
  "status" "StoreCatalogOfferStatus" NOT NULL DEFAULT 'DRAFT',
  "publicationStatus" "CatalogPublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "inventoryTrackingMode" "CatalogInventoryTrackingMode" NOT NULL,
  "fulfilmentMode" "CatalogFulfilmentMode" NOT NULL DEFAULT 'COURIER_DELIVERY',
  "sellingUnit" "CatalogSellingUnit" NOT NULL DEFAULT 'EACH',
  "quantityStep" DECIMAL(18,4) NOT NULL DEFAULT 1,
  "minimumQuantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
  "packagedQuantity" DECIMAL(18,4),
  "unitOfMeasure" TEXT,
  "primaryInventoryLocationId" TEXT,
  "currentPriceVersionId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "submittedByUserId" TEXT,
  "approvedByUserId" TEXT,
  "suspendedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreCatalogOffer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreOfferPriceVersion" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "priceIncludesTax" BOOLEAN NOT NULL DEFAULT true,
  "unitPriceAmount" DECIMAL(18,2),
  "unitPriceUnit" TEXT,
  "unitPriceQuantity" DECIMAL(18,4),
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveUntil" TIMESTAMP(3),
  "status" "StoreOfferPriceStatus" NOT NULL DEFAULT 'DRAFT',
  "reasonCode" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "activatedByUserId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreOfferPriceVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryLocation" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "InventoryLocationStatus" NOT NULL DEFAULT 'ACTIVE',
  "locationReference" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogInventoryItem" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "trackingMode" "CatalogInventoryTrackingMode" NOT NULL,
  "allowBackorder" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogInventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogInventoryLevel" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "onHand" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "available" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogInventoryLevel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogInventoryMovement" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "type" "CatalogInventoryMovementType" NOT NULL,
  "quantityDelta" INTEGER NOT NULL,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "safeNote" TEXT,
  "actorUserId" TEXT NOT NULL,
  "resultingOnHand" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogInventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogProductMedia" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT,
  "assetId" TEXT NOT NULL,
  "role" "CatalogProductMediaRole" NOT NULL,
  "altText" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogProductMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreModifierGroup" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "minimumSelections" INTEGER NOT NULL DEFAULT 0,
  "maximumSelections" INTEGER NOT NULL,
  "isRequired" BOOLEAN NOT NULL DEFAULT false,
  "status" "StoreModifierStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreModifierGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreModifierOption" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "priceDelta" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ZAR',
  "status" "StoreModifierStatus" NOT NULL DEFAULT 'ACTIVE',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoreModifierOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StoreOfferModifierGroup" (
  "offerId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoreOfferModifierGroup_pkey" PRIMARY KEY ("offerId", "groupId")
);

CREATE TABLE "CatalogModerationCase" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "productId" TEXT,
  "offerId" TEXT,
  "type" "CatalogModerationCaseType" NOT NULL,
  "status" "CatalogModerationCaseStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "CatalogModerationPriority" NOT NULL DEFAULT 'NORMAL',
  "reasonCode" TEXT NOT NULL,
  "safeSummary" TEXT NOT NULL,
  "submittedByUserId" TEXT,
  "reviewedByUserId" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogModerationCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogModerationHistory" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "fromStatus" "CatalogModerationCaseStatus",
  "toStatus" "CatalogModerationCaseStatus" NOT NULL,
  "action" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "safeNote" TEXT,
  "actorUserId" TEXT NOT NULL,
  "aggregateVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogModerationHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogDuplicateCandidate" (
  "id" TEXT NOT NULL,
  "sourceProductId" TEXT NOT NULL,
  "candidateProductId" TEXT NOT NULL,
  "reason" "CatalogDuplicateReason" NOT NULL,
  "confidenceBand" "CatalogDuplicateConfidenceBand" NOT NULL,
  "status" "CatalogDuplicateStatus" NOT NULL DEFAULT 'OPEN',
  "reviewedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogDuplicateCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogImportJob" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL,
  "status" "CatalogImportJobStatus" NOT NULL DEFAULT 'UPLOADED',
  "dryRunCompleted" BOOLEAN NOT NULL DEFAULT false,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "invalidRows" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogImportJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogImportRow" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "status" "CatalogImportRowStatus" NOT NULL DEFAULT 'PENDING',
  "normalizedPayload" JSONB NOT NULL,
  "errorCodes" JSONB NOT NULL,
  "resultingProductId" TEXT,
  "resultingOfferId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogImportRow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogPublicationSnapshot" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "variantId" TEXT NOT NULL,
  "offerId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "publicationVersion" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "status" "CatalogPublicationStatus" NOT NULL DEFAULT 'BLOCKED',
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),
  CONSTRAINT "CatalogPublicationSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogChangeEvent" (
  "id" TEXT NOT NULL,
  "publicReference" TEXT NOT NULL,
  "aggregateType" "CatalogChangeAggregateType" NOT NULL,
  "aggregateReference" TEXT NOT NULL,
  "eventType" "CatalogChangeEventType" NOT NULL,
  "aggregateVersion" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "CatalogChangeEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogAuditHistory" (
  "id" TEXT NOT NULL,
  "aggregateType" "CatalogChangeAggregateType" NOT NULL,
  "aggregateReference" TEXT NOT NULL,
  "aggregateVersion" INTEGER NOT NULL,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "reasonCode" TEXT,
  "safeMetadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogAuditHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogOperationReceipt" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "storeId" TEXT,
  "operationId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "aggregateReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CatalogOperationReceipt_pkey" PRIMARY KEY ("id")
);

-- Unique constraints and indexes.
CREATE UNIQUE INDEX "CatalogCategory_publicReference_key" ON "CatalogCategory"("publicReference");
CREATE UNIQUE INDEX "CatalogCategory_path_key" ON "CatalogCategory"("path");
CREATE UNIQUE INDEX "CatalogCategory_parentId_slug_key" ON "CatalogCategory"("parentId", "slug");
CREATE UNIQUE INDEX "CatalogCategory_root_slug_key" ON "CatalogCategory"("slug") WHERE "parentId" IS NULL;
CREATE INDEX "CatalogCategory_parentId_displayOrder_idx" ON "CatalogCategory"("parentId", "displayOrder");
CREATE INDEX "CatalogCategory_status_path_idx" ON "CatalogCategory"("status", "path");
CREATE UNIQUE INDEX "ProductTypeDefinition_publicReference_key" ON "ProductTypeDefinition"("publicReference");
CREATE UNIQUE INDEX "ProductTypeDefinition_code_versionNumber_key" ON "ProductTypeDefinition"("code", "versionNumber");
CREATE INDEX "ProductTypeDefinition_code_status_idx" ON "ProductTypeDefinition"("code", "status");
CREATE INDEX "ProductTypeDefinition_status_updatedAt_idx" ON "ProductTypeDefinition"("status", "updatedAt");
CREATE UNIQUE INDEX "CatalogCategoryProductType_one_primary_idx" ON "CatalogCategoryProductType"("categoryId") WHERE "isPrimary" = true;
CREATE INDEX "CatalogCategoryProductType_productTypeDefinitionId_idx" ON "CatalogCategoryProductType"("productTypeDefinitionId");
CREATE UNIQUE INDEX "CatalogBrand_publicReference_key" ON "CatalogBrand"("publicReference");
CREATE UNIQUE INDEX "CatalogBrand_normalizedName_key" ON "CatalogBrand"("normalizedName");
CREATE UNIQUE INDEX "CatalogBrand_slug_key" ON "CatalogBrand"("slug");
CREATE UNIQUE INDEX "CatalogProduct_publicReference_key" ON "CatalogProduct"("publicReference");
CREATE UNIQUE INDEX "CatalogProduct_global_slug_key" ON "CatalogProduct"("slug") WHERE "scope" = 'GLOBAL_CANONICAL';
CREATE UNIQUE INDEX "CatalogProduct_store_slug_key" ON "CatalogProduct"("sourceStoreId", "slug") WHERE "scope" = 'STORE_PRIVATE';
CREATE INDEX "CatalogProduct_sourceStoreId_status_idx" ON "CatalogProduct"("sourceStoreId", "status");
CREATE INDEX "CatalogProduct_primaryCategoryId_status_idx" ON "CatalogProduct"("primaryCategoryId", "status");
CREATE INDEX "CatalogProduct_type_version_idx" ON "CatalogProduct"("productTypeDefinitionId", "productTypeVersionNumber");
CREATE INDEX "CatalogProduct_brand_title_idx" ON "CatalogProduct"("brandId", "normalizedTitle");
CREATE INDEX "CatalogProduct_moderation_status_idx" ON "CatalogProduct"("moderationStatus", "status");
CREATE UNIQUE INDEX "CatalogProductVariant_publicReference_key" ON "CatalogProductVariant"("publicReference");
CREATE UNIQUE INDEX "CatalogProductVariant_gtin_key" ON "CatalogProductVariant"("gtin");
CREATE UNIQUE INDEX "CatalogProductVariant_productId_optionFingerprint_key" ON "CatalogProductVariant"("productId", "optionFingerprint");
CREATE INDEX "CatalogProductVariant_productId_status_idx" ON "CatalogProductVariant"("productId", "status");
CREATE UNIQUE INDEX "CatalogMediaAsset_publicReference_key" ON "CatalogMediaAsset"("publicReference");
CREATE UNIQUE INDEX "CatalogMediaAsset_storageKey_key" ON "CatalogMediaAsset"("storageKey");
CREATE INDEX "CatalogMediaAsset_owner_status_idx" ON "CatalogMediaAsset"("ownerType", "ownerStoreId", "status");
CREATE INDEX "CatalogMediaAsset_checksum_idx" ON "CatalogMediaAsset"("checksum");
CREATE UNIQUE INDEX "CatalogMediaUploadIntent_publicReference_key" ON "CatalogMediaUploadIntent"("publicReference");
CREATE UNIQUE INDEX "CatalogMediaUploadIntent_assetId_key" ON "CatalogMediaUploadIntent"("assetId");
CREATE UNIQUE INDEX "CatalogMediaUploadIntent_storageKey_key" ON "CatalogMediaUploadIntent"("storageKey");
CREATE UNIQUE INDEX "CatalogMediaUploadIntent_actor_operation_key" ON "CatalogMediaUploadIntent"("createdByUserId", "operationId");
CREATE INDEX "CatalogMediaUploadIntent_owner_expiry_idx" ON "CatalogMediaUploadIntent"("ownerType", "ownerStoreId", "status", "expiresAt");
CREATE INDEX "CatalogMediaUploadIntent_status_expiry_idx" ON "CatalogMediaUploadIntent"("status", "expiresAt");
CREATE INDEX "CatalogMediaHistory_asset_created_idx" ON "CatalogMediaHistory"("assetId", "createdAt");
CREATE INDEX "CatalogMediaHistory_intent_created_idx" ON "CatalogMediaHistory"("uploadIntentId", "createdAt");
CREATE UNIQUE INDEX "CatalogProductOption_productId_code_key" ON "CatalogProductOption"("productId", "code");
CREATE UNIQUE INDEX "CatalogProductOptionValue_optionId_code_key" ON "CatalogProductOptionValue"("optionId", "code");
CREATE UNIQUE INDEX "CatalogProductOptionValue_optionId_normalizedValue_key" ON "CatalogProductOptionValue"("optionId", "normalizedValue");
CREATE INDEX "CatalogVariantOptionValue_optionValueId_idx" ON "CatalogVariantOptionValue"("optionValueId");
CREATE UNIQUE INDEX "StoreCatalogOffer_publicReference_key" ON "StoreCatalogOffer"("publicReference");
CREATE UNIQUE INDEX "StoreCatalogOffer_storeId_variantId_key" ON "StoreCatalogOffer"("storeId", "variantId");
CREATE UNIQUE INDEX "StoreCatalogOffer_storeId_storeSku_key" ON "StoreCatalogOffer"("storeId", "storeSku");
CREATE INDEX "StoreCatalogOffer_storeId_status_idx" ON "StoreCatalogOffer"("storeId", "status");
CREATE UNIQUE INDEX "StoreOfferPriceVersion_publicReference_key" ON "StoreOfferPriceVersion"("publicReference");
CREATE UNIQUE INDEX "StoreOfferPriceVersion_offerId_versionNumber_key" ON "StoreOfferPriceVersion"("offerId", "versionNumber");
CREATE UNIQUE INDEX "StoreOfferPriceVersion_one_active_idx" ON "StoreOfferPriceVersion"("offerId") WHERE "status" = 'ACTIVE';
CREATE INDEX "StoreOfferPriceVersion_offerId_status_idx" ON "StoreOfferPriceVersion"("offerId", "status");
CREATE UNIQUE INDEX "InventoryLocation_publicReference_key" ON "InventoryLocation"("publicReference");
CREATE UNIQUE INDEX "InventoryLocation_storeId_name_key" ON "InventoryLocation"("storeId", "name");
CREATE UNIQUE INDEX "InventoryLocation_storeId_locationReference_key" ON "InventoryLocation"("storeId", "locationReference");
CREATE UNIQUE INDEX "InventoryLocation_one_primary_idx" ON "InventoryLocation"("storeId") WHERE "isPrimary" = true AND "status" <> 'ARCHIVED';
CREATE UNIQUE INDEX "CatalogInventoryItem_publicReference_key" ON "CatalogInventoryItem"("publicReference");
CREATE UNIQUE INDEX "CatalogInventoryItem_offerId_key" ON "CatalogInventoryItem"("offerId");
CREATE UNIQUE INDEX "CatalogInventoryLevel_item_location_key" ON "CatalogInventoryLevel"("inventoryItemId", "locationId");
CREATE UNIQUE INDEX "CatalogInventoryMovement_publicReference_key" ON "CatalogInventoryMovement"("publicReference");
CREATE UNIQUE INDEX "CatalogInventoryMovement_item_operation_key" ON "CatalogInventoryMovement"("inventoryItemId", "operationId");
CREATE INDEX "CatalogInventoryMovement_item_location_created_idx" ON "CatalogInventoryMovement"("inventoryItemId", "locationId", "createdAt");
CREATE UNIQUE INDEX "CatalogProductMedia_identity_key" ON "CatalogProductMedia"("productId", COALESCE("variantId", ''), "assetId", "role");
CREATE UNIQUE INDEX "CatalogProductMedia_order_key" ON "CatalogProductMedia"("productId", COALESCE("variantId", ''), "displayOrder");
CREATE UNIQUE INDEX "CatalogProductMedia_one_product_primary_idx" ON "CatalogProductMedia"("productId") WHERE "role" = 'PRIMARY' AND "variantId" IS NULL;
CREATE UNIQUE INDEX "StoreModifierGroup_publicReference_key" ON "StoreModifierGroup"("publicReference");
CREATE UNIQUE INDEX "StoreModifierGroup_storeId_name_key" ON "StoreModifierGroup"("storeId", "name");
CREATE UNIQUE INDEX "StoreModifierOption_publicReference_key" ON "StoreModifierOption"("publicReference");
CREATE UNIQUE INDEX "StoreModifierOption_groupId_name_key" ON "StoreModifierOption"("groupId", "name");
CREATE UNIQUE INDEX "CatalogModerationCase_publicReference_key" ON "CatalogModerationCase"("publicReference");
CREATE INDEX "CatalogModerationCase_queue_idx" ON "CatalogModerationCase"("status", "priority", "openedAt");
CREATE INDEX "CatalogModerationHistory_case_created_idx" ON "CatalogModerationHistory"("caseId", "createdAt");
CREATE UNIQUE INDEX "CatalogDuplicateCandidate_identity_key" ON "CatalogDuplicateCandidate"("sourceProductId", "candidateProductId", "reason");
CREATE INDEX "CatalogDuplicateCandidate_queue_idx" ON "CatalogDuplicateCandidate"("status", "confidenceBand", "createdAt");
CREATE UNIQUE INDEX "CatalogImportJob_publicReference_key" ON "CatalogImportJob"("publicReference");
CREATE UNIQUE INDEX "CatalogImportJob_storeId_operationId_key" ON "CatalogImportJob"("storeId", "operationId");
CREATE UNIQUE INDEX "CatalogImportRow_jobId_rowNumber_key" ON "CatalogImportRow"("jobId", "rowNumber");
CREATE UNIQUE INDEX "CatalogPublicationSnapshot_publicReference_key" ON "CatalogPublicationSnapshot"("publicReference");
CREATE UNIQUE INDEX "CatalogPublicationSnapshot_offer_version_key" ON "CatalogPublicationSnapshot"("offerId", "versionNumber");
CREATE UNIQUE INDEX "CatalogPublicationSnapshot_offer_publication_key" ON "CatalogPublicationSnapshot"("offerId", "publicationVersion");
CREATE UNIQUE INDEX "CatalogChangeEvent_publicReference_key" ON "CatalogChangeEvent"("publicReference");
CREATE UNIQUE INDEX "CatalogChangeEvent_aggregate_version_key" ON "CatalogChangeEvent"("aggregateType", "aggregateReference", "aggregateVersion", "eventType");
CREATE UNIQUE INDEX "CatalogAuditHistory_aggregate_version_action_key" ON "CatalogAuditHistory"("aggregateType", "aggregateReference", "aggregateVersion", "action");
CREATE UNIQUE INDEX "CatalogOperationReceipt_actor_action_operation_key" ON "CatalogOperationReceipt"("actorUserId", "action", "operationId");
CREATE INDEX "CatalogOperationReceipt_store_created_idx" ON "CatalogOperationReceipt"("storeId", "createdAt");
CREATE INDEX "CatalogOperationReceipt_aggregate_idx" ON "CatalogOperationReceipt"("aggregateReference");

-- Foreign keys are added after all compatible structures exist.
ALTER TABLE "CatalogCategory" ADD CONSTRAINT "CatalogCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogCategory" ADD CONSTRAINT "CatalogCategory_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogCategory" ADD CONSTRAINT "CatalogCategory_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductTypeDefinition" ADD CONSTRAINT "ProductTypeDefinition_supersedes_fkey" FOREIGN KEY ("supersedesDefinitionId") REFERENCES "ProductTypeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogCategoryProductType" ADD CONSTRAINT "CatalogCategoryProductType_category_fkey" FOREIGN KEY ("categoryId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogCategoryProductType" ADD CONSTRAINT "CatalogCategoryProductType_definition_fkey" FOREIGN KEY ("productTypeDefinitionId") REFERENCES "ProductTypeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_sourceStore_fkey" FOREIGN KEY ("sourceStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_definition_fkey" FOREIGN KEY ("productTypeDefinitionId") REFERENCES "ProductTypeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_category_fkey" FOREIGN KEY ("primaryCategoryId") REFERENCES "CatalogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_brand_fkey" FOREIGN KEY ("brandId") REFERENCES "CatalogBrand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogProductVariant" ADD CONSTRAINT "CatalogProductVariant_product_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogMediaAsset" ADD CONSTRAINT "CatalogMediaAsset_store_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogMediaUploadIntent" ADD CONSTRAINT "CatalogMediaUploadIntent_store_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogMediaUploadIntent" ADD CONSTRAINT "CatalogMediaUploadIntent_asset_fkey" FOREIGN KEY ("assetId") REFERENCES "CatalogMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogMediaHistory" ADD CONSTRAINT "CatalogMediaHistory_asset_fkey" FOREIGN KEY ("assetId") REFERENCES "CatalogMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogMediaHistory" ADD CONSTRAINT "CatalogMediaHistory_intent_fkey" FOREIGN KEY ("uploadIntentId") REFERENCES "CatalogMediaUploadIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogProductOption" ADD CONSTRAINT "CatalogProductOption_product_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogProductOptionValue" ADD CONSTRAINT "CatalogProductOptionValue_option_fkey" FOREIGN KEY ("optionId") REFERENCES "CatalogProductOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogProductOptionValue" ADD CONSTRAINT "CatalogProductOptionValue_asset_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "CatalogMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogVariantOptionValue" ADD CONSTRAINT "CatalogVariantOptionValue_variant_fkey" FOREIGN KEY ("variantId") REFERENCES "CatalogProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogVariantOptionValue" ADD CONSTRAINT "CatalogVariantOptionValue_value_fkey" FOREIGN KEY ("optionValueId") REFERENCES "CatalogProductOptionValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreCatalogOffer" ADD CONSTRAINT "StoreCatalogOffer_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreCatalogOffer" ADD CONSTRAINT "StoreCatalogOffer_product_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreCatalogOffer" ADD CONSTRAINT "StoreCatalogOffer_variant_fkey" FOREIGN KEY ("variantId") REFERENCES "CatalogProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreOfferPriceVersion" ADD CONSTRAINT "StoreOfferPriceVersion_offer_fkey" FOREIGN KEY ("offerId") REFERENCES "StoreCatalogOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreCatalogOffer" ADD CONSTRAINT "StoreCatalogOffer_location_fkey" FOREIGN KEY ("primaryInventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreCatalogOffer" ADD CONSTRAINT "StoreCatalogOffer_currentPrice_fkey" FOREIGN KEY ("currentPriceVersionId") REFERENCES "StoreOfferPriceVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogInventoryItem" ADD CONSTRAINT "CatalogInventoryItem_offer_fkey" FOREIGN KEY ("offerId") REFERENCES "StoreCatalogOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogInventoryItem" ADD CONSTRAINT "CatalogInventoryItem_variant_fkey" FOREIGN KEY ("variantId") REFERENCES "CatalogProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogInventoryLevel" ADD CONSTRAINT "CatalogInventoryLevel_item_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "CatalogInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogInventoryLevel" ADD CONSTRAINT "CatalogInventoryLevel_location_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogInventoryMovement" ADD CONSTRAINT "CatalogInventoryMovement_item_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "CatalogInventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogInventoryMovement" ADD CONSTRAINT "CatalogInventoryMovement_location_fkey" FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogProductMedia" ADD CONSTRAINT "CatalogProductMedia_product_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogProductMedia" ADD CONSTRAINT "CatalogProductMedia_variant_fkey" FOREIGN KEY ("variantId") REFERENCES "CatalogProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogProductMedia" ADD CONSTRAINT "CatalogProductMedia_asset_fkey" FOREIGN KEY ("assetId") REFERENCES "CatalogMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreModifierGroup" ADD CONSTRAINT "StoreModifierGroup_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreModifierOption" ADD CONSTRAINT "StoreModifierOption_group_fkey" FOREIGN KEY ("groupId") REFERENCES "StoreModifierGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreOfferModifierGroup" ADD CONSTRAINT "StoreOfferModifierGroup_offer_fkey" FOREIGN KEY ("offerId") REFERENCES "StoreCatalogOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StoreOfferModifierGroup" ADD CONSTRAINT "StoreOfferModifierGroup_group_fkey" FOREIGN KEY ("groupId") REFERENCES "StoreModifierGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogModerationCase" ADD CONSTRAINT "CatalogModerationCase_product_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogModerationCase" ADD CONSTRAINT "CatalogModerationCase_offer_fkey" FOREIGN KEY ("offerId") REFERENCES "StoreCatalogOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogModerationHistory" ADD CONSTRAINT "CatalogModerationHistory_case_fkey" FOREIGN KEY ("caseId") REFERENCES "CatalogModerationCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogDuplicateCandidate" ADD CONSTRAINT "CatalogDuplicateCandidate_source_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogDuplicateCandidate" ADD CONSTRAINT "CatalogDuplicateCandidate_candidate_fkey" FOREIGN KEY ("candidateProductId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogImportJob" ADD CONSTRAINT "CatalogImportJob_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogImportRow" ADD CONSTRAINT "CatalogImportRow_job_fkey" FOREIGN KEY ("jobId") REFERENCES "CatalogImportJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogImportRow" ADD CONSTRAINT "CatalogImportRow_product_fkey" FOREIGN KEY ("resultingProductId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogImportRow" ADD CONSTRAINT "CatalogImportRow_offer_fkey" FOREIGN KEY ("resultingOfferId") REFERENCES "StoreCatalogOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogPublicationSnapshot" ADD CONSTRAINT "CatalogPublicationSnapshot_product_fkey" FOREIGN KEY ("productId") REFERENCES "CatalogProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogPublicationSnapshot" ADD CONSTRAINT "CatalogPublicationSnapshot_variant_fkey" FOREIGN KEY ("variantId") REFERENCES "CatalogProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogPublicationSnapshot" ADD CONSTRAINT "CatalogPublicationSnapshot_offer_fkey" FOREIGN KEY ("offerId") REFERENCES "StoreCatalogOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogCategory" ADD CONSTRAINT "CatalogCategory_imageAsset_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "CatalogMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogBrand" ADD CONSTRAINT "CatalogBrand_logoAsset_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "CatalogMediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogOperationReceipt" ADD CONSTRAINT "CatalogOperationReceipt_actor_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogOperationReceipt" ADD CONSTRAINT "CatalogOperationReceipt_store_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Structural checks.
ALTER TABLE "CatalogCategory" ADD CONSTRAINT "CatalogCategory_depth_check" CHECK ("depth" BETWEEN 0 AND 8);
ALTER TABLE "CatalogCategory" ADD CONSTRAINT "CatalogCategory_version_check" CHECK ("version" > 0);
ALTER TABLE "ProductTypeDefinition" ADD CONSTRAINT "ProductTypeDefinition_versions_check" CHECK ("versionNumber" > 0 AND "schemaVersion" > 0 AND "version" > 0);
ALTER TABLE "ProductTypeDefinition" ADD CONSTRAINT "ProductTypeDefinition_schema_shape_check" CHECK (jsonb_typeof("attributeSchema") = 'object' AND jsonb_typeof("variantSchema") = 'object' AND jsonb_typeof("complianceSchema") = 'object' AND jsonb_typeof("searchFacetSchema") = 'object');
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_scope_check" CHECK (("scope" = 'GLOBAL_CANONICAL' AND "sourceStoreId" IS NULL) OR ("scope" = 'STORE_PRIVATE' AND "sourceStoreId" IS NOT NULL));
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_quality_check" CHECK ("qualityScore" BETWEEN 0 AND 100 AND jsonb_typeof("qualityIssues") = 'array');
ALTER TABLE "CatalogProduct" ADD CONSTRAINT "CatalogProduct_values_shape_check" CHECK (jsonb_typeof("attributeValues") = 'object' AND jsonb_typeof("complianceValues") = 'object');
ALTER TABLE "CatalogProductVariant" ADD CONSTRAINT "CatalogProductVariant_gtin_shape_check" CHECK ("gtin" IS NULL OR ("gtin" ~ '^[0-9]+$' AND length("gtin") IN (8, 12, 13, 14) AND "gtin" !~ '^0+$'));
ALTER TABLE "CatalogProductVariant" ADD CONSTRAINT "CatalogProductVariant_measurements_check" CHECK (("weight" IS NULL OR "weight" > 0) AND ("length" IS NULL OR "length" > 0) AND ("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0));
ALTER TABLE "StoreCatalogOffer" ADD CONSTRAINT "StoreCatalogOffer_quantity_check" CHECK ("quantityStep" > 0 AND "minimumQuantity" > 0 AND ("packagedQuantity" IS NULL OR "packagedQuantity" > 0));
ALTER TABLE "StoreOfferPriceVersion" ADD CONSTRAINT "StoreOfferPriceVersion_money_check" CHECK ("amount" > 0 AND "currency" = 'ZAR' AND "priceIncludesTax" = true AND ("unitPriceAmount" IS NULL OR "unitPriceAmount" > 0) AND ("unitPriceQuantity" IS NULL OR "unitPriceQuantity" > 0));
ALTER TABLE "StoreOfferPriceVersion" ADD CONSTRAINT "StoreOfferPriceVersion_period_check" CHECK ("effectiveUntil" IS NULL OR "effectiveUntil" > "effectiveFrom");
ALTER TABLE "StoreOfferPriceVersion" ADD CONSTRAINT "StoreOfferPriceVersion_no_overlap" EXCLUDE USING gist ("offerId" WITH =, tsrange("effectiveFrom", COALESCE("effectiveUntil", 'infinity'::timestamp), '[)') WITH &&) WHERE ("status" IN ('SCHEDULED', 'ACTIVE'));
ALTER TABLE "CatalogInventoryLevel" ADD CONSTRAINT "CatalogInventoryLevel_projection_check" CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand" AND "available" = "onHand" - "reserved");
ALTER TABLE "CatalogInventoryMovement" ADD CONSTRAINT "CatalogInventoryMovement_result_check" CHECK ("resultingOnHand" >= 0 AND "quantityDelta" <> 0 AND length("operationId") BETWEEN 8 AND 160 AND length("requestHash") BETWEEN 16 AND 128);
ALTER TABLE "CatalogMediaAsset" ADD CONSTRAINT "CatalogMediaAsset_owner_check" CHECK (("ownerType" = 'PLATFORM' AND "ownerStoreId" IS NULL) OR ("ownerType" = 'STORE' AND "ownerStoreId" IS NOT NULL));
ALTER TABLE "CatalogMediaAsset" ADD CONSTRAINT "CatalogMediaAsset_declared_shape_check" CHECK ("declaredByteSize" > 0 AND "declaredByteSize" <= 8388608 AND "declaredMimeType" IN ('image/jpeg', 'image/png', 'image/webp') AND length("storageProvider") BETWEEN 3 AND 40 AND "storageKey" ~ '^catalog-media/[0-9a-f]{64}$' AND "version" > 0);
ALTER TABLE "CatalogMediaAsset" ADD CONSTRAINT "CatalogMediaAsset_validated_shape_check" CHECK (("mimeType" IS NULL OR "mimeType" IN ('image/jpeg', 'image/png', 'image/webp')) AND ("byteSize" IS NULL OR ("byteSize" > 0 AND "byteSize" <= 8388608)) AND ("width" IS NULL OR "width" > 0) AND ("height" IS NULL OR "height" > 0) AND ("checksum" IS NULL OR "checksum" ~ '^[0-9a-f]{64}$'));
ALTER TABLE "CatalogMediaAsset" ADD CONSTRAINT "CatalogMediaAsset_ready_evidence_check" CHECK ("status" <> 'READY' OR ("storageConfirmedAt" IS NOT NULL AND "validatedAt" IS NOT NULL AND "mimeType" IS NOT NULL AND "byteSize" IS NOT NULL AND "width" IS NOT NULL AND "height" IS NOT NULL AND "checksum" IS NOT NULL AND "privacyInspectionPassed" = true));
ALTER TABLE "CatalogMediaAsset" ADD CONSTRAINT "CatalogMediaAsset_reason_check" CHECK (("status" <> 'QUARANTINED' OR "quarantineReasonCode" IS NOT NULL) AND ("status" <> 'REJECTED' OR "rejectionReasonCode" IS NOT NULL));
ALTER TABLE "CatalogMediaUploadIntent" ADD CONSTRAINT "CatalogMediaUploadIntent_owner_check" CHECK (("ownerType" = 'PLATFORM' AND "ownerStoreId" IS NULL) OR ("ownerType" = 'STORE' AND "ownerStoreId" IS NOT NULL));
ALTER TABLE "CatalogMediaUploadIntent" ADD CONSTRAINT "CatalogMediaUploadIntent_shape_check" CHECK ("expectedMimeType" IN ('image/jpeg', 'image/png', 'image/webp') AND "expectedByteSize" > 0 AND "maximumBytes" > 0 AND "expectedByteSize" <= "maximumBytes" AND "maximumBytes" <= 8388608 AND length("operationId") BETWEEN 8 AND 160 AND "requestHash" ~ '^[0-9a-f]{64}$' AND "storageKey" ~ '^catalog-media/[0-9a-f]{64}$' AND "expiresAt" > "createdAt" AND "expiresAt" <= "createdAt" + INTERVAL '30 minutes' AND "completionCount" BETWEEN 0 AND 1 AND (("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "completionCount" = 1) OR ("status" <> 'COMPLETED' AND "completionCount" = 0)));
ALTER TABLE "CatalogProductMedia" ADD CONSTRAINT "CatalogProductMedia_alt_check" CHECK (length(btrim("altText")) BETWEEN 1 AND 240);
ALTER TABLE "StoreModifierGroup" ADD CONSTRAINT "StoreModifierGroup_selection_check" CHECK ("minimumSelections" >= 0 AND "maximumSelections" > 0 AND "minimumSelections" <= "maximumSelections" AND (NOT "isRequired" OR "minimumSelections" >= 1));
ALTER TABLE "StoreModifierOption" ADD CONSTRAINT "StoreModifierOption_money_check" CHECK ("priceDelta" >= 0 AND "currency" = 'ZAR');
ALTER TABLE "CatalogModerationCase" ADD CONSTRAINT "CatalogModerationCase_subject_check" CHECK (num_nonnulls("productId", "offerId") = 1 AND length("safeSummary") BETWEEN 1 AND 500);
ALTER TABLE "CatalogDuplicateCandidate" ADD CONSTRAINT "CatalogDuplicateCandidate_distinct_check" CHECK ("sourceProductId" <> "candidateProductId");
ALTER TABLE "CatalogImportJob" ADD CONSTRAINT "CatalogImportJob_counts_check" CHECK ("templateVersion" > 0 AND "totalRows" >= 0 AND "validRows" >= 0 AND "invalidRows" >= 0 AND "validRows" + "invalidRows" <= "totalRows");
ALTER TABLE "CatalogImportRow" ADD CONSTRAINT "CatalogImportRow_shape_check" CHECK ("rowNumber" > 0 AND jsonb_typeof("normalizedPayload") = 'object' AND jsonb_typeof("errorCodes") = 'array');
ALTER TABLE "CatalogOperationReceipt" ADD CONSTRAINT "CatalogOperationReceipt_shape_check" CHECK (length("operationId") BETWEEN 8 AND 160 AND length("requestHash") BETWEEN 16 AND 128 AND length("action") BETWEEN 3 AND 100);

-- Category paths and ancestry are deterministic and cycle-safe.
CREATE FUNCTION catalog_category_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_row "CatalogCategory"%ROWTYPE;
BEGIN
  NEW."slug" := lower(btrim(NEW."slug"));
  IF NEW."slug" !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'INVALID_CATALOG_CATEGORY_SLUG';
  END IF;
  IF NEW."parentId" IS NULL THEN
    NEW."depth" := 0;
    NEW."path" := '/' || NEW."slug";
  ELSE
    IF NEW."parentId" = NEW."id" THEN RAISE EXCEPTION 'CATALOG_CATEGORY_CYCLE'; END IF;
    SELECT * INTO parent_row FROM "CatalogCategory" WHERE "id" = NEW."parentId" FOR SHARE;
    IF NOT FOUND OR parent_row."status" = 'ARCHIVED' THEN
      RAISE EXCEPTION 'INVALID_CATALOG_CATEGORY_ANCESTRY';
    END IF;
    IF TG_OP = 'UPDATE' AND EXISTS (
      WITH RECURSIVE descendants AS (
        SELECT "id" FROM "CatalogCategory" WHERE "parentId" = NEW."id"
        UNION ALL
        SELECT c."id" FROM "CatalogCategory" c JOIN descendants d ON c."parentId" = d."id"
      ) SELECT 1 FROM descendants WHERE "id" = NEW."parentId"
    ) THEN
      RAISE EXCEPTION 'CATALOG_CATEGORY_CYCLE';
    END IF;
    NEW."depth" := parent_row."depth" + 1;
    NEW."path" := parent_row."path" || '/' || NEW."slug";
  END IF;
  IF NEW."depth" > 8 THEN RAISE EXCEPTION 'CATALOG_CATEGORY_DEPTH_EXCEEDED'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CatalogCategory_guard" BEFORE INSERT OR UPDATE OF "parentId", "slug", "status" ON "CatalogCategory" FOR EACH ROW EXECUTE FUNCTION catalog_category_guard();

CREATE FUNCTION catalog_category_descendant_paths() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 OR (NEW."path" = OLD."path" AND NEW."depth" = OLD."depth") THEN RETURN NEW; END IF;
  UPDATE "CatalogCategory"
     SET "path" = NEW."path" || substring("path" FROM length(OLD."path") + 1),
         "depth" = "depth" + (NEW."depth" - OLD."depth")
   WHERE "path" LIKE OLD."path" || '/%';
  RETURN NEW;
END $$;
CREATE TRIGGER "CatalogCategory_descendant_paths" AFTER UPDATE OF "path", "depth" ON "CatalogCategory" FOR EACH ROW EXECUTE FUNCTION catalog_category_descendant_paths();

CREATE FUNCTION catalog_product_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE category_status "CatalogCategoryStatus";
DECLARE definition_version INTEGER;
BEGIN
  SELECT "status" INTO category_status FROM "CatalogCategory" WHERE "id" = NEW."primaryCategoryId";
  IF category_status = 'ARCHIVED' THEN RAISE EXCEPTION 'ARCHIVED_CATEGORY_REJECTS_PRODUCTS'; END IF;
  SELECT "versionNumber" INTO definition_version FROM "ProductTypeDefinition" WHERE "id" = NEW."productTypeDefinitionId";
  IF definition_version IS DISTINCT FROM NEW."productTypeVersionNumber" THEN RAISE EXCEPTION 'PRODUCT_TYPE_VERSION_MISMATCH'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CatalogProduct_guard" BEFORE INSERT OR UPDATE OF "primaryCategoryId", "productTypeDefinitionId", "productTypeVersionNumber" ON "CatalogProduct" FOR EACH ROW EXECUTE FUNCTION catalog_product_guard();

CREATE FUNCTION catalog_active_product_readiness() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."status" = 'ACTIVE' AND (
    NEW."moderationStatus" <> 'APPROVED' OR NEW."publicationStatus" <> 'PUBLISHED'
    OR NOT EXISTS (SELECT 1 FROM "CatalogProductVariant" v WHERE v."productId"=NEW."id" AND v."status"<>'ARCHIVED')
    OR NOT EXISTS (SELECT 1 FROM "CatalogCategory" c WHERE c."id"=NEW."primaryCategoryId" AND c."status"='ACTIVE')
    OR NOT EXISTS (SELECT 1 FROM "ProductTypeDefinition" t WHERE t."id"=NEW."productTypeDefinitionId" AND t."status"='ACTIVE')
  ) THEN RAISE EXCEPTION 'ACTIVE_PRODUCT_NOT_READY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CatalogProduct_active_readiness" BEFORE INSERT OR UPDATE OF "status", "moderationStatus", "publicationStatus" ON "CatalogProduct" FOR EACH ROW EXECUTE FUNCTION catalog_active_product_readiness();

CREATE FUNCTION catalog_active_offer_readiness() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "CatalogProductVariant" v WHERE v."id"=NEW."variantId" AND v."productId"=NEW."productId" AND v."status"<>'ARCHIVED') THEN RAISE EXCEPTION 'OFFER_PRODUCT_VARIANT_MISMATCH'; END IF;
  IF NEW."primaryInventoryLocationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "InventoryLocation" l WHERE l."id"=NEW."primaryInventoryLocationId" AND l."storeId"=NEW."storeId") THEN RAISE EXCEPTION 'OFFER_LOCATION_STORE_MISMATCH'; END IF;
  IF NEW."status" = 'ACTIVE' AND (
    NEW."publicationStatus" <> 'PUBLISHED'
    OR NOT EXISTS (SELECT 1 FROM "CatalogProduct" p WHERE p."id"=NEW."productId" AND p."status"='ACTIVE' AND p."moderationStatus"='APPROVED')
    OR NEW."currentPriceVersionId" IS NULL
    OR NOT EXISTS (SELECT 1 FROM "StoreOfferPriceVersion" p WHERE p."id"=NEW."currentPriceVersionId" AND p."offerId"=NEW."id" AND p."status"='ACTIVE')
  ) THEN RAISE EXCEPTION 'ACTIVE_OFFER_NOT_READY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "StoreCatalogOffer_active_readiness" BEFORE INSERT OR UPDATE OF "status", "publicationStatus", "productId", "variantId", "storeId", "primaryInventoryLocationId", "currentPriceVersionId" ON "StoreCatalogOffer" FOR EACH ROW EXECUTE FUNCTION catalog_active_offer_readiness();

-- Active product-type schemas and active price evidence are immutable.
CREATE FUNCTION catalog_active_definition_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."status" = 'ACTIVE' AND (NEW."attributeSchema" IS DISTINCT FROM OLD."attributeSchema" OR NEW."variantSchema" IS DISTINCT FROM OLD."variantSchema" OR NEW."complianceSchema" IS DISTINCT FROM OLD."complianceSchema" OR NEW."searchFacetSchema" IS DISTINCT FROM OLD."searchFacetSchema" OR NEW."schemaVersion" IS DISTINCT FROM OLD."schemaVersion") THEN
    RAISE EXCEPTION 'ACTIVE_PRODUCT_TYPE_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "ProductTypeDefinition_active_immutable" BEFORE UPDATE ON "ProductTypeDefinition" FOR EACH ROW EXECUTE FUNCTION catalog_active_definition_immutable();

CREATE FUNCTION catalog_active_price_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" = 'ACTIVE' THEN RAISE EXCEPTION 'ACTIVE_PRICE_IMMUTABLE'; END IF;
  IF OLD."status" = 'ACTIVE' AND (
    NEW."offerId" IS DISTINCT FROM OLD."offerId" OR NEW."versionNumber" IS DISTINCT FROM OLD."versionNumber"
    OR NEW."amount" IS DISTINCT FROM OLD."amount" OR NEW."currency" IS DISTINCT FROM OLD."currency"
    OR NEW."priceIncludesTax" IS DISTINCT FROM OLD."priceIncludesTax" OR NEW."unitPriceAmount" IS DISTINCT FROM OLD."unitPriceAmount"
    OR NEW."unitPriceUnit" IS DISTINCT FROM OLD."unitPriceUnit" OR NEW."unitPriceQuantity" IS DISTINCT FROM OLD."unitPriceQuantity"
    OR NEW."effectiveFrom" IS DISTINCT FROM OLD."effectiveFrom" OR NEW."effectiveUntil" IS DISTINCT FROM OLD."effectiveUntil"
    OR NEW."status" NOT IN ('ACTIVE','RETIRED') OR NEW."reasonCode" IS DISTINCT FROM OLD."reasonCode"
    OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId" OR NEW."activatedByUserId" IS DISTINCT FROM OLD."activatedByUserId"
    OR NEW."activatedAt" IS DISTINCT FROM OLD."activatedAt" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  ) THEN RAISE EXCEPTION 'ACTIVE_PRICE_IMMUTABLE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "StoreOfferPriceVersion_active_immutable" BEFORE UPDATE OR DELETE ON "StoreOfferPriceVersion" FOR EACH ROW EXECUTE FUNCTION catalog_active_price_immutable();

-- Media storage identity and ownership become immutable after trust or attachment.
CREATE FUNCTION catalog_media_asset_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attached BOOLEAN;
BEGIN
  attached := EXISTS (SELECT 1 FROM "CatalogProductMedia" WHERE "assetId" = OLD."id")
    OR EXISTS (SELECT 1 FROM "CatalogProductOptionValue" WHERE "mediaAssetId" = OLD."id")
    OR EXISTS (SELECT 1 FROM "CatalogCategory" WHERE "imageAssetId" = OLD."id")
    OR EXISTS (SELECT 1 FROM "CatalogBrand" WHERE "logoAssetId" = OLD."id");
  IF TG_OP = 'DELETE' THEN
    IF attached THEN RAISE EXCEPTION 'ATTACHED_CATALOG_MEDIA_IMMUTABLE'; END IF;
    RETURN OLD;
  END IF;
  IF (OLD."status" = 'READY' OR attached) AND (NEW."ownerType" IS DISTINCT FROM OLD."ownerType" OR NEW."ownerStoreId" IS DISTINCT FROM OLD."ownerStoreId") THEN
    RAISE EXCEPTION 'CATALOG_MEDIA_OWNER_IMMUTABLE';
  END IF;
  IF NEW."purpose" IS DISTINCT FROM OLD."purpose" OR NEW."declaredMimeType" IS DISTINCT FROM OLD."declaredMimeType" OR NEW."declaredByteSize" IS DISTINCT FROM OLD."declaredByteSize" OR NEW."storageProvider" IS DISTINCT FROM OLD."storageProvider" THEN
    RAISE EXCEPTION 'CATALOG_MEDIA_DECLARATION_IMMUTABLE';
  END IF;
  IF OLD."status" <> 'PENDING_UPLOAD' AND NEW."storageKey" IS DISTINCT FROM OLD."storageKey" THEN
    RAISE EXCEPTION 'CATALOG_MEDIA_STORAGE_KEY_IMMUTABLE';
  END IF;
  IF OLD."checksum" IS NOT NULL AND NEW."checksum" IS DISTINCT FROM OLD."checksum" THEN
    RAISE EXCEPTION 'CATALOG_MEDIA_CHECKSUM_IMMUTABLE';
  END IF;
  IF OLD."status" = 'READY' AND (NEW."mimeType" IS DISTINCT FROM OLD."mimeType" OR NEW."byteSize" IS DISTINCT FROM OLD."byteSize" OR NEW."width" IS DISTINCT FROM OLD."width" OR NEW."height" IS DISTINCT FROM OLD."height" OR NEW."privacyInspectionPassed" IS DISTINCT FROM OLD."privacyInspectionPassed" OR NEW."validationSummary" IS DISTINCT FROM OLD."validationSummary" OR NEW."storageConfirmedAt" IS DISTINCT FROM OLD."storageConfirmedAt" OR NEW."validatedAt" IS DISTINCT FROM OLD."validatedAt") THEN
    RAISE EXCEPTION 'READY_CATALOG_MEDIA_EVIDENCE_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CatalogMediaAsset_guard" BEFORE UPDATE OR DELETE ON "CatalogMediaAsset" FOR EACH ROW EXECUTE FUNCTION catalog_media_asset_guard();

CREATE FUNCTION catalog_media_upload_intent_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset_owner "CatalogMediaOwnerType"; asset_store TEXT; asset_storage TEXT; asset_purpose "CatalogMediaPurpose";
BEGIN
  SELECT "ownerType", "ownerStoreId", "storageKey", "purpose" INTO asset_owner, asset_store, asset_storage, asset_purpose FROM "CatalogMediaAsset" WHERE "id" = NEW."assetId";
  IF asset_owner IS DISTINCT FROM NEW."ownerType" OR asset_store IS DISTINCT FROM NEW."ownerStoreId" OR asset_storage IS DISTINCT FROM NEW."storageKey" OR asset_purpose IS DISTINCT FROM NEW."purpose" THEN
    RAISE EXCEPTION 'CATALOG_MEDIA_INTENT_OWNER_MISMATCH';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW."ownerType" IS DISTINCT FROM OLD."ownerType" OR NEW."ownerStoreId" IS DISTINCT FROM OLD."ownerStoreId"
    OR NEW."assetId" IS DISTINCT FROM OLD."assetId" OR NEW."operationId" IS DISTINCT FROM OLD."operationId"
    OR NEW."requestHash" IS DISTINCT FROM OLD."requestHash" OR NEW."storageKey" IS DISTINCT FROM OLD."storageKey"
    OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId" OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt"
  ) THEN RAISE EXCEPTION 'CATALOG_MEDIA_INTENT_IDENTITY_IMMUTABLE'; END IF;
  IF NEW."status" = 'COMPLETED' AND NEW."expiresAt" <= CURRENT_TIMESTAMP THEN RAISE EXCEPTION 'CATALOG_MEDIA_INTENT_EXPIRED'; END IF;
  IF TG_OP = 'UPDATE' AND OLD."completionCount" = 1 AND NEW."completionCount" IS DISTINCT FROM OLD."completionCount" THEN RAISE EXCEPTION 'CATALOG_MEDIA_INTENT_ALREADY_COMPLETED'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CatalogMediaUploadIntent_guard" BEFORE INSERT OR UPDATE ON "CatalogMediaUploadIntent" FOR EACH ROW EXECUTE FUNCTION catalog_media_upload_intent_guard();

CREATE FUNCTION catalog_product_media_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset_status "CatalogMediaAssetStatus"; asset_owner "CatalogMediaOwnerType"; asset_store TEXT; asset_purpose "CatalogMediaPurpose"; product_scope "CatalogProductScope"; product_store TEXT;
BEGIN
  SELECT "status", "ownerType", "ownerStoreId" INTO asset_status, asset_owner, asset_store FROM "CatalogMediaAsset" WHERE "id" = NEW."assetId";
  SELECT "purpose" INTO asset_purpose FROM "CatalogMediaAsset" WHERE "id" = NEW."assetId";
  SELECT "scope", "sourceStoreId" INTO product_scope, product_store FROM "CatalogProduct" WHERE "id" = NEW."productId";
  IF asset_status IS DISTINCT FROM 'READY' THEN RAISE EXCEPTION 'CATALOG_MEDIA_NOT_READY'; END IF;
  IF product_scope = 'GLOBAL_CANONICAL' AND (asset_owner <> 'PLATFORM' OR asset_store IS NOT NULL) THEN RAISE EXCEPTION 'CANONICAL_MEDIA_REQUIRES_PLATFORM_OWNER'; END IF;
  IF product_scope = 'STORE_PRIVATE' AND (asset_owner <> 'STORE' OR asset_store IS DISTINCT FROM product_store) THEN RAISE EXCEPTION 'STORE_MEDIA_OWNER_MISMATCH'; END IF;
  IF NEW."variantId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CatalogProductVariant" WHERE "id" = NEW."variantId" AND "productId" = NEW."productId") THEN RAISE EXCEPTION 'CATALOG_MEDIA_VARIANT_MISMATCH'; END IF;
  IF NEW."role" = 'VARIANT' AND NEW."variantId" IS NULL THEN RAISE EXCEPTION 'VARIANT_MEDIA_REQUIRES_VARIANT'; END IF;
  IF (NEW."role" IN ('PRIMARY','GALLERY','LABEL') AND asset_purpose IS DISTINCT FROM 'PRODUCT_IMAGE') OR (NEW."role" IN ('VARIANT','SWATCH') AND asset_purpose IS DISTINCT FROM 'VARIANT_IMAGE') OR NEW."role" = 'COMPLIANCE_DOCUMENT' THEN RAISE EXCEPTION 'CATALOG_MEDIA_PURPOSE_ROLE_MISMATCH'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CatalogProductMedia_guard" BEFORE INSERT OR UPDATE OF "productId", "variantId", "assetId", "role" ON "CatalogProductMedia" FOR EACH ROW EXECUTE FUNCTION catalog_product_media_guard();

CREATE FUNCTION catalog_platform_media_reference_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset_id TEXT; asset_status "CatalogMediaAssetStatus"; asset_owner "CatalogMediaOwnerType"; asset_purpose "CatalogMediaPurpose"; expected_purpose "CatalogMediaPurpose";
BEGIN
  asset_id := CASE WHEN TG_TABLE_NAME = 'CatalogCategory' THEN to_jsonb(NEW)->>'imageAssetId' ELSE to_jsonb(NEW)->>'logoAssetId' END;
  expected_purpose := CASE WHEN TG_TABLE_NAME = 'CatalogCategory' THEN 'CATEGORY_IMAGE'::"CatalogMediaPurpose" ELSE 'BRAND_LOGO'::"CatalogMediaPurpose" END;
  IF asset_id IS NULL THEN RETURN NEW; END IF;
  SELECT "status", "ownerType" INTO asset_status, asset_owner FROM "CatalogMediaAsset" WHERE "id" = asset_id;
  SELECT "purpose" INTO asset_purpose FROM "CatalogMediaAsset" WHERE "id" = asset_id;
  IF asset_status IS DISTINCT FROM 'READY' OR asset_owner IS DISTINCT FROM 'PLATFORM' OR asset_purpose IS DISTINCT FROM expected_purpose THEN RAISE EXCEPTION 'PLATFORM_MEDIA_REFERENCE_NOT_READY'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CatalogCategory_media_guard" BEFORE INSERT OR UPDATE OF "imageAssetId" ON "CatalogCategory" FOR EACH ROW EXECUTE FUNCTION catalog_platform_media_reference_guard();
CREATE TRIGGER "CatalogBrand_media_guard" BEFORE INSERT OR UPDATE OF "logoAssetId" ON "CatalogBrand" FOR EACH ROW EXECUTE FUNCTION catalog_platform_media_reference_guard();

CREATE FUNCTION catalog_option_media_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset_status "CatalogMediaAssetStatus"; asset_owner "CatalogMediaOwnerType"; asset_store TEXT; asset_purpose "CatalogMediaPurpose"; product_scope "CatalogProductScope"; product_store TEXT;
BEGIN
  IF NEW."mediaAssetId" IS NULL THEN RETURN NEW; END IF;
  SELECT a."status", a."ownerType", a."ownerStoreId", p."scope", p."sourceStoreId" INTO asset_status, asset_owner, asset_store, product_scope, product_store
    FROM "CatalogMediaAsset" a CROSS JOIN "CatalogProductOption" o JOIN "CatalogProduct" p ON p."id" = o."productId"
   WHERE a."id" = NEW."mediaAssetId" AND o."id" = NEW."optionId";
  IF asset_status IS DISTINCT FROM 'READY' THEN RAISE EXCEPTION 'CATALOG_MEDIA_NOT_READY'; END IF;
  SELECT "purpose" INTO asset_purpose FROM "CatalogMediaAsset" WHERE "id" = NEW."mediaAssetId";
  IF asset_purpose IS DISTINCT FROM 'VARIANT_IMAGE' THEN RAISE EXCEPTION 'CATALOG_MEDIA_PURPOSE_ROLE_MISMATCH'; END IF;
  IF product_scope = 'GLOBAL_CANONICAL' AND asset_owner <> 'PLATFORM' THEN RAISE EXCEPTION 'CANONICAL_MEDIA_REQUIRES_PLATFORM_OWNER'; END IF;
  IF product_scope = 'STORE_PRIVATE' AND (asset_owner <> 'STORE' OR asset_store IS DISTINCT FROM product_store) THEN RAISE EXCEPTION 'STORE_MEDIA_OWNER_MISMATCH'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CatalogProductOptionValue_media_guard" BEFORE INSERT OR UPDATE OF "optionId", "mediaAssetId" ON "CatalogProductOptionValue" FOR EACH ROW EXECUTE FUNCTION catalog_option_media_guard();

CREATE FUNCTION catalog_inventory_projection_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE item_id TEXT; location_id TEXT; level_on_hand INTEGER; movement_on_hand INTEGER;
BEGIN
  item_id := COALESCE(NEW."inventoryItemId", OLD."inventoryItemId");
  location_id := COALESCE(NEW."locationId", OLD."locationId");
  SELECT "onHand" INTO level_on_hand FROM "CatalogInventoryLevel" WHERE "inventoryItemId"=item_id AND "locationId"=location_id;
  SELECT "resultingOnHand" INTO movement_on_hand FROM "CatalogInventoryMovement" WHERE "inventoryItemId"=item_id AND "locationId"=location_id ORDER BY "createdAt" DESC, "id" DESC LIMIT 1;
  IF level_on_hand IS NOT NULL AND level_on_hand<>0 AND movement_on_hand IS DISTINCT FROM level_on_hand THEN RAISE EXCEPTION 'INVENTORY_PROJECTION_WITHOUT_MOVEMENT_EVIDENCE'; END IF;
  RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER "CatalogInventoryLevel_evidence" AFTER INSERT OR UPDATE ON "CatalogInventoryLevel" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION catalog_inventory_projection_evidence();
CREATE CONSTRAINT TRIGGER "CatalogInventoryMovement_projection" AFTER INSERT ON "CatalogInventoryMovement" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION catalog_inventory_projection_evidence();

-- Runtime evidence is append-only. CatalogChangeEvent may only mark processedAt.
CREATE FUNCTION catalog_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'CATALOG_EVIDENCE_IMMUTABLE';
END $$;
CREATE TRIGGER "CatalogInventoryMovement_immutable" BEFORE UPDATE OR DELETE ON "CatalogInventoryMovement" FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER "CatalogModerationHistory_immutable" BEFORE UPDATE OR DELETE ON "CatalogModerationHistory" FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER "CatalogPublicationSnapshot_immutable" BEFORE UPDATE OR DELETE ON "CatalogPublicationSnapshot" FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER "CatalogAuditHistory_immutable" BEFORE UPDATE OR DELETE ON "CatalogAuditHistory" FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER "CatalogOperationReceipt_immutable" BEFORE UPDATE OR DELETE ON "CatalogOperationReceipt" FOR EACH ROW EXECUTE FUNCTION catalog_append_only();
CREATE TRIGGER "CatalogMediaHistory_immutable" BEFORE UPDATE OR DELETE ON "CatalogMediaHistory" FOR EACH ROW EXECUTE FUNCTION catalog_append_only();

CREATE FUNCTION catalog_change_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR NEW."id" <> OLD."id" OR NEW."publicReference" <> OLD."publicReference" OR NEW."aggregateType" <> OLD."aggregateType" OR NEW."aggregateReference" <> OLD."aggregateReference" OR NEW."eventType" <> OLD."eventType" OR NEW."aggregateVersion" <> OLD."aggregateVersion" OR NEW."payload" <> OLD."payload" OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'CATALOG_EVENT_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "CatalogChangeEvent_guard" BEFORE UPDATE OR DELETE ON "CatalogChangeEvent" FOR EACH ROW EXECUTE FUNCTION catalog_change_event_guard();
