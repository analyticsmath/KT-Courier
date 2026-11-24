import { type NextRequest } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { hasPermission } from "@/lib/auth/permissions";
import { forbidden } from "@/lib/api/response";
import { noStoreJson, readBoundedPaymentJsonRequest } from "@/lib/payments/customer-api-policy";
import { PaymentError } from "@/lib/payments/errors";
import {
  createSandboxGatewayVerification,
  resolveSandboxAcceptanceConfiguration,
  settleSandboxGatewayVerification,
} from "@/lib/payments/sandbox-acceptance.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

async function authorizeSandboxLane(request: NextRequest) {
  const auth = await requireSuperAdminApi({ request });
  if (auth.response) return auth;
  const canManage = await hasPermission({
    userId: auth.user.id,
    role: auth.user.role,
    permissionKey: PERMISSIONS.SYSTEM_READINESS_MANAGE,
  });
  if (!canManage && auth.user.role !== "SUPER_ADMIN") {
    return { response: forbidden() };
  }
  return auth;
}

function safeError(error: unknown) {
  if (error instanceof PaymentError) {
    if (error.code === "PAYMENT_PROVIDER_RATE_LIMITED") return noStoreJson({ error: "Sandbox verification start limit reached." }, 429);
    if (error.code === "PAYMENT_PAYER_EMAIL_REQUIRED") return noStoreJson({ error: "A valid account email is required." }, 422);
    if (error.code === "PAYMENT_METADATA_INVALID") return noStoreJson({ error: "Invalid verification request." }, 422);
    if (error.code === "PAYMENT_PROVIDER_NOT_CONFIGURED") return noStoreJson({ error: error.message }, 409);
  }
  return noStoreJson({ error: "Sandbox acceptance verification could not be completed safely." }, 503);
}

export async function GET(request: NextRequest) {
  const auth = await authorizeSandboxLane(request);
  if (auth.response) return auth.response;
  const rate = await checkIpRateLimit(request, "sandbox-gateway-status:" + auth.user.id, RATE_LIMITS.PAYMENT_STATUS);
  if (!rate.ok) return noStoreJson({ error: "Too many verification requests." }, 429);

  const reference = request.nextUrl.searchParams.get("reference");
  if (!reference) {
    const config = resolveSandboxAcceptanceConfiguration();
    return noStoreJson({
      eligible: config.eligible,
      reason: config.reason,
      releaseSha: config.releaseSha,
      amount: "10.00",
      currency: "ZAR",
    });
  }
  try {
    const record = await settleSandboxGatewayVerification(reference, {
      actorId: auth.user.id,
      refresh: request.nextUrl.searchParams.get("refresh") === "1",
    });
    return record ? noStoreJson({ verification: record }) : noStoreJson({ error: "Sandbox verification not found." }, 404);
  } catch {
    return noStoreJson({ error: "Sandbox verification status could not be verified safely." }, 503);
  }
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/admin/payment-providers/sandbox-acceptance" });
  if (originFailure) return originFailure;
  const auth = await authorizeSandboxLane(request);
  if (auth.response) return auth.response;
  const rate = await checkIpRateLimit(request, "sandbox-gateway-start:" + auth.user.id, { max: 5, windowMs: 60 * 60 * 1000 });
  if (!rate.ok) return noStoreJson({ error: "Sandbox verification start rate limit reached." }, 429);

  const payload = await readBoundedPaymentJsonRequest(request);
  if ("response" in payload) return payload.response;
  const idempotencyKey = (payload.body as { operationId?: unknown } | null)?.operationId;
  if (typeof idempotencyKey !== "string" || idempotencyKey.length > 80) {
    return noStoreJson({ error: "Valid operation identifier required." }, 422);
  }
  try {
    const result = await createSandboxGatewayVerification({ id: auth.user.id, email: auth.user.email }, idempotencyKey);
    return noStoreJson({ verification: result });
  } catch (error) {
    return safeError(error);
  }
}
