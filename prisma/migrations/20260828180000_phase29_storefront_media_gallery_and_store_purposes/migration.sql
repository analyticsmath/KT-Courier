-- AlterEnum
ALTER TYPE "CatalogMediaPurpose" ADD VALUE IF NOT EXISTS 'STORE_LOGO';
ALTER TYPE "CatalogMediaPurpose" ADD VALUE IF NOT EXISTS 'STORE_HERO';

-- AlterTable
ALTER TABLE "StorefrontProductDocument" ADD COLUMN IF NOT EXISTS "mediaGallery" JSONB;
