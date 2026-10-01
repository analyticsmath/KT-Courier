import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeCatalogMediaUploadCreate } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function POST(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/media/uploads",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeCatalogMediaUploadCreate(request);
}
