-- Add independently managed marketplace courier VAT. Both switches remain
-- disabled until the owner explicitly enables one in administrative settings.
-- Never mutate historical orders, quotes or their immutable tax snapshots.
INSERT INTO "SystemSetting" ("id", "key", "label", "type", "value", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'pricing.marketplace_vat.enabled', 'Marketplace delivery VAT enabled', 'BOOLEAN', 'false'::jsonb, NOW(), NOW()),
  (gen_random_uuid()::text, 'pricing.marketplace_vat.rate', 'Marketplace delivery VAT rate', 'NUMBER', '0.15'::jsonb, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
