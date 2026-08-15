import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, badRequest, conflict, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS, getClientIp } from "@/lib/security/rate-limit";
import { AdminOperationalNoteSchema } from "@/lib/validation/pickup";
import { addAdminOperationalNote } from "@/lib/services/admin-pickup-operations.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const ip = getClientIp(req);
  const rl = await checkIpRateLimit(req, `admin:pickup-note:${ip}`, RATE_LIMITS.ADMIN_PICKUP_NOTE);
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

  const parsed = AdminOperationalNoteSchema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fields[issue.path.join(".") || "input"] = issue.message;
    }
    return badRequest("Validation failed.", fields);
  }

  try {
    const result = await addAdminOperationalNote(user, orderId, parsed.data);
    if ("error" in result) return conflict(result.error);
    return ok(result.event);
  } catch (err) {
    console.error("[admin/orders/[id]/operational-note POST]", err);
    return serverError();
  }
}
