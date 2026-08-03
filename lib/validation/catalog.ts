import { z } from "zod";

const publicReference = z.string().trim().regex(/^[A-Z]{2,8}-[A-F0-9]{32}$/);
const opaqueId = z.string().trim().min(20).max(64);
const operationId = z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9:_-]+$/);
const optimisticVersion = z.number().int().positive().max(2_147_483_647);
const safeText = (maximum: number) => z.string().trim().min(1).max(maximum).refine((value) => !/<\/?[a-z][^>]*>/i.test(value), "HTML is not allowed");
const slug = z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const jsonObject = z.record(z.string(), z.unknown());

export const CatalogPublicReferenceParamsSchema = z.object({ publicReference }).strict();
export const CatalogIdParamsSchema = z.object({ id: opaqueId }).strict();

export const CatalogListQuerySchema = z.object({
  page: z.coerce.number().int().positive().max(1_000_000).default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(120).optional(),
  status: z.string().trim().max(40).optional(),
  categoryId: opaqueId.optional(),
  productTypeId: opaqueId.optional(),
  brandId: opaqueId.optional(),
}).strict();

export const CatalogProductCreateSchema = z.object({
  scope: z.enum(["GLOBAL_CANONICAL", "STORE_PRIVATE"]).default("STORE_PRIVATE"),
  productTypeDefinitionId: opaqueId,
  primaryCategoryId: opaqueId,
  brandId: opaqueId.nullable().optional(),
  title: safeText(180),
  shortDescription: safeText(300).optional(),
  description: safeText(10_000).optional(),
  manufacturer: safeText(160).optional(),
  modelNumber: safeText(160).optional(),
  countryOfOrigin: z.string().trim().length(2).toUpperCase().optional(),
  condition: z.enum(["NEW", "REFURBISHED", "RECONDITIONED", "USED"]).default("NEW"),
  attributeValues: jsonObject.default({}),
  complianceValues: jsonObject.default({}),
  slug: slug.optional(),
  operationId,
}).strict();

export const CatalogProductPatchSchema = z.object({
  version: optimisticVersion,
  title: safeText(180).optional(),
  shortDescription: safeText(300).nullable().optional(),
  description: safeText(10_000).nullable().optional(),
  brandId: opaqueId.nullable().optional(),
  manufacturer: safeText(160).nullable().optional(),
  modelNumber: safeText(160).nullable().optional(),
  countryOfOrigin: z.string().trim().length(2).toUpperCase().nullable().optional(),
  condition: z.enum(["NEW", "REFURBISHED", "RECONDITIONED", "USED"]).optional(),
  attributeValues: jsonObject.optional(),
  complianceValues: jsonObject.optional(),
  operationId,
}).strict();

export const CatalogActionSchema = z.object({ version: optimisticVersion, operationId }).strict();
export const CatalogReasonActionSchema = CatalogActionSchema.extend({
  reasonCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
  safeNote: safeText(500).optional(),
}).strict();

export const StoreOfferCreateSchema = z.object({
  productId: opaqueId,
  variantId: opaqueId,
  storeSku: z.string().trim().min(1).max(100),
  merchantTitle: safeText(180).optional(),
  merchantDescription: safeText(2_000).optional(),
  inventoryTrackingMode: z.enum(["TRACKED", "UNTRACKED", "MADE_TO_ORDER"]),
  fulfilmentMode: z.enum(["COURIER_DELIVERY", "STORE_PICKUP", "PICKUP_AND_DELIVERY"]).default("COURIER_DELIVERY"),
  sellingUnit: z.enum(["EACH", "FIXED_WEIGHT", "VARIABLE_WEIGHT", "VOLUME", "LENGTH"]).default("EACH"),
  quantityStep: z.string().regex(/^\d{1,12}(?:\.\d{1,4})?$/).default("1"),
  minimumQuantity: z.string().regex(/^\d{1,12}(?:\.\d{1,4})?$/).default("1"),
  primaryInventoryLocationId: opaqueId.optional(),
  operationId,
}).strict();

