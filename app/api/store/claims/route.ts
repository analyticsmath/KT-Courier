import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized } from "@/lib/api/response";
import { listClaimsForActor } from "@/lib/claims/claim.service";

export async function GET() {
  const workspaceDenied = await requireBusinessApi("/api/store/claims");
  if (workspaceDenied) return workspaceDenied;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return ok({
    data: await listClaimsForActor({ actorUserId: user.id, role: user.role }),
  });
}
