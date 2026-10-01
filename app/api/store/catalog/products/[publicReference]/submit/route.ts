import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeProductAction } from "@/lib/catalog/catalog-route-handlers";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicReference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/products/[publicReference]/submit",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeProductAction(request, (await params).publicReference, "submit");
}
