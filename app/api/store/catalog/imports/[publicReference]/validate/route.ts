import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeImportAction } from "@/lib/catalog/catalog-route-handlers";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicReference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/imports/[publicReference]/validate",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeImportAction(request, (await params).publicReference, "validate");
}
