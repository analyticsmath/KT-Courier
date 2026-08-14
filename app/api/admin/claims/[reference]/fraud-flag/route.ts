import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { ClaimDomainError, flagClaimForFraudReview } from "@/lib/claims/claim.service";

const schema = z.object({ reason: z.string().trim().min(2).max(2000) }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const origin = await enforceSameOriginRequest(request); if (origin) return origin;
  const auth = await requireAdminApiPermission(PERMISSIONS.CLAIMS_INVESTIGATE, { request }); if (auth.response) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Validation failed.");
  try { return ok({ data: await flagClaimForFraudReview({ publicReference: (await params).reference, actorUserId: auth.user.id, actorRole: auth.user.role, ...parsed.data }) }); }
  catch (error) { return badRequest(error instanceof ClaimDomainError ? error.code : "CLAIM_FRAUD_FLAG_FAILED"); }
}
