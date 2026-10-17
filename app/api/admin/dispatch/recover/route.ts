import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, badRequest, conflict, notFound, unprocessable, serverError, tooManyRequests } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS, getClientIp } from "@/lib/security/rate-limit";
import { formatZodErrors } from "@/lib/validation/auth";
import { recoverExhaustedDispatchOrder } from "@/lib/services/marketplace-dispatch-eligibility.service";
import { RECOVERY_IDEMPOTENCY_KEY_PATTERN, RECOVERY_REASON_MAX_LENGTH } from "@/lib/dispatch/recovery-constants";
import { DispatchPolicyError } from "@/lib/dispatch/automation-policy.service";

const RecoverDispatchSchema = z
  .object({
    bridgeId: z.string().min(1).max(128).optional(),
    courierOrderId: z.string().min(1).max(128).optional(),
    marketplaceStoreOrderId: z.string().min(1).max(128).optional(),
    reason: z.string().trim().min(1, "Recovery reason is required.").max(RECOVERY_REASON_MAX_LENGTH),
    policyReference: z.string().min(1).max(128).optional(),
    // Mandatory: this request mutates dispatch state and must be exactly-once per operator intent.
    idempotencyKey: z
      .string({ error: "An idempotency key is required." })
      .regex(
        RECOVERY_IDEMPOTENCY_KEY_PATTERN,
        "Idempotency key must be 8-128 characters of letters, digits, '.', '_', ':' or '-'."
      ),
  })
  .refine((data) => Boolean(data.bridgeId || data.courierOrderId || data.marketplaceStoreOrderId), {
    message: "Must provide bridgeId, courierOrderId, or marketplaceStoreOrderId.",
  });

const CONFLICT_CODES = new Set([
  "DISPATCH_RECOVERY_STATE_CONFLICT",
  "DISPATCH_RECOVERY_IDEMPOTENCY_KEY_REUSED",
]);

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const ip = getClientIp(req);
  const rl = await checkIpRateLimit(req, `dispatch:recover:${ip}`, RATE_LIMITS.DISPATCH_ASSIGN);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_MANAGE, { request: req });
  if (auth.response) return auth.response;
  const user = auth.user;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = RecoverDispatchSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const result = await recoverExhaustedDispatchOrder({
      bridgeId: parsed.data.bridgeId,
      courierOrderId: parsed.data.courierOrderId,
      marketplaceStoreOrderId: parsed.data.marketplaceStoreOrderId,
      actorUserId: user.id,
      reason: parsed.data.reason,
      policyReference: parsed.data.policyReference,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return ok({ data: result });
  } catch (err: unknown) {
    if (err instanceof DispatchPolicyError) {
      if (err.code === "DISPATCH_RECOVERY_NOT_FOUND") return notFound(err.message);
      if (CONFLICT_CODES.has(err.code)) return conflict(err.message);
      return badRequest(err.message);
    }
    console.error("[admin/dispatch/recover POST] unexpected failure");
    return serverError();
  }
}
