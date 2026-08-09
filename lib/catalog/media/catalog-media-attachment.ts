import { CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { assertCatalogMediaCounts, assertCatalogMediaPurposeRole, assertCatalogMediaRole, type CatalogMediaImageRole, type CatalogMediaPurpose } from "@/lib/catalog/media/catalog-media-policy";

export function assertCatalogMediaAttachment(input: {
  product: { id: string; scope: "GLOBAL_CANONICAL" | "STORE_PRIVATE"; sourceStoreId: string | null };
  variant?: { id: string; productId: string } | null;
  asset: { status: string; ownerType: "PLATFORM" | "STORE"; ownerStoreId: string | null; purpose: CatalogMediaPurpose };
  role: CatalogMediaImageRole;
  altText: string;
  existingProductImageCount: number;
  existingVariantImageCount: number;
  resultingPrimaryImageCount: number;
}): void {
  assertCatalogMediaRole({ role: input.role, variantId: input.variant?.id });
  assertCatalogMediaPurposeRole(input.asset.purpose, input.role);
  if (input.asset.status !== "READY") throw new CatalogPolicyError("CATALOG_MEDIA_NOT_READY", "Only READY catalog media may be attached.", 409);
  if (!input.altText.trim() || input.altText.trim().length > 240) throw new CatalogPolicyError("CATALOG_MEDIA_ALT_TEXT_REQUIRED", "Consumer-facing catalog media requires alt text between 1 and 240 characters.");
  if (input.variant && input.variant.productId !== input.product.id) throw new CatalogPolicyError("CATALOG_MEDIA_VARIANT_MISMATCH", "Variant media must reference a variant on the same product.");
  if (input.product.scope === "GLOBAL_CANONICAL" && (input.asset.ownerType !== "PLATFORM" || input.asset.ownerStoreId !== null)) {
    throw new CatalogOwnershipError();
  }
  if (input.product.scope === "STORE_PRIVATE" && (input.asset.ownerType !== "STORE" || input.asset.ownerStoreId !== input.product.sourceStoreId)) {
    throw new CatalogOwnershipError();
  }
  assertCatalogMediaCounts({
    productImageCount: input.existingProductImageCount + 1,
    variantImageCount: input.existingVariantImageCount + (input.variant ? 1 : 0),
    primaryImageCount: input.resultingPrimaryImageCount,
  });
}
