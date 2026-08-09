import { prisma } from "@/lib/db/prisma";
import { validateGtin, normalizeMpn } from "@/lib/catalog/product-identifiers";
import { productOptionFingerprint, type VariantOptionSelection } from "@/lib/catalog/product-option-fingerprint";
import { catalogPublicReference, normalizeCatalogKey } from "@/lib/catalog/catalog-normalization";
import { CatalogNotFoundError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { recordCatalogEvidence } from "@/lib/services/catalog-service-support";
import { toInputJsonObject } from "@/lib/json/input-json";

export async function createCatalogVariant(args: {
  storeId: string;
  productPublicReference: string;
  actorUserId: string;
  title: string;
  options: VariantOptionSelection[];
  gtin?: string;
  mpn?: string;
  attributeValues: Record<string, unknown>;
}) {
  const product = await prisma.catalogProduct.findUnique({ where: { publicReference: args.productPublicReference } });
  if (!product) throw new CatalogNotFoundError("Catalog product was not found.");
  if (product.sourceStoreId !== args.storeId) throw new CatalogOwnershipError();
  if (!["DRAFT", "NEEDS_CHANGES"].includes(product.status)) throw new CatalogPolicyError("PRODUCT_NOT_EDITABLE", "Variants can only be changed while the product is editable.");
  const gtinResult = args.gtin ? validateGtin(args.gtin) : null;
  if (gtinResult && !gtinResult.valid) throw new CatalogPolicyError("INVALID_GTIN", `GTIN validation failed: ${gtinResult.code}`);
  const publicReference = catalogPublicReference("CV");
  return prisma.$transaction(async (tx) => {
    const variant = await tx.catalogProductVariant.create({
      data: {
        publicReference,
        productId: product.id,
        title: args.title,
        normalizedTitle: normalizeCatalogKey(args.title),
        optionFingerprint: productOptionFingerprint(args.options),
        gtin: gtinResult?.normalized,
        gtinType: gtinResult?.type,
        mpn: args.mpn ? normalizeMpn(args.mpn) : undefined,
        attributeValues: toInputJsonObject(args.attributeValues),
      },
    });
    await recordCatalogEvidence(tx, { aggregateType: "VARIANT", aggregateReference: publicReference, aggregateVersion: 1, action: "CREATED", eventType: "VARIANT_UPDATED", actorUserId: args.actorUserId, safeMetadata: { productReference: product.publicReference } });
    return variant;
  });
}
