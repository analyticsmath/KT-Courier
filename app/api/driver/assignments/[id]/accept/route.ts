import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, badRequest, unauthorized, forbidden, conflict, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS, getClientIp } from "@/lib/security/rate-limit";
import { DispatchAcceptSchema } from "@/lib/validation/assignment";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { acceptDispatchAssignment } from "@/lib/services/dispatch-assignment.service";
import { DispatchError } from "@/lib/dispatch/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const ip = getClientIp(req);
  const rl = checkIpRateLimit(req, `driver:accept:${ip}`, RATE_LIMITS.DRIVER_ACCEPT);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();

  const driverProfileId = await getDriverProfileIdForUser(user.id);
  if (!driverProfileId) return forbidden("Driver profile not found. Contact support.");

  const { id: assignmentId } = await params;

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = DispatchAcceptSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "input"] = issue.message;
    }
    return badRequest("Validation failed.", fields);
  }

  try {
    const assignment = await acceptDispatchAssignment(driverProfileId, assignmentId, parsed.data);
    return ok({ assignmentId: assignment.id, status: assignment.status, version: assignment.version });
  } catch (err) {
    if (err instanceof DispatchError) return conflict(err.message);
    console.error("[driver/assignments/[id]/accept POST]", err);
    return serverError();
  }
}
