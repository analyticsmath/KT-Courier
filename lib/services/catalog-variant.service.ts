import { prisma } from "@/lib/db/prisma";
import { type Prisma } from "@prisma/client";
import { validateGtin, normalizeMpn } from "@/lib/catalog/product-identifiers";
import { productOptionFingerprint, type VariantOptionSelection } from "@/lib/catalog/product-option-fingerprint";
import { catalogPublicReference, normalizeCatalogKey, normalizeCatalogText } from "@/lib/catalog/catalog-normalization";
import { CatalogNotFoundError, CatalogOwnershipError, CatalogPolicyError } from "@/lib/catalog/errors";
import { recordCatalogEvidence, withCatalogTransaction } from "@/lib/services/catalog-service-support";
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
}, transaction?: Prisma.TransactionClient) {
  const product = await (transaction ?? prisma).catalogProduct.findUnique({ where: { publicReference: args.productPublicReference } });
  if (!product) throw new CatalogNotFoundError("Catalog product was not found.");
  if (product.sourceStoreId !== args.storeId) throw new CatalogOwnershipError();
  if (!["DRAFT", "NEEDS_CHANGES"].includes(product.status)) throw new CatalogPolicyError("PRODUCT_NOT_EDITABLE", "Variants can only be changed while the product is editable.");
  const gtinResult = args.gtin ? validateGtin(args.gtin) : null;
  if (gtinResult && !gtinResult.valid) throw new CatalogPolicyError("INVALID_GTIN", `GTIN validation failed: ${gtinResult.code}`);
  const publicReference = catalogPublicReference("CV");
  const fingerprint = productOptionFingerprint(args.options);
  if (args.options.length > 20 || args.options.some(option => !/^[a-z][a-z0-9_]{1,63}$/.test(option.code)
    || !option.value.trim() || option.value.length > 100 || /<\/?[a-z][^>]*>/i.test(option.value))) {
    throw new CatalogPolicyError("VARIANT_OPTIONS_INVALID", "Use valid option names and plain-text values.");
  }
  return withCatalogTransaction(transaction, async (tx) => {
    const variant = await tx.catalogProductVariant.create({
      data: {
        publicReference,
        productId: product.id,
        title: args.title,
        normalizedTitle: normalizeCatalogKey(args.title),
        optionFingerprint: fingerprint,
        gtin: gtinResult?.normalized,
        gtinType: gtinResult?.type,
        mpn: args.mpn ? normalizeMpn(args.mpn) : undefined,
        attributeValues: toInputJsonObject(args.attributeValues),
      },
    });
    for (const [index, selection] of args.options.entries()) {
      const option = await tx.catalogProductOption.upsert({
        where: { productId_code: { productId: product.id, code: selection.code } }, update: {},
        create: { productId: product.id, code: selection.code, name: selection.code.replaceAll("_", " "), displayOrder: index },
      });
      const normalizedValue = normalizeCatalogKey(selection.value);
      const value = await tx.catalogProductOptionValue.upsert({
        where: { optionId_normalizedValue: { optionId: option.id, normalizedValue } }, update: {},
        create: { optionId: option.id, code: normalizedValue, label: normalizeCatalogText(selection.value), normalizedValue },
      });
      await tx.catalogVariantOptionValue.create({ data: { variantId: variant.id, optionValueId: value.id } });
    }
    await recordCatalogEvidence(tx, { aggregateType: "VARIANT", aggregateReference: publicReference, aggregateVersion: 1, action: "CREATED", eventType: "VARIANT_UPDATED", actorUserId: args.actorUserId, safeMetadata: { productReference: product.publicReference } });
    return variant;
  });
}
