import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { createDispatchCandidateEvaluation, listLatestDispatchCandidateEvaluation } from "@/lib/services/dispatch-candidate-evidence.service";
import { DispatchCandidateEvaluationSchema } from "@/lib/validation/assignment";
import { DispatchError } from "@/lib/dispatch/errors";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, getClientIp, RATE_LIMITS } from "@/lib/security/rate-limit";
import { badRequest, conflict, notFound, ok, serverError, tooManyRequests } from "@/lib/api/response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_READ);
  if (auth.response) return auth.response;
  const { id } = await params;
  try {
    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) return notFound("Order not found.");
    return ok({ evaluation: await listLatestDispatchCandidateEvaluation(order.id) });
  } catch {
    return serverError();
  }
}

/** A candidate listing is a durable administrative evaluation, never a
 * client-supplied eligibility decision. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;
  if (req.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() !== "application/json") return badRequest("Content-Type must be application/json.");
  const rate = await checkIpRateLimit(req, `dispatch:candidates:${getClientIp(req)}`, RATE_LIMITS.DISPATCH_ASSIGN);
  if (!rate.ok) return tooManyRequests(rate.retryAfterSeconds);

  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_READ, { request: req });
  if (auth.response) return auth.response;
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const parsed = DispatchCandidateEvaluationSchema.safeParse(body);
  if (!parsed.success) return badRequest("Validation failed.");

  try {
    const order = await prisma.order.findUnique({ where: { id }, select: { id: true } });
    if (!order) return notFound("Order not found.");
    return ok({ evaluation: await createDispatchCandidateEvaluation({ courierOrderId: order.id, operationId: parsed.data.operationId }) });
  } catch (error) {
    if (error instanceof DispatchError) return conflict(error.message);
    return serverError();
  }
}
