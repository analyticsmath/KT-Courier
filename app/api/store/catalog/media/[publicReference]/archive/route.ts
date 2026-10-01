import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeCatalogMediaArchive } from "@/lib/catalog/media/catalog-media-route-handlers";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicReference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/media/[publicReference]/archive",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeCatalogMediaArchive(request, (await params).publicReference);
}
