import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requireStoreCatalogPermission, requireCatalogAdminPermission } from "@/lib/catalog/catalog-auth";
import { catalogApiError, catalogJson, prepareCatalogMutation } from "@/lib/catalog/catalog-api-policy";
import {
  CatalogActionSchema,
  CatalogCategoryCreateSchema,
  CatalogCategoryPatchSchema,
  CatalogDuplicateResolveSchema,
  CatalogImportCreateSchema,
  CatalogListQuerySchema,
  CatalogModerationActionSchema,
  CatalogProductCreateSchema,
  CatalogProductPatchSchema,
  InventoryMovementCreateSchema,
  ModifierGroupCreateSchema,
  ProductTypeDefinitionCreateSchema,
  ProductTypeDefinitionPatchSchema,
  StoreOfferCreateSchema,
  StoreOfferPatchSchema,
  StorePriceVersionCreateSchema,
} from "@/lib/validation/catalog";
import { listStoreCatalogProducts, getStoreCatalogProduct, createStorePrivateCatalogProduct, updateStoreCatalogProduct, submitStoreCatalogProduct, archiveStoreCatalogProduct } from "@/lib/services/catalog-product.service";
import { listStoreCatalogOffers, getStoreCatalogOffer, createStoreCatalogOffer, updateStoreCatalogOffer, transitionStoreCatalogOffer } from "@/lib/services/store-offer.service";
import { listStoreInventory, postCatalogInventoryMovement } from "@/lib/services/catalog-inventory.service";
import { listStoreModifierGroups, createStoreModifierGroup } from "@/lib/services/catalog-modifier.service";
import { listStoreCatalogImports, createCatalogImportJob, validateCatalogImportJob, applyCatalogImportJob } from "@/lib/services/catalog-import.service";
import { createStoreOfferPriceVersion } from "@/lib/services/store-price.service";
import { searchCatalogDuplicates, listCatalogDuplicateCandidates, resolveCatalogDuplicate } from "@/lib/services/catalog-duplicate.service";
import { listCatalogCategories, createCatalogCategory, updateCatalogCategory } from "@/lib/services/catalog-category.service";
import { listProductTypeDefinitions, createProductTypeDefinition, updateProductTypeDefinition, transitionProductTypeDefinition } from "@/lib/services/product-type.service";
import { listCatalogModerationCases, getCatalogModerationCase, moderateCatalogProduct, moderateCatalogOffer } from "@/lib/services/catalog-moderation.service";
import { listCatalogAdminProducts, listCatalogAdminOffers } from "@/lib/services/catalog-query.service";

function query(request: NextRequest) {
  return Object.fromEntries(request.nextUrl.searchParams.entries());
}

function invalid(message = "Catalog request validation failed.") {
  return catalogJson({ error: message }, 422);
}

async function storeMutation(request: NextRequest, permission: string, endpoint: string) {
  const auth = await requireStoreCatalogPermission(permission, request);
  if ("response" in auth) return auth;
  const payload = await prepareCatalogMutation(request, auth.user.id, endpoint);
  if ("response" in payload) return payload;
  return { ...auth, body: payload.body };
}

async function adminMutation(request: NextRequest, permission: string, endpoint: string) {
  const auth = await requireCatalogAdminPermission(permission, request);
  if ("response" in auth) return auth;
  const payload = await prepareCatalogMutation(request, auth.user.id, endpoint);
  if ("response" in payload) return payload;
  return { ...auth, body: payload.body };
}

export async function storeProductsGet(request: NextRequest) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_READ, request); if ("response" in auth) return auth.response;
  const parsed = CatalogListQuerySchema.safeParse(query(request)); if (!parsed.success) return invalid("Invalid catalog product filters.");
  try { return catalogJson({ products: await listStoreCatalogProducts(auth.store.id, parsed.data) }); } catch (error) { return catalogApiError(error); }
}

