import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, ok, unauthorized, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { createClaim, ClaimDomainError, listClaimsForActor } from "@/lib/claims/claim.service";

const createSchema = z.object({ orderReference: z.string().trim().min(1).optional(), marketplaceOrderReference: z.string().trim().min(1).optional(), marketplaceOrderLineId: z.string().trim().min(1).optional(), reason: z.enum(["WRONG_ITEM", "MISSING_ITEM", "DAMAGED", "DEFECTIVE", "SPOILED_OR_UNSAFE", "NON_DELIVERY", "DELIVERY_ISSUE", "PAYMENT_ISSUE", "OTHER"]), description: z.string().trim().min(8).max(4000), operationId: z.string().regex(/^CLMOP-[A-Z0-9-]{12,100}$/) }).strict();

export async function GET() {
  const user = await getCurrentUser(); if (!user) return unauthorized();
  return ok({ data: await listClaimsForActor({ actorUserId: user.id, role: user.role }) });
}

export async function POST(request: NextRequest) {
  const origin = await enforceSameOriginRequest(request); if (origin) return origin;
  const user = await getCurrentUser(); if (!user) return unauthorized();
  const limit = checkIpRateLimit(request, `claim-create:${user.id}`, RATE_LIMITS.CLAIM_CREATE); if (!limit.ok) return badRequest("CLAIM_RATE_LIMITED");
  const parsed = createSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Validation failed.");
  try { return ok({ data: await createClaim({ claimantUserId: user.id, ...parsed.data }) }); }
  catch (error) { return badRequest(error instanceof ClaimDomainError ? error.code : "CLAIM_CREATE_FAILED"); }
}
