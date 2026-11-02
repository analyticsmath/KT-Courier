-- The 2 November 2026 client brief requires parcel-delivery VAT to be off for now.
-- This changes only the active setting; already-created order pricing snapshots remain immutable.
UPDATE "SystemSetting"
SET "value" = 'false'::jsonb,
    "updatedAt" = NOW()
WHERE "key" = 'pricing.vat.enabled'
  AND "type" = 'BOOLEAN'
  AND "value" IS DISTINCT FROM 'false'::jsonb;
