import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { storeAccess } from "@/lib/client-platform/store-access";
import { json, failure } from "@/lib/client-platform/api";
import { normalizeProfileImage } from "@/lib/client-platform/images.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseBoundedMultipartRequest } from "@/lib/security/bounded-upload";
import {
  PrivateMediaService,
  PrivateMediaPolicyError,
} from "@/lib/private-media/private-media.service";
export async function POST(req: NextRequest) {
  const origin = await enforceSameOriginRequest(req);
  if (origin) return origin;
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  try {
    const store = (await storeAccess(u.id, "marketing")).store;
    const rate = await checkIpRateLimit(
      req,
      `marketing-image:${u.id}`,
      RATE_LIMITS.PRIVATE_MEDIA_UPLOAD,
    );
    if (!rate.ok)
      return json({ error: "Too many uploads. Retry shortly." }, 429);
    const upload = await parseBoundedMultipartRequest(req, {
      maxSizeBytes: 5 * 1024 * 1024,
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFiles: 1,
    });
    if (upload.errorResponse) return upload.errorResponse;
    const file = upload.result.files.file;
    if (!file) return json({ error: "Select an image." }, 422);
    const bytes = await normalizeProfileImage(file.bytes, false);
    return json(
      await new PrivateMediaService().upload({
        actor: { userId: u.id, role: u.role },
        ownerType: "STORE",
        ownerId: store.id,
        purpose: "OTHER",
        fileName: "marketing.webp",
        mimeType: "image/webp",
        bytes,
      }),
      201,
    );
  } catch (e) {
    return e instanceof PrivateMediaPolicyError
      ? json({ error: e.message }, e.status)
      : failure(e);
  }
}