export async function storeProductsPost(request: NextRequest) {
  const prepared = await storeMutation(request, PERMISSIONS.CATALOG_MANAGE, "/api/store/catalog/products"); if ("response" in prepared) return prepared.response;
  const parsed = CatalogProductCreateSchema.safeParse(prepared.body); if (!parsed.success) return invalid();
  try { return catalogJson({ product: await createStorePrivateCatalogProduct(prepared.store.id, prepared.user.id, parsed.data) }, 201); } catch (error) { return catalogApiError(error); }
}

export async function storeProductGet(request: NextRequest, publicReference: string) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_READ, request); if ("response" in auth) return auth.response;
  try { return catalogJson({ product: await getStoreCatalogProduct(auth.store.id, publicReference) }); } catch (error) { return catalogApiError(error); }
}

export async function storeProductPatch(request: NextRequest, publicReference: string) {
  const prepared = await storeMutation(request, PERMISSIONS.CATALOG_MANAGE, `/api/store/catalog/products/${publicReference}`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogProductPatchSchema.safeParse(prepared.body); if (!parsed.success) return invalid();
  try { return catalogJson({ product: await updateStoreCatalogProduct(prepared.store.id, publicReference, prepared.user.id, parsed.data as never) }); } catch (error) { return catalogApiError(error); }
}

export async function storeProductAction(request: NextRequest, publicReference: string, action: "submit" | "archive") {
  const permission = action === "submit" ? PERMISSIONS.CATALOG_SUBMIT : PERMISSIONS.CATALOG_MANAGE;
  const prepared = await storeMutation(request, permission, `/api/store/catalog/products/${publicReference}/${action}`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogActionSchema.safeParse(prepared.body); if (!parsed.success) return invalid();
  try {
    const product = action === "submit" ? await submitStoreCatalogProduct(prepared.store.id, publicReference, prepared.user.id, parsed.data) : await archiveStoreCatalogProduct(prepared.store.id, publicReference, prepared.user.id, parsed.data);
    return catalogJson({ product });
  } catch (error) { return catalogApiError(error); }
}

export async function storeOffersGet(request: NextRequest) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_READ, request); if ("response" in auth) return auth.response;
  const parsed = CatalogListQuerySchema.safeParse(query(request)); if (!parsed.success) return invalid("Invalid offer filters.");
  try { return catalogJson({ offers: await listStoreCatalogOffers(auth.store.id, parsed.data) }); } catch (error) { return catalogApiError(error); }
}

export async function storeOffersPost(request: NextRequest) {
  const prepared = await storeMutation(request, PERMISSIONS.CATALOG_MANAGE, "/api/store/catalog/offers"); if ("response" in prepared) return prepared.response;
  const parsed = StoreOfferCreateSchema.safeParse(prepared.body); if (!parsed.success) return invalid();
  try { return catalogJson({ offer: await createStoreCatalogOffer(prepared.store.id, prepared.user.id, parsed.data) }, 201); } catch (error) { return catalogApiError(error); }
}

export async function storeOfferGet(request: NextRequest, publicReference: string) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_READ, request); if ("response" in auth) return auth.response;
  try { return catalogJson({ offer: await getStoreCatalogOffer(auth.store.id, publicReference) }); } catch (error) { return catalogApiError(error); }
}

export async function storeOfferPatch(request: NextRequest, publicReference: string) {
  const prepared = await storeMutation(request, PERMISSIONS.CATALOG_MANAGE, `/api/store/catalog/offers/${publicReference}`); if ("response" in prepared) return prepared.response;
  const parsed = StoreOfferPatchSchema.safeParse(prepared.body); if (!parsed.success) return invalid();
  try { return catalogJson({ offer: await updateStoreCatalogOffer(prepared.store.id, publicReference, prepared.user.id, parsed.data) }); } catch (error) { return catalogApiError(error); }
}

