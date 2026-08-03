import { type NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requireCatalogAdminPermission, requireStoreCatalogPermission } from "@/lib/catalog/catalog-auth";
import { catalogApiError, catalogJson, prepareCatalogMediaStream, prepareCatalogMutation } from "@/lib/catalog/catalog-api-policy";
import { createProductionCatalogMediaIntakeService } from "@/lib/services/catalog-media-intake.service";
import { CatalogMediaArchiveSchema, CatalogMediaCompleteSchema, CatalogMediaReviewSchema, CatalogMediaUploadIntentSchema, parseCatalogMediaOperationHeader } from "@/lib/validation/catalog-media";

const service = createProductionCatalogMediaIntakeService();

export async function storeCatalogMediaList(request: NextRequest) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_READ, request);
  if ("response" in auth) return auth.response;
  try { return catalogJson({ assets: await service.listStoreAssets(auth.store.id) }); } catch (error) { return catalogApiError(error); }
}

export async function storeCatalogMediaGet(request: NextRequest, publicReference: string) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_READ, request);
  if ("response" in auth) return auth.response;
  try { return catalogJson({ asset: await service.getStoreAsset(auth.store.id, publicReference) }); } catch (error) { return catalogApiError(error); }
}

export async function storeCatalogMediaUploadCreate(request: NextRequest) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE, request);
  if ("response" in auth) return auth.response;
  const prepared = await prepareCatalogMutation(request, auth.user.id, "/api/store/catalog/media/uploads");
  if ("response" in prepared) return prepared.response;
  const parsed = CatalogMediaUploadIntentSchema.safeParse(prepared.body);
  if (!parsed.success) return catalogJson({ error: "Catalog media upload intent is invalid.", issues: parsed.error.issues }, 422);
  try {
    return catalogJson(await service.createUploadIntent({ actorUserId: auth.user.id, ownerType: "STORE", storeId: auth.store.id, ...parsed.data }), 201);
  } catch (error) { return catalogApiError(error); }
}

export async function storeCatalogMediaUploadContent(request: NextRequest, publicReference: string) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE, request);
  if ("response" in auth) return auth.response;
  const operationId = parseCatalogMediaOperationHeader(request.headers.get("x-catalog-operation-id"));
  if (!operationId) return catalogJson({ error: "A valid X-Catalog-Operation-Id header is required." }, 422);
  const prepared = await prepareCatalogMediaStream(request, auth.user.id, `/api/store/catalog/media/uploads/${publicReference}/content`);
  if ("response" in prepared) return prepared.response;
  try { return catalogJson(await service.receiveUploadBytes({ actorUserId: auth.user.id, storeId: auth.store.id, uploadReference: publicReference, operationId, bytes: prepared.bytes })); } catch (error) { return catalogApiError(error); }
}

export async function storeCatalogMediaUploadComplete(request: NextRequest, publicReference: string) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE, request);
  if ("response" in auth) return auth.response;
  const prepared = await prepareCatalogMutation(request, auth.user.id, `/api/store/catalog/media/uploads/${publicReference}/complete`);
  if ("response" in prepared) return prepared.response;
  const parsed = CatalogMediaCompleteSchema.safeParse(prepared.body);
  if (!parsed.success) return catalogJson({ error: "Catalog media completion evidence is invalid.", issues: parsed.error.issues }, 422);
  try { return catalogJson(await service.completeUpload({ actorUserId: auth.user.id, storeId: auth.store.id, uploadReference: publicReference, ...parsed.data })); } catch (error) { return catalogApiError(error); }
}

export async function storeCatalogMediaArchive(request: NextRequest, publicReference: string) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE, request);
  if ("response" in auth) return auth.response;
  const prepared = await prepareCatalogMutation(request, auth.user.id, `/api/store/catalog/media/${publicReference}/archive`);
  if ("response" in prepared) return prepared.response;
  const parsed = CatalogMediaArchiveSchema.safeParse(prepared.body);
  if (!parsed.success) return catalogJson({ error: "Catalog media archive request is invalid.", issues: parsed.error.issues }, 422);
  try { return catalogJson({ asset: await service.archiveStoreAsset({ actorUserId: auth.user.id, storeId: auth.store.id, publicReference, ...parsed.data }) }); } catch (error) { return catalogApiError(error); }
}

export async function adminCatalogMediaList(request: NextRequest) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_MODERATION_READ, request);
  if ("response" in auth) return auth.response;
  try { return catalogJson({ assets: await service.listAdminAssets() }); } catch (error) { return catalogApiError(error); }
}

export async function adminCatalogMediaGet(request: NextRequest, id: string) {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_MODERATION_READ, request);
  if ("response" in auth) return auth.response;
  try { return catalogJson({ asset: await service.getAdminAsset(id) }); } catch (error) { return catalogApiError(error); }
}

export async function adminCatalogMediaReview(request: NextRequest, id: string, action: "APPROVE" | "QUARANTINE" | "REJECT") {
  const permission = action === "APPROVE" ? PERMISSIONS.CATALOG_MODERATION_APPROVE : action === "QUARANTINE" ? PERMISSIONS.CATALOG_MODERATION_SUSPEND : PERMISSIONS.CATALOG_MODERATION_REVIEW;
  const auth = await requireCatalogAdminPermission(permission, request);
  if ("response" in auth) return auth.response;
  const prepared = await prepareCatalogMutation(request, auth.user.id, `/api/admin/catalog/media/${id}/${action.toLocaleLowerCase("en-ZA")}`);
  if ("response" in prepared) return prepared.response;
  const parsed = CatalogMediaReviewSchema.safeParse(prepared.body);
  if (!parsed.success) return catalogJson({ error: "Catalog media review evidence is invalid.", issues: parsed.error.issues }, 422);
  try { return catalogJson({ asset: await service.reviewAsset({ actorUserId: auth.user.id, id, action, ...parsed.data }) }); } catch (error) { return catalogApiError(error); }
}
