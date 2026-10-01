import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeCatalogMediaUploadContent } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicReference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/media/uploads/[publicReference]/content",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeCatalogMediaUploadContent(
    request,
    (await params).publicReference,
  );
}
