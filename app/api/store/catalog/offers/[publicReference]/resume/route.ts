import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeOfferAction } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) {
  const denied = await requireBusinessApi("/api/store/catalog/offers/[publicReference]/resume");
  if (denied) return denied;
  return storeOfferAction(request, (await params).publicReference, "resume");
}
