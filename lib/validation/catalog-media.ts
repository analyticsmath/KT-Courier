import { z } from "zod";

const operationId = z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

export const CatalogMediaUploadIntentSchema = z.object({
  purpose: z.enum(["PRODUCT_IMAGE", "VARIANT_IMAGE"]),
  declaredMimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  declaredByteSize: z.number().int().positive().max(8 * 1024 * 1024),
  operationId,
}).strict();

export const CatalogMediaCompleteSchema = z.object({ operationId }).strict();
export const CatalogMediaArchiveSchema = z.object({ operationId }).strict();

export const CatalogMediaReviewSchema = z.object({
  operationId,
  reasonCode: z.string().trim().min(3).max(80).regex(/^[A-Z][A-Z0-9_]*$/),
}).strict();

export const CatalogMediaAttachmentSchema = z.object({
  operationId,
  productVersion: z.number().int().positive(),
  assetPublicReference: z.string().trim().min(8).max(80).regex(/^CMA-[A-Z0-9]+$/),
  role: z.enum(["PRIMARY", "GALLERY", "VARIANT", "SWATCH", "LABEL"]),
  altText: z.string().trim().min(1).max(240),
  displayOrder: z.number().int().min(0).max(99),
  variantPublicReference: z.string().trim().min(8).max(80).regex(/^CV-[A-Z0-9]+$/).nullable().optional(),
}).strict();

export const CatalogMediaAttachmentUpdateSchema = z.object({
  operationId,
  productVersion: z.number().int().positive(),
  altText: z.string().trim().min(1).max(240),
  displayOrder: z.number().int().min(0).max(99),
  primary: z.boolean(),
}).strict();

export const CatalogMediaAttachmentRemoveSchema = z.object({ operationId, productVersion: z.number().int().positive() }).strict();

export function parseCatalogMediaOperationHeader(value: string | null): string | null {
  const parsed = operationId.safeParse(value);
  return parsed.success ? parsed.data : null;
}
