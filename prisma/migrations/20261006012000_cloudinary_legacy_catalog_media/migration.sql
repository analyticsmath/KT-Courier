BEGIN;
-- Preserve the canonical hash-key rule and admit only verified legacy Cloudinary declarations.
-- Ownership, READY evidence, immutable declarations/checksums and association guards remain in force.
ALTER TABLE "CatalogMediaAsset" DROP CONSTRAINT "CatalogMediaAsset_declared_shape_check";
ALTER TABLE "CatalogMediaAsset" ADD CONSTRAINT "CatalogMediaAsset_declared_shape_check" CHECK (
  "declaredByteSize" > 0 AND "declaredByteSize" <= 8388608
  AND "declaredMimeType" IN ('image/jpeg', 'image/png', 'image/webp')
  AND length("storageProvider") BETWEEN 3 AND 40
  AND "version" > 0
  AND (
    "storageKey" ~ '^catalog-media/[0-9a-f]{64}$'
    OR (
      "storageProvider" = 'CLOUDINARY'
      AND "declaredMimeType" = 'image/webp'
      AND "publicReference" ~ '^LEG6-MEDIA-[A-Z-]+-[0-9]+-[0-9]+$'
      AND (
        ("purpose" = 'PRODUCT_IMAGE' AND "storageKey" ~ '^catalog-media/legacy-6ammart/product/product-[0-9]+-[0-9a-f]{16}[.]webp$')
        OR ("purpose" = 'CATEGORY_IMAGE' AND "storageKey" ~ '^catalog-media/legacy-6ammart/category/category-[0-9]+-[0-9a-f]{16}[.]webp$')
        OR ("purpose" = 'BRAND_LOGO' AND "storageKey" ~ '^catalog-media/legacy-6ammart/brand/brand-[0-9]+-[0-9a-f]{16}[.]webp$')
        OR ("purpose" = 'STORE_LOGO' AND "storageKey" ~ '^catalog-media/legacy-6ammart/store-logo/store-logo-[0-9]+-[0-9a-f]{16}[.]webp$')
        OR ("purpose" = 'STORE_HERO' AND "storageKey" ~ '^catalog-media/legacy-6ammart/store-hero/store-hero-[0-9]+-[0-9a-f]{16}[.]webp$')
      )
    )
  )
) NOT VALID;
ALTER TABLE "CatalogMediaAsset" VALIDATE CONSTRAINT "CatalogMediaAsset_declared_shape_check";
COMMIT;
