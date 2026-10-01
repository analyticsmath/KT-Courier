import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeCatalogMediaAssociationRemove } from "@/lib/catalog/media/catalog-media-attachment-route-handlers";
export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ publicReference: string; associationId: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/products/[publicReference]/media/[associationId]/remove",
  );
  if (workspaceDenied) return workspaceDenied;
  const value = await params;
  return storeCatalogMediaAssociationRemove(
    request,
    value.publicReference,
    value.associationId,
  );
}
