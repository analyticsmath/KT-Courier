import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeCatalogMediaList } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function GET(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi("/api/store/catalog/media");
  if (workspaceDenied) return workspaceDenied;
  return storeCatalogMediaList(request);
}
