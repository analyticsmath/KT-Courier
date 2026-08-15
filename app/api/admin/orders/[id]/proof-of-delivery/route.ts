import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, badRequest, notFound, conflict, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS, getClientIp } from "@/lib/security/rate-limit";
import { AdminManualDeliverySchema } from "@/lib/validation/delivery";
import { getAdminPodForOrder } from "@/lib/services/proof-of-delivery.service";
import { adminManualDeliveryComplete } from "@/lib/services/delivery-execution.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.ORDERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id: orderId } = await params;

  try {
    const pod = await getAdminPodForOrder(orderId);
    if (!pod) return notFound("No proof of delivery found for this order.");
    return ok(pod);
  } catch (err) {
    console.error("[admin/orders/[id]/proof-of-delivery GET]", err);
    return serverError();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const ip = getClientIp(req);
  const rl = await checkIpRateLimit(req, `admin:delivery:manual:${ip}`, RATE_LIMITS.ADMIN_DELIVERY_MANUAL);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const auth = await requireAdminApiPermission(PERMISSIONS.ORDERS_UPDATE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id: orderId } = await params;

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = AdminManualDeliverySchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "input"] = issue.message;
    }
    return badRequest("Validation failed.", fields);
  }

  try {
    const result = await adminManualDeliveryComplete(orderId, user.id, user.role, parsed.data);
    if (!result.ok) return conflict(result.error);
    return ok({ delivered: true });
  } catch (err) {
    console.error("[admin/orders/[id]/proof-of-delivery POST]", err);
    return serverError();
  }
}
