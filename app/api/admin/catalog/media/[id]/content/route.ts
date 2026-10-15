import type { NextRequest } from "next/server";
import { requireCatalogAdminPermission } from "@/lib/catalog/catalog-auth";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { catalogApiError, catalogJson } from "@/lib/catalog/catalog-api-policy";
import { readCatalogMediaForReview } from "@/lib/services/catalog-media-review-content.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const auth = await requireCatalogAdminPermission(PERMISSIONS.CATALOG_MODERATION_READ, request);
  if ("response" in auth) return auth.response ?? catalogJson({ error: "Catalog administration permission is required." }, 403);
  try {
    const content = await readCatalogMediaForReview((await params).id, request.nextUrl.searchParams.get("download") === "1");
    return new Response(Buffer.from(content.body), { headers: content.headers });
  } catch (error) { return catalogApiError(error); }
}
