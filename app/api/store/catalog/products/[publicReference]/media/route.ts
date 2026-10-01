import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeCatalogMediaAttach } from "@/lib/catalog/media/catalog-media-attachment-route-handlers";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicReference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/products/[publicReference]/media",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeCatalogMediaAttach(request, (await params).publicReference);
}
