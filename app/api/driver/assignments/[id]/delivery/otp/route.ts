import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, conflict, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS, getClientIp } from "@/lib/security/rate-limit";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { getDeliveryAssignmentForDriver } from "@/lib/services/delivery-execution.service";
import { generateAndSendDeliveryOtp, getDeliveryOtpStatus } from "@/lib/services/delivery-otp.service";
import { RequestDeliveryOtpSchema } from "@/lib/validation/delivery";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();

  const driverProfileId = await getDriverProfileIdForUser(user.id);
  if (!driverProfileId) return forbidden("Driver profile not found. Contact support.");

  const { id: assignmentId } = await params;

  const assignment = await getDeliveryAssignmentForDriver(assignmentId, driverProfileId);
  if (!assignment) return forbidden("Assignment not found.");

  try {
    const status = await getDeliveryOtpStatus(assignment.orderId);
    return ok(status);
  } catch (err) {
    console.error("[driver/assignments/[id]/delivery/otp GET]", err);
    return serverError();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;
  if (req.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() !== "application/json") return conflict("Content-Type must be application/json.");

  const ip = getClientIp(req);
  const rl = await checkIpRateLimit(req, `delivery:otp:${ip}`, RATE_LIMITS.DELIVERY_OTP_SEND);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.DRIVER) return forbidden();

  const driverProfileId = await getDriverProfileIdForUser(user.id);
  if (!driverProfileId) return forbidden("Driver profile not found. Contact support.");

  const { id: assignmentId } = await params;

  let body: unknown = {};
  try { body = await req.json(); } catch { return conflict("Invalid request body."); }
  const parsed = RequestDeliveryOtpSchema.safeParse(body);
  if (!parsed.success) return conflict("Invalid OTP request.");
  try {
    const result = await generateAndSendDeliveryOtp(assignmentId, driverProfileId, user.id, parsed.data);
    if (!result.ok) return conflict(result.error);
    return ok({ sent: true, replay: result.replay, sentToEmail: result.sentToEmailMasked, expiresAt: result.expiresAt });
  } catch (err) {
    console.error("[driver/assignments/[id]/delivery/otp POST]", err);
    return serverError();
  }
}