export const StoreOfferPatchSchema = z.object({
  version: optimisticVersion,
  merchantTitle: safeText(180).nullable().optional(),
  merchantDescription: safeText(2_000).nullable().optional(),
  fulfilmentMode: z.enum(["COURIER_DELIVERY", "STORE_PICKUP", "PICKUP_AND_DELIVERY"]).optional(),
  primaryInventoryLocationId: opaqueId.nullable().optional(),
  operationId,
}).strict();

export const StorePriceVersionCreateSchema = z.object({
  offerPublicReference: publicReference,
  amount: z.string().regex(/^(?:0|[1-9]\d{0,15})\.\d{2}$/),
  currency: z.literal("ZAR"),
  priceIncludesTax: z.literal(true),
  effectiveFrom: z.string().datetime(),
  effectiveUntil: z.string().datetime().nullable().optional(),
  reasonCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,79}$/).optional(),
  offerVersion: optimisticVersion,
  operationId,
}).strict();

export const InventoryMovementCreateSchema = z.object({
  type: z.enum(["INITIAL_STOCK", "STOCK_RECEIPT", "STOCK_COUNT_CORRECTION", "DAMAGE", "LOSS", "RETURN_TO_STOCK", "MANUAL_CORRECTION", "REMOVAL"]),
  quantityDelta: z.number().int().refine((value) => value !== 0),
  locationPublicReference: publicReference,
  operationId,
  reasonCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
  safeNote: safeText(240).optional(),
  version: optimisticVersion,
}).strict();

export const ModifierGroupCreateSchema = z.object({
  name: safeText(120),
  description: safeText(500).optional(),
  minimumSelections: z.number().int().min(0).max(100),
  maximumSelections: z.number().int().positive().max(100),
  isRequired: z.boolean(),
  options: z.array(z.object({
    name: safeText(120),
    priceDelta: z.string().regex(/^\d{1,16}\.\d{2}$/),
    currency: z.literal("ZAR"),
    displayOrder: z.number().int().min(0).max(10_000),
  }).strict()).max(100).default([]),
  operationId,
}).strict();

export const CatalogImportCreateSchema = z.object({
  filename: z.string().trim().min(5).max(255).regex(/\.csv$/i),
  mimeType: z.enum(["text/csv", "application/csv", "text/plain"]),
  byteSize: z.number().int().positive().max(5 * 1024 * 1024),
  templateVersion: z.literal(1),
  operationId,
}).strict();

export const CatalogCategoryCreateSchema = z.object({
  name: safeText(120),
  slug,
  description: safeText(1_000).optional(),
  parentId: opaqueId.nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "HIDDEN"]).default("DRAFT"),
  displayOrder: z.number().int().min(0).max(1_000_000).default(0),
  operationId,
}).strict();

export const CatalogCategoryPatchSchema = CatalogCategoryCreateSchema.partial().extend({ version: optimisticVersion, operationId }).strict();

export const ProductTypeDefinitionCreateSchema = z.object({
  code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,63}$/),
  name: safeText(120),
  description: safeText(1_000).optional(),
  versionNumber: z.number().int().positive(),
  schemaVersion: z.number().int().positive().default(1),
  attributeSchema: jsonObject,
  variantSchema: jsonObject,
  complianceSchema: jsonObject,
  searchFacetSchema: jsonObject,
  supersedesDefinitionId: opaqueId.optional(),
  operationId,
}).strict();

export const ProductTypeDefinitionPatchSchema = ProductTypeDefinitionCreateSchema.omit({ code: true, versionNumber: true }).partial().extend({ version: optimisticVersion, operationId }).strict();

export const CatalogModerationActionSchema = z.object({
  version: optimisticVersion,
  operationId,
  reasonCode: z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,79}$/),
  safeNote: safeText(500).optional(),
}).strict();

export const CatalogDuplicateResolveSchema = z.object({
  action: z.enum(["CONFIRM_DISTINCT", "REJECT_SOURCE", "LINK_TO_EXISTING", "REQUEST_MERGE_REVIEW"]),
  operationId,
  safeNote: safeText(500).optional(),
}).strict();
