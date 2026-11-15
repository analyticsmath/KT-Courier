-- Additive, backward-compatible, idempotent migration for vendor readiness revisioning
-- and real-source store checkout capability proof metadata.

ALTER TABLE "Store"
  ADD COLUMN IF NOT EXISTS "commerceReadinessRevision" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "StoreCheckoutCertification"
  ADD COLUMN IF NOT EXISTS "sourceCommerceReadinessRevision" INTEGER,
  ADD COLUMN IF NOT EXISTS "globalPolicyRevision" INTEGER,
  ADD COLUMN IF NOT EXISTS "proofOfferReference" TEXT,
  ADD COLUMN IF NOT EXISTS "proofPriceVersionReference" TEXT,
  ADD COLUMN IF NOT EXISTS "proofMetadata" JSONB;

CREATE INDEX IF NOT EXISTS "StoreCheckoutCertification_storeId_status_expiresAt_idx"
  ON "StoreCheckoutCertification"("storeId", "status", "expiresAt");

ALTER TABLE "StoreOfferPriceVersion" DROP CONSTRAINT IF EXISTS "StoreOfferPriceVersion_money_check";
ALTER TABLE "StoreOfferPriceVersion"
  ADD CONSTRAINT "StoreOfferPriceVersion_money_check" CHECK (
    "amount" > 0
    AND "currency" = 'ZAR'
    AND ("unitPriceAmount" IS NULL OR "unitPriceAmount" > 0)
    AND ("unitPriceQuantity" IS NULL OR "unitPriceQuantity" > 0)
  );

ALTER TABLE "StorefrontProductDocument" DROP CONSTRAINT IF EXISTS "StorefrontProductDocument_source_shape_check";
ALTER TABLE "StorefrontProductDocument"
  ADD CONSTRAINT "StorefrontProductDocument_source_shape_check" CHECK (
    length("publicationVersion") BETWEEN 16 AND 128
    AND length("title") BETWEEN 1 AND 300
    AND length("searchText") BETWEEN 1 AND 10000
    AND "productTypeVersion" > 0
    AND "projectionVersion" > 0
    AND "priceAmount" > 0
    AND "currency" = 'ZAR'
    AND ("unitPriceAmount" IS NULL OR "unitPriceAmount" > 0)
    AND ("unitPriceQuantity" IS NULL OR "unitPriceQuantity" > 0)
    AND ("primaryMediaPublicReference" IS NULL OR "primaryMediaPublicReference" !~ '/')
    AND ("primaryMediaWidth" IS NULL OR "primaryMediaWidth" > 0)
    AND ("primaryMediaHeight" IS NULL OR "primaryMediaHeight" > 0)
    AND jsonb_typeof("searchableAttributes") = 'object'
    AND jsonb_typeof("filterableAttributes") = 'object'
    AND jsonb_typeof("variantOptions") = 'object'
  );

INSERT INTO "SystemSetting" ("id", "key", "label", "type", "value", "description", "createdAt", "updatedAt")
VALUES (
  'sys-platform-commerce-readiness-revision',
  'platform.commerce_readiness_revision',
  'Platform Commerce Readiness Policy Revision',
  'JSON'::"SystemSettingType",
  '{"version": 1}'::jsonb,
  'Monotonically incremented revision for global delivery, parcel, tax, payment, and operational policies affecting store checkout certification parity.',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
