import type { NextRequest } from "next/server";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { requireStoreCatalogPermission } from "@/lib/catalog/catalog-auth";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { uploadNormalizedStoreImage } from "@/lib/client-platform/catalog-image-upload";
export async function POST(request: NextRequest) {
  const denied = await requireBusinessApi("/api/store/catalog/media/normalized");
  if (denied) return denied;
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE, request);
  if ("response" in auth) return auth.response;
  return uploadNormalizedStoreImage(request, auth.user.id, auth.store.id, ["PRODUCT_IMAGE", "VARIANT_IMAGE"]);
}
