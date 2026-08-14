import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, ok, unauthorized, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { addClaimEvidence, ClaimDomainError } from "@/lib/claims/claim.service";

const schema = z.object({ textualEvidence: z.string().trim().min(1).max(4000).optional(), privateMediaReference: z.string().trim().max(120).optional() }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const origin = await enforceSameOriginRequest(request); if (origin) return origin;
  const user = await getCurrentUser(); if (!user) return unauthorized(); const limit = checkIpRateLimit(request, `claim-evidence:${user.id}`, RATE_LIMITS.CLAIM_MUTATION); if (!limit.ok) return badRequest("CLAIM_RATE_LIMITED"); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Validation failed.");
  try { return ok({ data: await addClaimEvidence({ publicReference: (await params).reference, actorUserId: user.id, role: user.role, ...parsed.data }) }); }
  catch (error) { return badRequest(error instanceof ClaimDomainError ? error.code : "CLAIM_EVIDENCE_FAILED"); }
}
