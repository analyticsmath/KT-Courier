import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, badRequest, unauthorized, forbidden, conflict, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS, getClientIp } from "@/lib/security/rate-limit";
import { DispatchRejectSchema } from "@/lib/validation/assignment";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { rejectDispatchAssignment } from "@/lib/services/dispatch-assignment.service";
import { DispatchError } from "@/lib/dispatch/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const ip = getClientIp(req);
  const rl = checkIpRateLimit(req, `driver:reject:${ip}`, RATE_LIMITS.DRIVER_REJECT);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();

  const driverProfileId = await getDriverProfileIdForUser(user.id);
  if (!driverProfileId) return forbidden("Driver profile not found. Contact support.");

  const { id: assignmentId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = DispatchRejectSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "input"] = issue.message;
    }
    return badRequest("Validation failed.", fields);
  }

  try {
    return ok(await rejectDispatchAssignment(driverProfileId, assignmentId, parsed.data));
  } catch (err) {
    if (err instanceof DispatchError) return conflict(err.message);
    console.error("[driver/assignments/[id]/reject POST]", err);
    return serverError();
  }
}