export async function storeOfferAction(request: NextRequest, publicReference: string, action: "submit" | "pause" | "archive") {
  const prepared = await storeMutation(request, action === "submit" ? PERMISSIONS.CATALOG_SUBMIT : PERMISSIONS.CATALOG_MANAGE, `/api/store/catalog/offers/${publicReference}/${action}`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogActionSchema.safeParse(prepared.body); if (!parsed.success) return invalid();
  const target = { submit: "SUBMITTED", pause: "PAUSED", archive: "ARCHIVED" }[action] as "SUBMITTED" | "PAUSED" | "ARCHIVED";
  try { return catalogJson({ offer: await transitionStoreCatalogOffer(prepared.store.id, publicReference, prepared.user.id, target, parsed.data) }); } catch (error) { return catalogApiError(error); }
}

export async function storeBrandsSearch(request: NextRequest) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_READ, request); if ("response" in auth) return auth.response;
  const search = request.nextUrl.searchParams.get("q")?.trim() ?? ""; if (search.length < 2 || search.length > 80) return invalid("Brand search requires 2 to 80 characters.");
  try { return catalogJson({ brands: await prisma.catalogBrand.findMany({ where: { status: "ACTIVE", name: { contains: search, mode: "insensitive" } }, select: { publicReference: true, name: true, slug: true }, take: 20, orderBy: { name: "asc" } }) }); } catch (error) { return catalogApiError(error); }
}

export async function storeDuplicateSearch(request: NextRequest) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_READ, request); if ("response" in auth) return auth.response;
  const title = request.nextUrl.searchParams.get("title")?.trim() ?? ""; const productTypeCode = request.nextUrl.searchParams.get("productTypeCode")?.trim() ?? "";
  if (title.length < 3 || productTypeCode.length < 2) return invalid("Duplicate search requires title and product type.");
  try { return catalogJson({ candidates: await searchCatalogDuplicates({ title, productTypeCode, gtin: request.nextUrl.searchParams.get("gtin") ?? undefined, brandId: request.nextUrl.searchParams.get("brandId") ?? undefined, mpn: request.nextUrl.searchParams.get("mpn") ?? undefined }) }); } catch (error) { return catalogApiError(error); }
}

export async function storeInventoryGet(request: NextRequest) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_INVENTORY_READ, request); if ("response" in auth) return auth.response;
  try { return catalogJson({ inventory: await listStoreInventory(auth.store.id) }); } catch (error) { return catalogApiError(error); }
}

export async function storeInventoryMovementPost(request: NextRequest, publicReference: string) {
  const prepared = await storeMutation(request, PERMISSIONS.CATALOG_INVENTORY_MANAGE, `/api/store/catalog/inventory/${publicReference}/movements`); if ("response" in prepared) return prepared.response;
  const parsed = InventoryMovementCreateSchema.safeParse(prepared.body); if (!parsed.success) return invalid();
  try { return catalogJson({ movement: await postCatalogInventoryMovement(prepared.store.id, prepared.user.id, publicReference, parsed.data) }, 201); } catch (error) { return catalogApiError(error); }
}

export async function storeModifiersGet(request: NextRequest) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_READ, request); if ("response" in auth) return auth.response;
  try { return catalogJson({ modifierGroups: await listStoreModifierGroups(auth.store.id) }); } catch (error) { return catalogApiError(error); }
}

export async function storeModifiersPost(request: NextRequest) {
  const prepared = await storeMutation(request, PERMISSIONS.CATALOG_MANAGE, "/api/store/catalog/modifier-groups"); if ("response" in prepared) return prepared.response;
  const parsed = ModifierGroupCreateSchema.safeParse(prepared.body); if (!parsed.success) return invalid();
  try { return catalogJson({ modifierGroup: await createStoreModifierGroup(prepared.store.id, prepared.user.id, parsed.data) }, 201); } catch (error) { return catalogApiError(error); }
}

