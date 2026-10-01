import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeCatalogMediaAssociationUpdate } from "@/lib/catalog/media/catalog-media-attachment-route-handlers";
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ publicReference: string; associationId: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/products/[publicReference]/media/[associationId]",
  );
  if (workspaceDenied) return workspaceDenied;
  const value = await params;
  return storeCatalogMediaAssociationUpdate(
    request,
    value.publicReference,
    value.associationId,
  );
}
