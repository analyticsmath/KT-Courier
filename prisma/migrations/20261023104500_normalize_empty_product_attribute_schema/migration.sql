-- Legacy import/seed wrote {} for types with no attributes. Preserve that
-- meaning in the canonical schema shape; never touch a configured schema.
UPDATE "ProductTypeDefinition"
SET "attributeSchema" = '{"attributes":[]}'::jsonb,
    "version" = "version" + 1,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "attributeSchema" = '{}'::jsonb;