export async function storeImportsGet(request: NextRequest) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_IMPORTS_READ, request); if ("response" in auth) return auth.response;
  try { return catalogJson({ imports: await listStoreCatalogImports(auth.store.id) }); } catch (error) { return catalogApiError(error); }
}

export async function storeImportsPost(request: NextRequest) {
  const prepared = await storeMutation(request, PERMISSIONS.CATALOG_IMPORTS_MANAGE, "/api/store/catalog/imports"); if ("response" in prepared) return prepared.response;
  const parsed = CatalogImportCreateSchema.safeParse(prepared.body); if (!parsed.success) return invalid();
  try { return catalogJson({ importJob: await createCatalogImportJob(prepared.store.id, prepared.user.id, parsed.data) }, 201); } catch (error) { return catalogApiError(error); }
}

export async function storeImportAction(request: NextRequest, publicReference: string, action: "validate" | "apply") {
  const prepared = await storeMutation(request, PERMISSIONS.CATALOG_IMPORTS_MANAGE, `/api/store/catalog/imports/${publicReference}/${action}`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogActionSchema.safeParse(prepared.body); if (!parsed.success) return invalid();
  try { return catalogJson({ importJob: action === "validate" ? await validateCatalogImportJob(prepared.store.id, publicReference) : await applyCatalogImportJob(prepared.store.id, prepared.user.id, publicReference) }); } catch (error) { return catalogApiError(error); }
}

export async function storePricesPost(request: NextRequest) {
  const prepared = await storeMutation(request, PERMISSIONS.CATALOG_PRICING_MANAGE, "/api/store/catalog/prices"); if ("response" in prepared) return prepared.response;
  const parsed = StorePriceVersionCreateSchema.safeParse(prepared.body); if (!parsed.success) return invalid();
  try { return catalogJson({ price: await createStoreOfferPriceVersion(prepared.store.id, prepared.user.id, parsed.data) }, 201); } catch (error) { return catalogApiError(error); }
}

export async function adminCategoriesGet(request: NextRequest) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_TAXONOMY_READ, request); if ("response" in auth) return auth.response;
  try { return catalogJson({ categories: await listCatalogCategories() }); } catch (error) { return catalogApiError(error); }
}

export async function adminCategoriesPost(request: NextRequest) {
  const prepared = await adminMutation(request, PERMISSIONS.CATALOG_TAXONOMY_MANAGE, "/api/admin/catalog/categories"); if ("response" in prepared) return prepared.response;
  const parsed = CatalogCategoryCreateSchema.safeParse((prepared as any).body); if (!parsed.success) return invalid();
  try { return catalogJson({ category: await createCatalogCategory({ actorUserId: prepared.user.id, ...parsed.data }) }, 201); } catch (error) { return catalogApiError(error); }
}

export async function adminCategoryGet(request: NextRequest, id: string) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_TAXONOMY_READ, request); if ("response" in auth) return auth.response;
  try { const category = await prisma.catalogCategory.findUnique({ where: { id }, include: { children: true, productTypeMappings: { include: { productTypeDefinition: true } } } }); return category ? catalogJson({ category }) : catalogJson({ error: "Category was not found." }, 404); } catch (error) { return catalogApiError(error); }
}

export async function adminCategoryPatch(request: NextRequest, id: string) {
  const prepared = await adminMutation(request, PERMISSIONS.CATALOG_TAXONOMY_MANAGE, `/api/admin/catalog/categories/${id}`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogCategoryPatchSchema.safeParse((prepared as any).body); if (!parsed.success) return invalid();
  try { return catalogJson({ category: await updateCatalogCategory(id, { actorUserId: prepared.user.id, ...parsed.data }) }); } catch (error) { return catalogApiError(error); }
}

export async function adminProductTypesGet(request: NextRequest) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_PRODUCT_TYPES_READ, request); if ("response" in auth) return auth.response;
  try { return catalogJson({ productTypes: await listProductTypeDefinitions() }); } catch (error) { return catalogApiError(error); }
}

