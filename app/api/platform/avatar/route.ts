import { createCloudinaryPrivateImageStorageAdapter } from "@/lib/private-media/cloudinary-private-image-storage";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { json, failure } from "@/lib/client-platform/api";
import { normalizeProfileImage } from "@/lib/client-platform/images.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { parseBoundedMultipartRequest } from "@/lib/security/bounded-upload";
import {
  PrivateMediaService,
  PrivateMediaPolicyError,
} from "@/lib/private-media/private-media.service";
function imageFailure(e: unknown) {
  return e instanceof PrivateMediaPolicyError
    ? json({ error: e.message }, e.status)
    : failure(e);
}
export async function GET() {
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  const row = await prisma.user.findUnique({
    where: { id: u.id },
    select: { avatarMediaReference: true },
  });
  if (!row?.avatarMediaReference)
    return json({ error: "No profile image." }, 404);
  try {
    const media = await new PrivateMediaService().read({
      actor: { userId: u.id, role: u.role },
      reference: row.avatarMediaReference,
    });
    return new Response(Buffer.from(media.bytes), {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (e) {
    return imageFailure(e);
  }
}
export async function POST(req: NextRequest) {
  const origin = await enforceSameOriginRequest(req);
  if (origin) return origin;
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  const rate = await checkIpRateLimit(
    req,
    `avatar:${u.id}`,
    RATE_LIMITS.PRIVATE_MEDIA_UPLOAD,
  );
  if (!rate.ok) return json({ error: "Too many uploads. Retry shortly." }, 429);
  const upload = await parseBoundedMultipartRequest(req, {
    maxSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFiles: 1,
  });
  if (upload.errorResponse) return upload.errorResponse;
  const file = upload.result.files.file;
  if (
    !file ||
    Object.keys(upload.result.files).length !== 1 ||
    Object.keys(upload.result.fields).length
  )
    return json({ error: "Select one profile image." }, 422);
  try {
    const bytes = await normalizeProfileImage(file.bytes);
    const media = await new PrivateMediaService(createCloudinaryPrivateImageStorageAdapter()).upload({
      actor: { userId: u.id, role: u.role },
      ownerType: "USER",
      ownerId: u.id,
      purpose: "OTHER",
      fileName: "profile.webp",
      mimeType: "image/webp",
      bytes,
    });
    await prisma.user.update({
      where: { id: u.id },
      data: { avatarMediaReference: media!.publicReference },
    });
    return json({ saved: true });
  } catch (e) {
    return imageFailure(e);
  }
}
export async function DELETE(req: NextRequest) {
  const origin = await enforceSameOriginRequest(req);
  if (origin) return origin;
  const u = await getCurrentUser();
  if (!u) return json({ error: "Sign in to continue." }, 401);
  await prisma.user.update({
    where: { id: u.id },
    data: { avatarMediaReference: null },
  });
  return json({ removed: true });
}
