import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/api/response";
import { ClaimDomainError, getClaimForActor } from "@/lib/claims/claim.service";

export async function GET(_request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "DRIVER") return forbidden();
  try { return ok({ data: await getClaimForActor({ publicReference: (await params).reference, actorUserId: user.id, role: user.role }) }); }
  catch (error) { return badRequest(error instanceof ClaimDomainError ? error.code : "CLAIM_READ_FAILED"); }
}
