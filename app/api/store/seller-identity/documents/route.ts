import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { storeAccess } from "@/lib/client-platform/store-access";
import { json, failure } from "@/lib/client-platform/api";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseBoundedMultipartRequest } from "@/lib/security/bounded-upload";
import { PrivateMediaPolicyError, PrivateMediaService } from "@/lib/private-media/private-media.service";

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;
  const denied = await requireBusinessApi("/api/store/seller-identity");
  if (denied) return denied;
  try {
    const user = await getCurrentUser();
    if (!user || user.status !== "ACTIVE") return json({ error: "Authentication required." }, 401);
    const access = await storeAccess(user.id);
    if (!access.owner) return json({ error: "Only the store owner may upload seller verification documents." }, 403);
    const rate = await checkIpRateLimit(request, `seller-evidence-upload:${user.id}`, RATE_LIMITS.PRIVATE_MEDIA_UPLOAD);
    if (!rate.ok) return json({ error: "Too many uploads. Please retry shortly." }, 429);
    const upload = await parseBoundedMultipartRequest(request, {
      maxSizeBytes: 10 * 1024 * 1024, maxFiles: 1,
      allowedMimeTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
    });
    if (upload.errorResponse) return upload.errorResponse;
    const file = upload.result.files.file;
    if (!file) return json({ error: "Choose a verification document." }, 422);
    const document = await new PrivateMediaService().upload({
      actor: { userId: user.id, role: user.role }, ownerType: "STORE", ownerId: access.store.id,
      purpose: "STORE_VERIFICATION_DOCUMENT", fileName: file.sanitizedName, mimeType: file.type, bytes: file.bytes,
    });
    return json({ document }, 201);
  } catch (error) {
    if (error instanceof PrivateMediaPolicyError) return json({ error: error.message, code: error.code }, error.status);
    return failure(error);
  }
}
