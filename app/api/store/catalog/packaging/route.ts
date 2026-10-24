import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { requireStoreCatalogPermission } from "@/lib/catalog/catalog-auth";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { catalogApiError, catalogJson, prepareCatalogMutation } from "@/lib/catalog/catalog-api-policy";
import { CatalogPackagingSchema } from "@/lib/validation/catalog-packaging";
import { listCatalogPackaging, saveCatalogPackaging } from "@/lib/services/catalog-packaging.service";
const schema = z.object({ offerReference: z.string().min(8).max(100), packaging: CatalogPackagingSchema }).strict();
export async function GET() {
  const denied = await requireBusinessApi("/api/store/catalog/packaging"); if (denied) return denied;
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_READ); if ("response" in auth) return auth.response;
  try { return catalogJson({ declarations: await listCatalogPackaging(auth.store.id) }); } catch (error) { return catalogApiError(error); }
}
export async function POST(request: NextRequest) {
  const denied = await requireBusinessApi("/api/store/catalog/packaging"); if (denied) return denied;
  const auth = await requireStoreCatalogPermission(PERMISSIONS.CATALOG_MANAGE, request); if ("response" in auth) return auth.response;
  const prepared = await prepareCatalogMutation(request, auth.user.id, "/api/store/catalog/packaging"); if ("response" in prepared) return prepared.response;
  try { const input = schema.parse(prepared.body); return catalogJson({ declaration: await saveCatalogPackaging(auth.store.id, auth.user.id, input.offerReference, input.packaging) }, 201); } catch (error) { return catalogApiError(error); }
}