export async function adminProductTypesPost(request: NextRequest) {
  const prepared = await adminMutation(request, PERMISSIONS.CATALOG_PRODUCT_TYPES_MANAGE, "/api/admin/catalog/product-types"); if ("response" in prepared) return prepared.response;
  const parsed = ProductTypeDefinitionCreateSchema.safeParse((prepared as any).body); if (!parsed.success) return invalid();
  try { return catalogJson({ productType: await createProductTypeDefinition({ actorUserId: prepared.user.id, ...parsed.data }) }, 201); } catch (error) { return catalogApiError(error); }
}

export async function adminProductTypeGet(request: NextRequest, id: string) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_PRODUCT_TYPES_READ, request); if ("response" in auth) return auth.response;
  try { const productType = await prisma.productTypeDefinition.findUnique({ where: { id }, include: { categoryMappings: { include: { category: true } }, supersedes: true, supersededBy: true } }); return productType ? catalogJson({ productType }) : catalogJson({ error: "Product type was not found." }, 404); } catch (error) { return catalogApiError(error); }
}

export async function adminProductTypePatch(request: NextRequest, id: string) {
  const prepared = await adminMutation(request, PERMISSIONS.CATALOG_PRODUCT_TYPES_MANAGE, `/api/admin/catalog/product-types/${id}`); if ("response" in prepared) return prepared.response;
  const parsed = ProductTypeDefinitionPatchSchema.safeParse((prepared as any).body); if (!parsed.success) return invalid();
  try { return catalogJson({ productType: await updateProductTypeDefinition(id, { actorUserId: prepared.user.id, ...parsed.data }) }); } catch (error) { return catalogApiError(error); }
}

export async function adminProductTypeAction(request: NextRequest, id: string, action: "submit" | "approve" | "activate" | "retire") {
  const permission = action === "approve" || action === "activate" ? PERMISSIONS.CATALOG_PRODUCT_TYPES_APPROVE : PERMISSIONS.CATALOG_PRODUCT_TYPES_MANAGE;
  const prepared = await adminMutation(request, permission, `/api/admin/catalog/product-types/${id}/${action}`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogActionSchema.safeParse((prepared as any).body); if (!parsed.success) return invalid();
  const status = { submit: "UNDER_REVIEW", approve: "APPROVED", activate: "ACTIVE", retire: "RETIRED" }[action] as "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "RETIRED";
  try { return catalogJson({ productType: await transitionProductTypeDefinition(id, status, { actorUserId: prepared.user.id, version: parsed.data.version, operationId: parsed.data.operationId }) }); } catch (error) { return catalogApiError(error); }
}

export async function adminProductsGet(request: NextRequest) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_MODERATION_READ, request); if ("response" in auth) return auth.response;
  const parsed = CatalogListQuerySchema.safeParse(query(request)); if (!parsed.success) return invalid("Invalid product filters.");
  try { return catalogJson({ products: await listCatalogAdminProducts(parsed.data) }); } catch (error) { return catalogApiError(error); }
}

export async function adminProductGet(request: NextRequest, id: string) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_MODERATION_READ, request); if ("response" in auth) return auth.response;
  try { const product = await prisma.catalogProduct.findUnique({ where: { id }, include: { primaryCategory: true, productTypeDefinition: true, brand: true, variants: { include: { media: true } }, media: { include: { asset: true } }, offers: { include: { store: true, priceVersions: true, inventoryItem: { include: { levels: true } } } }, moderationCases: { include: { history: true } } } }); return product ? catalogJson({ product }) : catalogJson({ error: "Product was not found." }, 404); } catch (error) { return catalogApiError(error); }
}

