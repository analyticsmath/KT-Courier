-- Forward-only Schema Alignment Migration: 20260805050000_final_schema_alignment
-- Eliminates residual database-to-Prisma schema drift.

-- 1. Remove un-navigated foreign key constraints on CatalogCategory (createdByUserId, updatedByUserId)
-- CatalogCategory stores scalar actor identifiers; user relations are intentionally absent to preserve independent audit evidence and avoid blocking user deletion/anonymization.
ALTER TABLE "CatalogCategory" DROP CONSTRAINT IF EXISTS "CatalogCategory_createdByUserId_fkey";
ALTER TABLE "CatalogCategory" DROP CONSTRAINT IF EXISTS "CatalogCategory_updatedByUserId_fkey";

-- 2. Add missing indexes with preflight checks
CREATE INDEX IF NOT EXISTS "CatalogAuditHistory_aggregateType_aggregateReference_createdAt_idx"
  ON "CatalogAuditHistory"("aggregateType", "aggregateReference", "createdAt");

CREATE INDEX IF NOT EXISTS "CatalogAuditHistory_actorUserId_createdAt_idx"
  ON "CatalogAuditHistory"("actorUserId", "createdAt");

CREATE INDEX IF NOT EXISTS "CatalogBrand_status_name_idx"
  ON "CatalogBrand"("status", "name");

CREATE INDEX IF NOT EXISTS "CatalogCategoryProductType_categoryId_isPrimary_idx"
  ON "CatalogCategoryProductType"("categoryId", "isPrimary");

CREATE INDEX IF NOT EXISTS "CatalogChangeEvent_processedAt_createdAt_idx"
  ON "CatalogChangeEvent"("processedAt", "createdAt");

CREATE INDEX IF NOT EXISTS "CatalogChangeEvent_aggregateType_aggregateReference_idx"
  ON "CatalogChangeEvent"("aggregateType", "aggregateReference");
