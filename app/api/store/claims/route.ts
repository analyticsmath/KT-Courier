import { getCurrentUser } from "@/lib/auth/current-user";
import { forbidden, ok, unauthorized } from "@/lib/api/response";
import { listClaimsForActor } from "@/lib/claims/claim.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "STORE") return forbidden();
  return ok({ data: await listClaimsForActor({ actorUserId: user.id, role: user.role }) });
}
