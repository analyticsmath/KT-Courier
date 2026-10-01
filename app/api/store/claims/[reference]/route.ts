import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, ok, unauthorized } from "@/lib/api/response";
import { ClaimDomainError, getClaimForActor } from "@/lib/claims/claim.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/claims/[reference]",
  );
  if (workspaceDenied) return workspaceDenied;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    return ok({
      data: await getClaimForActor({
        publicReference: (await params).reference,
        actorUserId: user.id,
        role: user.role,
      }),
    });
  } catch (error) {
    return badRequest(
      error instanceof ClaimDomainError ? error.code : "CLAIM_READ_FAILED",
    );
  }
}
