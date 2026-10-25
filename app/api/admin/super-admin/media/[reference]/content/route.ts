import type { NextRequest } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/admin-api";
import { catalogJson, catalogApiError, prepareCatalogMediaStream } from "@/lib/catalog/catalog-api-policy";
import { createProductionCatalogMediaIntakeService } from "@/lib/services/catalog-media-intake.service";
import { parseCatalogMediaOperationHeader } from "@/lib/validation/catalog-media";
const service = createProductionCatalogMediaIntakeService();
export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await requireSuperAdminApi({ request });
  if (auth.response) return auth.response;
  const { reference } = await context.params;
  if (!/^CMU-[A-F0-9]{32}$/.test(reference)) return catalogJson({ error: "Invalid upload reference." }, 422);
  const storeId = request.headers.get("x-kt-store-id");
  const operationId = parseCatalogMediaOperationHeader(request.headers.get("x-catalog-operation-id"));
  if (!storeId || storeId.length < 15 || !operationId) return catalogJson({ error: "Valid store and upload operation required." }, 422);
  const bytes = await prepareCatalogMediaStream(request, auth.user.id, "/api/admin/super-admin/media/content");
  if ("response" in bytes) return bytes.response;
  try { return catalogJson(await service.receiveUploadBytes({ actorUserId: auth.user.id, storeId, uploadReference: reference, operationId, bytes: bytes.bytes })); }
  catch (error) { return catalogApiError(error); }
}
