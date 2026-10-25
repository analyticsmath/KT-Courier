-- Preserve the package unit alongside the customer-visible cart price.
ALTER TABLE "MarketplaceCartLine" ADD COLUMN "observedSellingUnit" "CatalogSellingUnit" NOT NULL DEFAULT 'EACH';
-- Backfill only when the originally selected publication version still matches the
-- current canonical offer. Unknown historical versions stay conservatively EACH
-- and will be revalidated at checkout rather than rewritten from newer offers.
UPDATE "MarketplaceCartLine" AS line
SET "observedSellingUnit" = offer."sellingUnit"
FROM "StoreCatalogOffer" AS offer
WHERE line."offerPublicReference" = offer."publicReference"
  AND line."observedPublicationVersion" = offer."version"::text
  AND line."observedSellingUnit" = 'EACH';
