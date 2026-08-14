import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { recordClaimFinding, ClaimDomainError } from "@/lib/claims/claim.service";

const schema = z.object({ finding: z.enum(["STORE", "DRIVER", "CUSTOMER", "PLATFORM", "PAYMENT_PROVIDER", "UNDETERMINED", "MULTIPLE"]), reason: z.string().trim().min(2).max(2000), evidenceReference: z.string().trim().max(120).optional() }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.CLAIMS_INVESTIGATE, { request }); if (auth.response) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Validation failed.");
  try { return ok({ data: await recordClaimFinding({ publicReference: (await params).reference, actorUserId: auth.user.id, actorRole: auth.user.role, ...parsed.data }) }); }
  catch (error) { return badRequest(error instanceof ClaimDomainError ? error.code : "CLAIM_FINDING_FAILED"); }
}
