import { z } from "zod";
import { CatalogProductCreateSchema, ModifierGroupCreateSchema, StorePriceVersionCreateSchema } from "@/lib/validation/catalog";
import { CatalogMediaAttachmentSchema } from "@/lib/validation/catalog-media";

export const CatalogListingDraftSchema = z.object({
  operationId: z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9:_-]+$/),
  product: CatalogProductCreateSchema.omit({ operationId: true }).extend({ scope: z.literal("STORE_PRIVATE") }).strict(),
  variants: z.array(z.object({
    title: z.string().trim().min(1).max(180),
    options: z.array(z.object({ code: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/), value: z.string().trim().min(1).max(100) }).strict()).min(1).max(20),
    attributeValues: z.record(z.string(), z.unknown()).default({}),
  }).strict()).max(50).default([]),
  storeSku: z.string().trim().min(1).max(100),
  price: StorePriceVersionCreateSchema.pick({ amount: true, currency: true, priceIncludesTax: true, effectiveFrom: true }).strict(),
  openingStock: z.number().int().min(0).max(2_147_483_647),
  inventoryLocationPublicReference: z.string().trim().min(8).max(80).optional(),
  modifiers: z.array(ModifierGroupCreateSchema.omit({ operationId: true }).strict()).max(20).default([]),
  media: z.array(CatalogMediaAttachmentSchema.pick({ assetPublicReference: true, altText: true, displayOrder: true }).extend({ primary: z.boolean(), variantAssociation: z.enum(["PRODUCT", "DEFAULT"]) }).strict()).min(1).max(20),
}).strict().superRefine((draft, context) => {
  if (draft.openingStock > 0 && !draft.inventoryLocationPublicReference) context.addIssue({ code: "custom", path: ["inventoryLocationPublicReference"], message: "Choose an active inventory location for opening stock." });
  if (draft.media.filter(item => item.primary && item.variantAssociation === "PRODUCT").length !== 1) context.addIssue({ code: "custom", path: ["media"], message: "Select exactly one primary product image." });
});

export type CatalogListingDraftInput = z.infer<typeof CatalogListingDraftSchema>;
