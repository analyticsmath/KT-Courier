import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import {
  storeOffersGet,
  storeOffersPost,
} from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi("/api/store/catalog/offers");
  if (workspaceDenied) return workspaceDenied;
  return storeOffersGet(request);
}
export async function POST(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi("/api/store/catalog/offers");
  if (workspaceDenied) return workspaceDenied;
  return storeOffersPost(request);
}
