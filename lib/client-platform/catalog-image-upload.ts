import { createCloudinaryCatalogWriteAdapter } from "@/lib/catalog/media/cloudinary-catalog-media-storage";
import type { NextRequest } from "next/server";
import { parseBoundedMultipartRequest } from "@/lib/security/bounded-upload";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseCatalogMediaOperationHeader } from "@/lib/validation/catalog-media";
import { createProductionCatalogMediaIntakeService } from "@/lib/services/catalog-media-intake.service";
import type { CatalogMediaPurpose } from "@/lib/catalog/media/catalog-media-policy";
import { catalogApiError } from "@/lib/catalog/catalog-api-policy";
import { normalizeCatalogImage } from "./images.service";
import { failure, json } from "./api";
import { PlatformError } from "./contracts";

export async function uploadNormalizedStoreImage(request: NextRequest, userId: string, storeId: string, purposes: readonly CatalogMediaPurpose[]) {
  const origin = await enforceSameOriginRequest(request);
  if (origin) return origin;
  const rate = await checkIpRateLimit(request, `store-image:${userId}`, RATE_LIMITS.PRIVATE_MEDIA_UPLOAD);
  if (!rate.ok) return json({ error: "Too many uploads. Retry shortly." }, 429);
  const operationId = parseCatalogMediaOperationHeader(request.headers.get("x-catalog-operation-id"));
  if (!operationId) return json({ error: "A valid upload operation ID is required." }, 422);
  const upload = await parseBoundedMultipartRequest(request, { maxSizeBytes: 8 * 1024 * 1024, allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"], maxFiles: 1 });
  if (upload.errorResponse) return upload.errorResponse;
  const file = upload.result.files.file;
  const purpose = upload.result.fields.purpose as CatalogMediaPurpose;
  if (!file || Object.keys(upload.result.files).length !== 1 || Object.keys(upload.result.fields).length !== 1 || !purposes.includes(purpose)) return json({ error: "Select one image and a valid image purpose." }, 422);
  try {
    const bytes = await normalizeCatalogImage(file.bytes);
    const service = createProductionCatalogMediaIntakeService(createCloudinaryCatalogWriteAdapter());
    const intent = await service.createUploadIntent({ actorUserId: userId, ownerType: "STORE", storeId, purpose, declaredMimeType: "image/webp", declaredByteSize: bytes.length, operationId });
    await service.receiveUploadBytes({ actorUserId: userId, storeId, uploadReference: intent.upload.publicReference, bytes, operationId: `${operationId}:bytes` });
    const complete = await service.completeUpload({ actorUserId: userId, storeId, uploadReference: intent.upload.publicReference, operationId: `${operationId}:complete` });
    return json(complete, complete.asset.status === "READY" ? 201 : 422);
  } catch (error) { return error instanceof PlatformError ? failure(error) : catalogApiError(error); }
}
