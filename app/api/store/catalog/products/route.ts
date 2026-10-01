import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import {
  storeProductsGet,
  storeProductsPost,
} from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/products",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeProductsGet(request);
}
export async function POST(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/products",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeProductsPost(request);
}
