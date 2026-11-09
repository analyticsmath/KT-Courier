import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { badRequest, conflict, notFound, ok, unprocessable } from "@/lib/api/response";
import { DriverEngagementSchema, DriverEngagementConflict, setDriverEngagement } from "@/lib/services/driver-engagement.service";

/** The status-management and profile-update authorities must both approve this action. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const origin = await enforceSameOriginRequest(request);
  if (origin) return origin;
  const updateAccess = await requireAdminApiPermission(PERMISSIONS.DRIVERS_UPDATE, { request });
  if (updateAccess.response) return updateAccess.response;
  const statusAccess = await requireAdminApiPermission(PERMISSIONS.DRIVERS_STATUS_MANAGE, { request });
  if (statusAccess.response) return statusAccess.response;
  let raw: unknown;
  try { raw = await request.json(); } catch { return badRequest("Invalid JSON request."); }
  const parsed = DriverEngagementSchema.safeParse(raw);
  if (!parsed.success) return unprocessable("Driver contract type, evidence reference, effective date, and reason are required.");
  const { id } = await context.params;
  try {
    const updated = await setDriverEngagement(id, updateAccess.user.id, parsed.data);
    return updated ? ok(updated) : notFound("Driver profile not found.");
  } catch (error) {
    if (error instanceof DriverEngagementConflict) return conflict(error.message);
    return unprocessable("Driver engagement classification could not be saved. Review the contract evidence.");
  }
}
