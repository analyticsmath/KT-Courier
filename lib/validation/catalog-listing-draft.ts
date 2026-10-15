import { z } from "zod";
import { CatalogProductCreateSchema, ModifierGroupCreateSchema, StorePriceVersionCreateSchema } from "@/lib/validation/catalog";
import { CatalogMediaAttachmentSchema } from "@/lib/validation/catalog-media";

const listingPrice = StorePriceVersionCreateSchema.pick({ amount: true, currency: true, priceIncludesTax: true, effectiveFrom: true }).strict();
const stockCount = z.number().int().min(0).max(2_147_483_647);
const stockLocation = z.string().trim().min(8).max(80);
const normalized = (value: string) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-ZA");
const normalizedSku = (value: string) => normalized(value).replace(/\s+/g, "-");

export const CatalogListingVariantSchema = z.object({
  title: z.string().trim().min(1).max(180).refine(value => !/<\/?[a-z][^>]*>/i.test(value), "Use plain text."),
  options: z.array(z.object({ code: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), value: z.string().trim().min(1).max(100).refine(value => !/<\/?[a-z][^>]*>/i.test(value), "Use plain text.") }).strict()).min(1).max(20),
  attributeValues: z.record(z.string(), z.unknown()).default({}),
  storeSku: z.string().trim().min(1).max(100),
  price: listingPrice,
  openingStock: stockCount,
  inventoryLocationPublicReference: stockLocation.optional(),
}).strict();

export const CatalogListingDraftSchema = z.object({
  operationId: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9:_-]+$/),
  product: CatalogProductCreateSchema.omit({ operationId: true }).extend({ scope: z.literal("STORE_PRIVATE") }).strict(),
  variants: z.array(CatalogListingVariantSchema).max(50).default([]),
  storeSku: z.string().trim().min(1).max(100).optional(),
  price: listingPrice.optional(),
  openingStock: stockCount.optional(),
  inventoryLocationPublicReference: stockLocation.optional(),
  modifiers: z.array(ModifierGroupCreateSchema.omit({ operationId: true }).strict()).max(20).default([]),
  media: z.array(CatalogMediaAttachmentSchema.pick({ assetPublicReference: true, altText: true, displayOrder: true }).extend({ primary: z.boolean(), variantAssociation: z.enum(["PRODUCT", "DEFAULT"]) }).strict()).min(1).max(20),
}).strict().superRefine((draft, context) => {
  if (draft.variants.length === 0) {
    for (const key of ["storeSku", "price", "openingStock"] as const) if (draft[key] === undefined) context.addIssue({ code: "custom", path: [key], message: "Required for a single-variant listing." });
    if ((draft.openingStock ?? 0) > 0 && !draft.inventoryLocationPublicReference) context.addIssue({ code: "custom", path: ["inventoryLocationPublicReference"], message: "Choose an active inventory location for opening stock." });
  } else {
    const combinations = new Set<string>(); const skus = new Set<string>();
    const optionCodes = draft.variants[0].options.map(option => option.code).sort().join("|");
    draft.variants.forEach((variant, index) => {
      const codes = variant.options.map(option => option.code);
      if (new Set(codes).size !== codes.length || [...codes].sort().join("|") !== optionCodes) context.addIssue({ code: "custom", path: ["variants", index, "options"], message: "Each variant must use the same option names once each." });
      const fingerprint = JSON.stringify(variant.options.map(option => [option.code, normalized(option.value)]).sort(([a], [b]) => a.localeCompare(b)));
      if (combinations.has(fingerprint)) context.addIssue({ code: "custom", path: ["variants", index, "options"], message: "This option combination is already listed." });
      combinations.add(fingerprint);
      const sku = normalizedSku(variant.storeSku);
      if (skus.has(sku)) context.addIssue({ code: "custom", path: ["variants", index, "storeSku"], message: "Each variant needs a unique store SKU." });
      skus.add(sku);
      if (variant.openingStock > 0 && !variant.inventoryLocationPublicReference && !draft.inventoryLocationPublicReference) context.addIssue({ code: "custom", path: ["variants", index, "inventoryLocationPublicReference"], message: "Choose an active location for this variant's opening stock." });
    });
    if (draft.media.some(item => item.variantAssociation === "DEFAULT")) context.addIssue({ code: "custom", path: ["media"], message: "Custom variants use the shared product gallery; remove Default variant image associations." });
  }
  if (draft.media.filter(item => item.primary && item.variantAssociation === "PRODUCT").length !== 1) context.addIssue({ code: "custom", path: ["media"], message: "Select exactly one primary product image." });
});

export type CatalogListingDraftInput = z.infer<typeof CatalogListingDraftSchema>;
