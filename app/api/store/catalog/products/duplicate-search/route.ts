import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storeDuplicateSearch } from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/products/duplicate-search",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeDuplicateSearch(request);
}
