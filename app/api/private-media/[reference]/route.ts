import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { badRequest, conflict, forbidden, notFound, serviceUnavailable, tooManyRequests, unauthorized } from "@/lib/api/response";
import { PrivateMediaPolicyError, PrivateMediaService } from "@/lib/private-media/private-media.service";
import { evaluateRetentionHolds } from "@/lib/retention/hold-evaluator";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

function handlePrivateMediaError(error: unknown, fallbackMessage: string) {
  if (error instanceof PrivateMediaPolicyError) {
    if (error.status === 403) return forbidden(error.message);
    if (error.status === 404) return notFound(error.message);
    if (error.status === 409) return conflict(error.message);
    if (error.status === 503) return serviceUnavailable(error.message);
    return badRequest(error.message);
  }
  return badRequest(fallbackMessage);
}

export async function GET(request: Request, context: { params: Promise<{ reference: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { reference } = await context.params;
  try {
    const media = await new PrivateMediaService().read({ actor: { userId: user.id, role: user.role }, reference });
    const preview = new URL(request.url).searchParams.get("preview") === "1";
    const metadata = preview
      ? await new PrivateMediaService().getMetadata({ actor: { userId: user.id, role: user.role }, reference })
      : null;
    const inline = preview && metadata?.ownerType === "PROOF_OF_DELIVERY"
      && metadata.purpose === "POD_EVIDENCE"
      && ["image/jpeg", "image/png", "image/webp"].includes(media.mimeType);
    const disposition = inline ? "inline" : "attachment";
    return new Response(Buffer.from(media.bytes), { headers: { "Content-Type": media.mimeType, "Content-Disposition": `${disposition}; filename="${media.fileName.replace(/[\"\\]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch (error) {
    return handlePrivateMediaError(error, "Private media could not be retrieved.");
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return unauthorized();
  const rate = await checkIpRateLimit(request, `private-media-delete:${user.id}`, RATE_LIMITS.PRIVATE_MEDIA_UPLOAD);
  if (!rate.ok) return tooManyRequests(rate.retryAfterSeconds);
  const { reference } = await context.params;
  try {
    const service = new PrivateMediaService();
    const actor = { userId: user.id, role: user.role };
    const record = await prisma.privateMediaObject.findUnique({
      where: { publicReference: reference },
      select: { ownerType: true, ownerId: true },
    });
    if (!record) return notFound("Private media was not found.");
    const canDeletePermission = await hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.PRIVATE_MEDIA_DELETE });
    if (!canDeletePermission) {
      await service.getMetadata({ actor, reference });
    }
    const objectHold = await evaluateRetentionHolds({ subjectType: "PrivateMediaObject", subjectReference: reference });
    if (objectHold.hasHold) return conflict("This private document is subject to an active retention hold.");
    const ownerHold = await evaluateRetentionHolds({ subjectType: record.ownerType, subjectReference: record.ownerId });
    if (ownerHold.hasHold) return conflict("This private document's owner account is subject to an active retention hold.");
    const deleted = await service.requestDeletion({ actor, reference });
    return Response.json({ media: deleted }, { status: 200, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return handlePrivateMediaError(error, "Private media could not be deleted.");
  }
}
