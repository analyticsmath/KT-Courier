import { type NextRequest } from "next/server";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { requireStoreCatalogPermission } from "@/lib/catalog/catalog-auth";
import { catalogApiError, catalogJson, prepareCatalogMutation } from "@/lib/catalog/catalog-api-policy";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { CatalogListingDraftSchema } from "@/lib/validation/catalog-listing-draft";
import { createStoreCatalogListingDraft } from "@/lib/services/catalog-listing-draft.service";

export async function POST(request: NextRequest) {
  const denied = await requireBusinessApi("/api/store/catalog/listing-drafts");
  if (denied) return denied;
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE, request);
  if ("response" in auth) return auth.response;
  for (const permission of [PERMISSIONS.CATALOG_PRICING_MANAGE, PERMISSIONS.CATALOG_INVENTORY_MANAGE]) {
    const result = await requireStoreCatalogPermission(permission, request);
    if ("response" in result) return result.response;
    if (result.store.id !== auth.store.id || result.user.id !== auth.user.id) return catalogJson({ error: "Catalog access changed. Reload before saving." }, 409);
  }
  const prepared = await prepareCatalogMutation(request, auth.user.id, "/api/store/catalog/listing-drafts");
  if ("response" in prepared) return prepared.response;
  const parsed = CatalogListingDraftSchema.safeParse(prepared.body);
  if (!parsed.success) return catalogJson({ error: "Review the listing fields before saving." }, 422);
  try { return catalogJson({ product: await createStoreCatalogListingDraft(auth.store.id, auth.user.id, parsed.data) }, 201); }
  catch (error) { return catalogApiError(error); }
}
