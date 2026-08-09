import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, badRequest, unauthorized, forbidden, conflict, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS, getClientIp } from "@/lib/security/rate-limit";
import { StartDeliverySchema } from "@/lib/validation/delivery";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { startDelivery } from "@/lib/services/delivery-execution.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;
  if (req.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() !== "application/json") return badRequest("Content-Type must be application/json.");

  const ip = getClientIp(req);
  const rl = checkIpRateLimit(req, `delivery:start:${ip}`, RATE_LIMITS.DELIVERY_START);
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

  const parsed = StartDeliverySchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "input"] = issue.message;
    }
    return badRequest("Validation failed.", fields);
  }

  try {
    const result = await startDelivery(assignmentId, driverProfileId, user.id, parsed.data);
    if (!result.ok) return conflict(result.error);
    return ok({ ...result.assignment, operationResult: result.operationResult ?? null });
  } catch (err) {
    console.error("[driver/assignments/[id]/delivery/start POST]", err);
    return serverError();
  }
}
