import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { decideClaimRemedy, ClaimDomainError } from "@/lib/claims/claim.service";

const schema = z.object({ remedy: z.enum(["NO_REMEDY", "REDELIVERY", "REPLACEMENT", "PARTIAL_REFUND", "FULL_REFUND", "STORE_CREDIT"]), reason: z.string().trim().min(2).max(2000), operationId: z.string().regex(/^CLMR-[A-Z0-9-]{12,100}$/), amount: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/).optional(), policyReference: z.string().trim().max(160).optional(), mixedPaymentStrategy: z.string().trim().max(160).optional(), evidenceReference: z.string().trim().max(120).optional() }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.CLAIMS_DECIDE, { request }); if (auth.response) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Validation failed.");
  try { return ok({ data: await decideClaimRemedy({ publicReference: (await params).reference, actorUserId: auth.user.id, actorRole: auth.user.role, ...parsed.data }) }); }
  catch (error) { return badRequest(error instanceof ClaimDomainError ? error.code : "CLAIM_REMEDY_FAILED"); }
}
