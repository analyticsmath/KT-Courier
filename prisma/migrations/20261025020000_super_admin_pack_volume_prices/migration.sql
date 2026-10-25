-- Distinct sellable-pack SKUs preserve inventory-per-pack semantics.
ALTER TYPE "CatalogSellingUnit" ADD VALUE IF NOT EXISTS 'PAIR';
ALTER TYPE "CatalogSellingUnit" ADD VALUE IF NOT EXISTS 'PACK';
ALTER TYPE "CatalogSellingUnit" ADD VALUE IF NOT EXISTS 'BULK';
-- Immutable versioned volume tiers are created in DRAFT price versions only.
ALTER TABLE "StoreOfferPriceVersion" ADD COLUMN "volumeTiers" JSONB;
