import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { badRequest, conflict, forbidden, ok, serverError, tooManyRequests, unauthorized } from "@/lib/api/response";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { recordDriverLocationSample } from "@/lib/services/driver-location-evidence.service";
import { DriverLocationSampleSchema } from "@/lib/validation/driver-location";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, getClientIp, RATE_LIMITS } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;
  const rateLimit = checkIpRateLimit(request, `driver-location:${getClientIp(request)}`, RATE_LIMITS.DRIVER_LOCATION);
  if (!rateLimit.ok) return tooManyRequests(rateLimit.retryAfterSeconds);
  if (request.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() !== "application/json") return badRequest("Content-Type must be application/json.");

  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();
  const driverProfileId = await getDriverProfileIdForUser(user.id);
  if (!driverProfileId) return forbidden("Driver profile not found.");
  const { id: assignmentId } = await context.params;
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4_096) return badRequest("Request body is too large.");
    body = JSON.parse(raw);
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = DriverLocationSampleSchema.safeParse(body);
  if (!parsed.success) return badRequest("Validation failed.");
  try {
    return ok(await recordDriverLocationSample(assignmentId, driverProfileId, user.id, parsed.data));
  } catch (error) {
    if (error instanceof Error) return conflict(error.message);
    return serverError();
  }
}
