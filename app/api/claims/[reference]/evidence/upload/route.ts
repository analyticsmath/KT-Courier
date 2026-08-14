import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, created, unauthorized, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { addClaimEvidence, ClaimDomainError, getClaimForActor } from "@/lib/claims/claim.service";
import { PrivateMediaPolicyError, PrivateMediaService } from "@/lib/private-media/private-media.service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const origin = await enforceSameOriginRequest(request); if (origin) return origin;
  const user = await getCurrentUser(); if (!user) return unauthorized();
  const limit = checkIpRateLimit(request, `claim-evidence:${user.id}`, RATE_LIMITS.CLAIM_MUTATION); if (!limit.ok) return badRequest("CLAIM_RATE_LIMITED");
  const form = await request.formData().catch(() => null); if (!form) return unprocessable("A multipart form is required.");
  const file = form.get("file"); if (!(file instanceof File)) return unprocessable("A file is required.");
  try {
    const claim = await getClaimForActor({ publicReference: (await params).reference, actorUserId: user.id, role: user.role });
    const media = await new PrivateMediaService().upload({ actor: { userId: user.id, role: user.role }, ownerType: "CLAIM", ownerId: claim.id, purpose: "CLAIM_EVIDENCE", fileName: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
    const evidence = await addClaimEvidence({ publicReference: claim.publicReference, actorUserId: user.id, role: user.role, privateMediaReference: media.publicReference });
    return created({ data: { evidence, media } });
  } catch (error) {
    if (error instanceof ClaimDomainError) return badRequest(error.code);
    if (error instanceof PrivateMediaPolicyError) return unprocessable(error.code);
    return badRequest("CLAIM_EVIDENCE_UPLOAD_FAILED");
  }
}
