import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, badRequest, conflict, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS, getClientIp } from "@/lib/security/rate-limit";
import { DispatchOfferSchema } from "@/lib/validation/assignment";
import { offerAssignment } from "@/lib/services/dispatch-assignment.service";
import { DispatchError } from "@/lib/dispatch/errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const ip = getClientIp(req);
  const rl = await checkIpRateLimit(req, `dispatch:assign:${ip}`, RATE_LIMITS.DISPATCH_ASSIGN);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_ASSIGN, {
    request: req,
  });
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id: orderId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const parsed = DispatchOfferSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "input";
      fields[key] = issue.message;
    }
    return badRequest("Validation failed.", fields);
  }

  try {
    const assignment = await offerAssignment(user.id, orderId, parsed.data);
    return ok({ assignmentId: assignment.id, status: assignment.status, version: assignment.version, expiresAt: assignment.expiresAt });
  } catch (err) {
    if (err instanceof DispatchError) return conflict(err.message);
    console.error("[admin/orders/[id]/assign POST]", err);
    return serverError();
  }
}
