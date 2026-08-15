import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { UserRole } from "@/types/db";
import { ok, unauthorized, forbidden, conflict, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS, getClientIp } from "@/lib/security/rate-limit";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { getDeliveryAssignmentForDriver } from "@/lib/services/delivery-execution.service";
import { generateAndSendDeliveryOtp, getDeliveryOtpStatus } from "@/lib/services/delivery-otp.service";
import { prisma } from "@/lib/db/prisma";
import { RequestDeliveryOtpSchema } from "@/lib/validation/delivery";
import { assertAcceptedCurrentDriver } from "@/lib/driver-operations/authority";
import { abandonReservedOperation, completeReservedOperation, findOperationReplay, reserveOperation } from "@/lib/driver-operations/idempotency";

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
    const replay = await findOperationReplay(parsed.data.operationId, parsed.data);
    if (replay) return ok({ sent: true, replay: true, expiresAt: replay.completedAt });
    await assertAcceptedCurrentDriver(assignmentId, driverProfileId, parsed.data.assignmentVersion);
  } catch (error) {
    return conflict(error instanceof Error ? error.message : "OTP request was rejected.");
  }

  const assignment = await getDeliveryAssignmentForDriver(assignmentId, driverProfileId);
  if (!assignment) return forbidden("Assignment not found.");
  if (!["IN_TRANSIT", "DELIVERY_ATTEMPTED"].includes(assignment.orderStatus)) return conflict("OTP can only be requested while delivery is in transit.");

  // Fetch the full order to get recipient email
  const order = await prisma.order.findUnique({
    where: { id: assignment.orderId },
    include: {
      customer: { select: { email: true, name: true } },
      store: { include: { ownerUser: { select: { email: true, name: true } } } },
    },
  });

  if (!order) return conflict("Order not found.");

  let recipientEmail: string | null = null;
  let recipientName: string = "Recipient";

  if (order.customer?.email) {
    recipientEmail = order.customer.email;
    recipientName = order.customer.name ?? recipientName;
  } else if (order.store?.ownerUser?.email) {
    recipientEmail = order.store.ownerUser.email;
    recipientName = order.store.ownerUser.name ?? recipientName;
  }

  if (!recipientEmail) {
    return conflict("No recipient email on file for this order. Cannot send OTP.");
  }

  try {
    await reserveOperation({ operationId: parsed.data.operationId, payload: parsed.data, orderId: order.id, assignmentId, driverProfileId, type: "DELIVERY_OTP_REQUEST" });
    const result = await generateAndSendDeliveryOtp(
      order.id,
      assignmentId,
      user.id,
      recipientEmail,
      recipientName,
      order.orderNumber,
      order.source,
      parsed.data.operationId
    );

    if (!result.ok) {
      await abandonReservedOperation(parsed.data.operationId);
      return conflict(result.error);
    }
    await completeReservedOperation(parsed.data.operationId, {
      type: "DELIVERY_OTP_REQUEST", orderId: order.id, assignmentId, driverProfileId,
      orderStatus: order.status, assignmentStatus: assignment.assignmentStatus,
      completedAt: new Date().toISOString(),
    });

    return ok({
      sent: true,
      sentToEmail: result.sentToEmailMasked,
      expiresAt: result.expiresAt,
    });
  } catch (err) {
    const replay = await findOperationReplay(parsed.data.operationId, parsed.data).catch(() => null);
    if (replay) return ok({ sent: true, replay: true, expiresAt: replay.completedAt });
    await abandonReservedOperation(parsed.data.operationId);
    console.error("[driver/assignments/[id]/delivery/otp POST]", err);
    return serverError();
  }
}
