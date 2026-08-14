import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok } from "@/lib/api/response";
import { listClaimsForActor } from "@/lib/claims/claim.service";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission([PERMISSIONS.CLAIMS_INVESTIGATE, PERMISSIONS.CLAIMS_DECIDE], { request }); if (auth.response) return auth.response;
  return ok({ data: await listClaimsForActor({ actorUserId: auth.user.id, role: auth.user.role }) });
}
