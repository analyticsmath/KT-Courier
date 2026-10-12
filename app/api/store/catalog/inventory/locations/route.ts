import { type NextRequest } from "next/server";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { requireStoreCatalogPermission } from "@/lib/catalog/catalog-auth";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { catalogApiError, catalogJson, prepareCatalogMutation } from "@/lib/catalog/catalog-api-policy";
import { InventoryLocationCreateSchema } from "@/lib/validation/inventory-location";
import { createStoreInventoryLocation, listStoreInventoryLocations } from "@/lib/services/catalog-inventory-location.service";

const endpoint = "/api/store/catalog/inventory/locations";

export async function GET(request: NextRequest) {
  const denied = await requireBusinessApi(endpoint);
  if (denied) return denied;
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_INVENTORY_READ, request);
  if ("response" in auth) return auth.response;
  try { return catalogJson({ locations: await listStoreInventoryLocations(auth.store.id) }); }
  catch (error) { return catalogApiError(error); }
}

export async function POST(request: NextRequest) {
  const denied = await requireBusinessApi(endpoint);
  if (denied) return denied;
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_INVENTORY_MANAGE, request);
  if ("response" in auth) return auth.response;
  const prepared = await prepareCatalogMutation(request, auth.user.id, endpoint);
  if ("response" in prepared) return prepared.response;
  const parsed = InventoryLocationCreateSchema.safeParse(prepared.body);
  if (!parsed.success) return catalogJson({ error: "Use a plain-text stock location name of 2 to 120 characters." }, 422);
  try { return catalogJson({ location: await createStoreInventoryLocation(auth.store.id, auth.user.id, parsed.data) }, 201); }
  catch (error) { return catalogApiError(error); }
}