export async function adminProductAction(request: NextRequest, id: string, action: "approve" | "request-changes" | "reject" | "suspend") {
  const permission = action === "approve" ? PERMISSIONS.CATALOG_MODERATION_APPROVE : action === "suspend" ? PERMISSIONS.CATALOG_MODERATION_SUSPEND : PERMISSIONS.CATALOG_MODERATION_REVIEW;
  const prepared = await adminMutation(request, permission, `/api/admin/catalog/products/${id}/${action}`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogModerationActionSchema.safeParse((prepared as any).body); if (!parsed.success) return invalid();
  const operation = { approve: "APPROVE", "request-changes": "REQUEST_CHANGES", reject: "REJECT", suspend: "SUSPEND" }[action] as "APPROVE" | "REQUEST_CHANGES" | "REJECT" | "SUSPEND";
  try { return catalogJson({ product: await moderateCatalogProduct(id, prepared.user.id, operation, parsed.data) }); } catch (error) { return catalogApiError(error); }
}

export async function adminOffersGet(request: NextRequest) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_MODERATION_READ, request); if ("response" in auth) return auth.response;
  const parsed = CatalogListQuerySchema.safeParse(query(request)); if (!parsed.success) return invalid("Invalid offer filters.");
  try { return catalogJson({ offers: await listCatalogAdminOffers(parsed.data) }); } catch (error) { return catalogApiError(error); }
}

export async function adminOfferGet(request: NextRequest, id: string) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_MODERATION_READ, request); if ("response" in auth) return auth.response;
  try { const offer = await prisma.storeCatalogOffer.findUnique({ where: { id }, include: { store: true, product: true, variant: true, priceVersions: true, inventoryItem: { include: { levels: { include: { location: true } }, movements: true } }, moderationCases: { include: { history: true } } } }); return offer ? catalogJson({ offer }) : catalogJson({ error: "Offer was not found." }, 404); } catch (error) { return catalogApiError(error); }
}

export async function adminOfferAction(request: NextRequest, id: string, action: "approve" | "request-changes" | "suspend") {
  const permission = action === "approve" ? PERMISSIONS.CATALOG_MODERATION_APPROVE : action === "suspend" ? PERMISSIONS.CATALOG_MODERATION_SUSPEND : PERMISSIONS.CATALOG_MODERATION_REVIEW;
  const prepared = await adminMutation(request, permission, `/api/admin/catalog/offers/${id}/${action}`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogModerationActionSchema.safeParse((prepared as any).body); if (!parsed.success) return invalid();
  const operation = { approve: "APPROVE", "request-changes": "REQUEST_CHANGES", suspend: "SUSPEND" }[action] as "APPROVE" | "REQUEST_CHANGES" | "SUSPEND";
  try { return catalogJson({ offer: await moderateCatalogOffer(id, prepared.user.id, operation, parsed.data) }); } catch (error) { return catalogApiError(error); }
}

export async function adminModerationGet(request: NextRequest, id?: string) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_MODERATION_READ, request); if ("response" in auth) return auth.response;
  try { return id ? catalogJson({ moderationCase: await getCatalogModerationCase(id) }) : catalogJson({ moderationCases: await listCatalogModerationCases({ status: request.nextUrl.searchParams.get("status") ?? undefined }) }); } catch (error) { return catalogApiError(error); }
}

export async function adminDuplicatesGet(request: NextRequest) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_MODERATION_READ, request); if ("response" in auth) return auth.response;
  try { return catalogJson({ candidates: await listCatalogDuplicateCandidates() }); } catch (error) { return catalogApiError(error); }
}

export async function adminDuplicateResolve(request: NextRequest, id: string) {
  const prepared = await adminMutation(request, PERMISSIONS.CATALOG_MODERATION_REVIEW, `/api/admin/catalog/duplicates/${id}/resolve`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogDuplicateResolveSchema.safeParse((prepared as any).body); if (!parsed.success) return invalid();
  try { return catalogJson({ candidate: await resolveCatalogDuplicate(id, prepared.user.id, parsed.data.action, parsed.data.operationId) }); } catch (error) { return catalogApiError(error); }
}
