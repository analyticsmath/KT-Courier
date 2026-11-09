-- An unseeded but fully migrated production database must still expose the
-- parcel VAT switch for authorized administrative management.
-- Existing owner decisions and historical quotes/orders are never changed.
INSERT INTO "SystemSetting" ("id", "key", "label", "type", "value", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'pricing.vat.enabled', 'Parcel delivery VAT enabled', 'BOOLEAN', 'false'::jsonb, NOW(), NOW()),
  (gen_random_uuid()::text, 'pricing.vat.rate', 'Parcel delivery VAT rate', 'NUMBER', '0.15'::jsonb, NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
