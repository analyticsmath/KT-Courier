import type { NextRequest } from "next/server";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { requireStoreCatalogPermission } from "@/lib/catalog/catalog-auth";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { catalogApiError, catalogJson } from "@/lib/catalog/catalog-api-policy";
import { readCatalogMediaForStore } from "@/lib/services/catalog-media-review-content.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }): Promise<Response> {
  const denied = await requireBusinessApi("/api/store/catalog/media");
  if (denied) return denied;
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_READ, request);
  if ("response" in auth) return auth.response ?? catalogJson({ error: "Catalog permission is required." }, 403);
  try {
    const content = await readCatalogMediaForStore((await params).publicReference, auth.store.id, request.nextUrl.searchParams.get("download") === "1");
    return new Response(Buffer.from(content.body), { headers: content.headers });
  } catch (error) { return catalogApiError(error); }
}
