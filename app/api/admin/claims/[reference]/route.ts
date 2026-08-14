import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok } from "@/lib/api/response";
import { getClaimForActor, ClaimDomainError } from "@/lib/claims/claim.service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const auth = await requireAdminApiPermission([PERMISSIONS.CLAIMS_INVESTIGATE, PERMISSIONS.CLAIMS_DECIDE], { request }); if (auth.response) return auth.response;
  try { return ok({ data: await getClaimForActor({ publicReference: (await params).reference, actorUserId: auth.user.id, role: auth.user.role }) }); }
  catch (error) { return badRequest(error instanceof ClaimDomainError ? error.code : "CLAIM_READ_FAILED"); }
}
