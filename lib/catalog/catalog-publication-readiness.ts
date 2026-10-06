import { CatalogPolicyError } from "@/lib/catalog/errors";
import { assertExactZarPrice } from "@/lib/catalog/catalog-price-policy";

/** Release approval never substitutes for the current offer's commercial evidence. */
export function assertCatalogPublicationEvidence(input: {
  productStatus: string;
  moderationStatus: string;
  categoryStatus: string;
  productTypeStatus: string;
  variantStatus: string;
  offerStatus: string;
  price: {
    status: string;
    amount: string;
    currency: string;
    priceIncludesTax: boolean;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
  };
}, now = new Date()): void {
  if (input.productStatus !== "ACTIVE" || input.moderationStatus !== "APPROVED"
    || input.categoryStatus !== "ACTIVE" || input.productTypeStatus !== "ACTIVE"
    || input.variantStatus !== "ACTIVE" || input.offerStatus !== "ACTIVE") {
    throw new CatalogPolicyError("SNAPSHOT_PUBLICATION_NOT_READY", "Only an approved active product and offer can be published.");
  }
  if (input.price.status !== "ACTIVE" || input.price.effectiveFrom > now
    || (input.price.effectiveUntil !== null && input.price.effectiveUntil <= now)) {
    throw new CatalogPolicyError("SNAPSHOT_ACTIVE_PRICE_REQUIRED", "Publication requires the current effective active price.");
  }
  assertExactZarPrice(input.price);
}
