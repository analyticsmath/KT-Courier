import { z } from "zod";

const operationId = z.string().trim().min(8).max(120).regex(/^[A-Za-z0-9:_-]+$/);
const version = z.number().int().positive().max(2_147_483_647);
const safeText = (maximum: number) => z.string().trim().min(1).max(maximum).refine((value) => !/<\/?[a-z][^>]*>/i.test(value), "HTML is not allowed");
const slug = z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const publicReference = z.string().trim().regex(/^[A-Z]{2,8}-[A-F0-9]{32}$/);
const targetReference = z.string().trim().min(3).max(160).regex(/^[A-Za-z0-9-]+$/);
const safeDate = z.string().datetime().transform((value) => new Date(value));

export const StorefrontPublicReferenceParamsSchema = z.object({ publicReference }).strict();
export const StorefrontCollectionItemParamsSchema = z.object({ publicReference, itemId: z.string().trim().min(20).max(64) }).strict();
export const StorefrontCollectionCreateSchema = z.object({ name: safeText(160), slug, description: safeText(2_000).nullable().optional(), collectionType: z.enum(["EDITORIAL", "SEASONAL", "CATEGORY_LANDING"]), effectiveFrom: safeDate.nullable().optional(), effectiveUntil: safeDate.nullable().optional(), operationId }).strict();
export const StorefrontCollectionPatchSchema = z.object({ version, name: safeText(160).optional(), description: safeText(2_000).nullable().optional(), effectiveFrom: safeDate.nullable().optional(), effectiveUntil: safeDate.nullable().optional(), operationId }).strict();
export const StorefrontCollectionActionSchema = z.object({ version, operationId }).strict();
export const StorefrontCollectionItemCreateSchema = z.object({ version, targetType: z.enum(["CATEGORY", "PRODUCT", "VARIANT", "STORE"]), targetReference, displayOrder: z.number().int().min(0).max(10_000), safeLabelOverride: safeText(240).nullable().optional(), operationId }).strict();
export const StorefrontCollectionItemPatchSchema = z.object({ version, displayOrder: z.number().int().min(0).max(10_000).optional(), safeLabelOverride: safeText(240).nullable().optional(), operationId }).strict().refine((value) => value.displayOrder !== undefined || value.safeLabelOverride !== undefined, "An item change is required.");

const synonymRule = z.object({ input: safeText(120), outputs: z.array(safeText(120)).min(1).max(12), direction: z.enum(["EQUIVALENT", "ONE_WAY"]) }).strict();
export const StorefrontSynonymCreateSchema = z.object({ name: safeText(120), language: z.string().trim().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/).max(20), terms: z.array(synonymRule).min(1).max(48), operationId }).strict();
export const StorefrontSynonymPatchSchema = z.object({ version, terms: z.array(synonymRule).min(1).max(48), operationId }).strict();
export const StorefrontSynonymActionSchema = z.object({ version, operationId }).strict();
export const StorefrontProjectionActionSchema = z.object({ version, operationId }).strict();
