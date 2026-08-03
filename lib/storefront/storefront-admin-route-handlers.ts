import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { StorefrontCollectionService } from "@/lib/services/storefront-collection.service";
import { StorefrontReconciliationService } from "@/lib/services/storefront-reconciliation.service";
import { StorefrontSynonymService } from "@/lib/services/storefront-synonym.service";
import { storefrontJson } from "@/lib/storefront/storefront-api-policy";
import { parseStorefrontAdminBody, requireStorefrontAdminMutation, storefrontAdminError } from "@/lib/storefront/storefront-admin-api";
import { StorefrontCollectionActionSchema, StorefrontCollectionCreateSchema, StorefrontCollectionItemCreateSchema, StorefrontCollectionItemPatchSchema, StorefrontCollectionPatchSchema, StorefrontProjectionActionSchema, StorefrontSynonymActionSchema, StorefrontSynonymCreateSchema, StorefrontSynonymPatchSchema } from "@/lib/validation/storefront";

const collections = new StorefrontCollectionService();
const synonyms = new StorefrontSynonymService();
const reconciliation = new StorefrontReconciliationService();

export async function collectionCreate(request: NextRequest) {
  const auth = await requireStorefrontAdminMutation(request, PERMISSIONS.STOREFRONT_COLLECTIONS_MANAGE); if ("response" in auth) return auth.response;
  try { const body = await parseStorefrontAdminBody(request, StorefrontCollectionCreateSchema); return storefrontJson({ collection: await collections.create({ ...body, actorUserId: auth.user.id }) }, 201, { private: true }); } catch (error) { return storefrontAdminError(error); }
}
export async function collectionUpdate(request: NextRequest, publicReference: string) {
  const auth = await requireStorefrontAdminMutation(request, PERMISSIONS.STOREFRONT_COLLECTIONS_MANAGE); if ("response" in auth) return auth.response;
  try { const body = await parseStorefrontAdminBody(request, StorefrontCollectionPatchSchema); return storefrontJson({ collection: await collections.update(publicReference, { ...body, actorUserId: auth.user.id }) }, 200, { private: true }); } catch (error) { return storefrontAdminError(error); }
}
export async function collectionTransition(request: NextRequest, publicReference: string, action: "submit" | "approve" | "reject" | "activate" | "retire") {
  const auth = await requireStorefrontAdminMutation(request, PERMISSIONS.STOREFRONT_COLLECTIONS_MANAGE); if ("response" in auth) return auth.response;
  try { const body = await parseStorefrontAdminBody(request, StorefrontCollectionActionSchema); return storefrontJson({ collection: await collections.transition(publicReference, action, { ...body, actorUserId: auth.user.id }) }, 200, { private: true }); } catch (error) { return storefrontAdminError(error); }
}
export async function collectionAddItem(request: NextRequest, publicReference: string) {
  const auth = await requireStorefrontAdminMutation(request, PERMISSIONS.STOREFRONT_COLLECTIONS_MANAGE); if ("response" in auth) return auth.response;
  try { const body = await parseStorefrontAdminBody(request, StorefrontCollectionItemCreateSchema); return storefrontJson({ item: await collections.addItem(publicReference, { ...body, actorUserId: auth.user.id }) }, 201, { private: true }); } catch (error) { return storefrontAdminError(error); }
}
export async function collectionUpdateItem(request: NextRequest, publicReference: string, itemId: string) {
  const auth = await requireStorefrontAdminMutation(request, PERMISSIONS.STOREFRONT_COLLECTIONS_MANAGE); if ("response" in auth) return auth.response;
  try { const body = await parseStorefrontAdminBody(request, StorefrontCollectionItemPatchSchema); await collections.updateItem(publicReference, itemId, { ...body, actorUserId: auth.user.id }); return storefrontJson({ updated: true }, 200, { private: true }); } catch (error) { return storefrontAdminError(error); }
}
export async function collectionRemoveItem(request: NextRequest, publicReference: string, itemId: string) {
  const auth = await requireStorefrontAdminMutation(request, PERMISSIONS.STOREFRONT_COLLECTIONS_MANAGE); if ("response" in auth) return auth.response;
  try { const body = await parseStorefrontAdminBody(request, StorefrontCollectionActionSchema); await collections.removeItem(publicReference, itemId, { ...body, actorUserId: auth.user.id }); return storefrontJson({ removed: true }, 200, { private: true }); } catch (error) { return storefrontAdminError(error); }
}

export async function synonymCreate(request: NextRequest) {
  const auth = await requireStorefrontAdminMutation(request, PERMISSIONS.STOREFRONT_SEARCH_SYNONYMS_MANAGE); if ("response" in auth) return auth.response;
  try { const body = await parseStorefrontAdminBody(request, StorefrontSynonymCreateSchema); return storefrontJson({ synonymSet: await synonyms.create({ ...body, actorUserId: auth.user.id }) }, 201, { private: true }); } catch (error) { return storefrontAdminError(error); }
}
export async function synonymUpdate(request: NextRequest, publicReference: string) {
  const auth = await requireStorefrontAdminMutation(request, PERMISSIONS.STOREFRONT_SEARCH_SYNONYMS_MANAGE); if ("response" in auth) return auth.response;
  try { const body = await parseStorefrontAdminBody(request, StorefrontSynonymPatchSchema); return storefrontJson({ synonymSet: await synonyms.update(publicReference, { ...body, actorUserId: auth.user.id }) }, 200, { private: true }); } catch (error) { return storefrontAdminError(error); }
}
export async function synonymTransition(request: NextRequest, publicReference: string, action: "submit" | "approve" | "reject" | "activate" | "retire") {
  const auth = await requireStorefrontAdminMutation(request, PERMISSIONS.STOREFRONT_SEARCH_SYNONYMS_MANAGE); if ("response" in auth) return auth.response;
  try { const body = await parseStorefrontAdminBody(request, StorefrontSynonymActionSchema); return storefrontJson({ synonymSet: await synonyms.transition(publicReference, action, { ...body, actorUserId: auth.user.id }) }, 200, { private: true }); } catch (error) { return storefrontAdminError(error); }
}

export async function projectionRebuild(request: NextRequest, publicReference: string) {
  const auth = await requireStorefrontAdminMutation(request, PERMISSIONS.STOREFRONT_PROJECTIONS_RECONCILE); if ("response" in auth) return auth.response;
  try { const body = await parseStorefrontAdminBody(request, StorefrontProjectionActionSchema); return storefrontJson({ projectionCase: await reconciliation.requestCanonicalRebuild(publicReference, body.version) }, 200, { private: true }); } catch (error) { return storefrontAdminError(error); }
}
export async function projectionResolve(request: NextRequest, publicReference: string) {
  const auth = await requireStorefrontAdminMutation(request, PERMISSIONS.STOREFRONT_PROJECTIONS_RECONCILE); if ("response" in auth) return auth.response;
  try { const body = await parseStorefrontAdminBody(request, StorefrontProjectionActionSchema); return storefrontJson({ projectionCase: await reconciliation.resolveAfterCanonicalRebuild(publicReference, body.version, auth.user.id) }, 200, { private: true }); } catch (error) { return storefrontAdminError(error); }
}
export async function storefrontAdminRead(permission: string, fn: () => Promise<unknown>) {
  const auth = await requireAdminApiPermission(permission); if ("response" in auth) return auth.response;
  try { return storefrontJson(await fn(), 200, { private: true }); } catch (error) { return storefrontAdminError(error); }
}
