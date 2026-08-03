import { type NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requireStoreCatalogPermission } from "@/lib/catalog/catalog-auth";
import { catalogApiError, catalogJson, prepareCatalogMutation } from "@/lib/catalog/catalog-api-policy";
import { attachStoreCatalogMedia, removeStoreCatalogMediaAssociation, updateStoreCatalogMediaAssociation } from "@/lib/services/catalog-media-attachment.service";
import { CatalogMediaAttachmentRemoveSchema, CatalogMediaAttachmentSchema, CatalogMediaAttachmentUpdateSchema } from "@/lib/validation/catalog-media";

export async function storeCatalogMediaAttach(request: NextRequest, productReference: string) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE, request); if ("response" in auth) return auth.response;
  const prepared = await prepareCatalogMutation(request, auth.user.id, `/api/store/catalog/products/${productReference}/media`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogMediaAttachmentSchema.safeParse(prepared.body); if (!parsed.success) return catalogJson({ error: "Catalog media attachment is invalid.", issues: parsed.error.issues }, 422);
  try { return catalogJson(await attachStoreCatalogMedia(auth.store.id, productReference, auth.user.id, parsed.data), 201); } catch (error) { return catalogApiError(error); }
}

export async function storeCatalogMediaAssociationUpdate(request: NextRequest, productReference: string, associationId: string) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE, request); if ("response" in auth) return auth.response;
  const prepared = await prepareCatalogMutation(request, auth.user.id, `/api/store/catalog/products/${productReference}/media/${associationId}`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogMediaAttachmentUpdateSchema.safeParse(prepared.body); if (!parsed.success) return catalogJson({ error: "Catalog media association update is invalid.", issues: parsed.error.issues }, 422);
  try { return catalogJson(await updateStoreCatalogMediaAssociation(auth.store.id, productReference, associationId, auth.user.id, parsed.data)); } catch (error) { return catalogApiError(error); }
}

export async function storeCatalogMediaAssociationRemove(request: NextRequest, productReference: string, associationId: string) {
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE, request); if ("response" in auth) return auth.response;
  const prepared = await prepareCatalogMutation(request, auth.user.id, `/api/store/catalog/products/${productReference}/media/${associationId}/remove`); if ("response" in prepared) return prepared.response;
  const parsed = CatalogMediaAttachmentRemoveSchema.safeParse(prepared.body); if (!parsed.success) return catalogJson({ error: "Catalog media association removal is invalid.", issues: parsed.error.issues }, 422);
  try { return catalogJson(await removeStoreCatalogMediaAssociation(auth.store.id, productReference, associationId, auth.user.id, parsed.data)); } catch (error) { return catalogApiError(error); }
}
