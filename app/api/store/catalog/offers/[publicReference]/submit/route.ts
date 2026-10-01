import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeOfferAction } from "@/lib/catalog/catalog-route-handlers";
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicReference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/offers/[publicReference]/submit",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeOfferAction(request, (await params).publicReference, "submit");
}
