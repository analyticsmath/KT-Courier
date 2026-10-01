import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import {
  storeModifiersGet,
  storeModifiersPost,
} from "@/lib/catalog/catalog-route-handlers";
export async function GET(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/modifier-groups",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeModifiersGet(request);
}
export async function POST(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/catalog/modifier-groups",
  );
  if (workspaceDenied) return workspaceDenied;
  return storeModifiersPost(request);
}
