import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeInventoryMovementPost } from "@/lib/catalog/catalog-route-handlers";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicReference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/inventory/[publicReference]/movements",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeInventoryMovementPost(request, (await params).publicReference);
}
