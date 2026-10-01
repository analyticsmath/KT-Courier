import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeCatalogMediaGet } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicReference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/media/[publicReference]",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeCatalogMediaGet(request, (await params).publicReference);
}
