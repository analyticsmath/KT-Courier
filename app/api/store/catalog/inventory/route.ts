import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeInventoryGet } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/inventory",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeInventoryGet(request);
}
