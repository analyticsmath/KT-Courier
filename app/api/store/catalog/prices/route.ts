import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { storePricesPost } from "@/lib/catalog/catalog-route-handlers";
export async function POST(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi("/api/store/catalog/prices");
  if (workspaceDenied) return workspaceDenied;
  return storePricesPost(request);
}
