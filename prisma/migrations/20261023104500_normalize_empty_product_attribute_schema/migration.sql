-- Active definitions are immutable. Add structurally valid successor versions
-- for legacy empty schemas; keep historical products and their definitions intact.
WITH legacy AS (
  SELECT DISTINCT ON (p.code) p.*
  FROM "ProductTypeDefinition" p
  WHERE p.status = 'ACTIVE' AND p."attributeSchema" = '{}'::jsonb
    AND NOT EXISTS (SELECT 1 FROM "ProductTypeDefinition" compatible
      WHERE compatible.code = p.code AND compatible.status IN ('ACTIVE', 'APPROVED')
        AND jsonb_typeof(compatible."attributeSchema"->'attributes') = 'array')
  ORDER BY p.code, p."versionNumber" DESC
)
INSERT INTO "ProductTypeDefinition" (
  id, "publicReference", code, name, description, "versionNumber", status,
  "schemaVersion", "attributeSchema", "variantSchema", "complianceSchema", "searchFacetSchema",
  "createdByUserId", "submittedByUserId", "approvedByUserId", "activatedAt",
  "supersedesDefinitionId", version, "createdAt", "updatedAt"
)
SELECT 'ptd-structure-' || md5(p.id), 'PTD-STRUCTURE-' || md5(p.id), p.code, p.name,
  p.description, (SELECT MAX(v."versionNumber") + 1 FROM "ProductTypeDefinition" v WHERE v.code = p.code),
  'ACTIVE', p."schemaVersion" + 1, '{"attributes":[]}'::jsonb,
  p."variantSchema", p."complianceSchema", p."searchFacetSchema", p."createdByUserId",
  p."submittedByUserId", p."approvedByUserId", CURRENT_TIMESTAMP, p.id, 1,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM legacy p
ON CONFLICT DO NOTHING;

INSERT INTO "CatalogCategoryProductType" ("categoryId", "productTypeDefinitionId", "isPrimary", "displayOrder", "createdAt")
SELECT mapping."categoryId", successor.id, mapping."isPrimary", mapping."displayOrder", CURRENT_TIMESTAMP
FROM "ProductTypeDefinition" successor
JOIN "CatalogCategoryProductType" mapping ON mapping."productTypeDefinitionId" = successor."supersedesDefinitionId"
WHERE successor.id = 'ptd-structure-' || md5(successor."supersedesDefinitionId")
ON CONFLICT DO NOTHING;
