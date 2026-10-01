import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import {
  storeImportsGet,
  storeImportsPost,
} from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/imports",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeImportsGet(request);
}
export async function POST(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/imports",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeImportsPost(request);
}
