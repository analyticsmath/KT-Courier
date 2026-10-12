import type { NextRequest } from "next/server";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { storeInventoryUploadPost } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest) {
  const denied = await requireBusinessApi("/api/store/catalog/inventory/upload");
  return denied ?? storeInventoryUploadPost(request);
}
