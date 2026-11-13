import { type NextRequest } from "next/server";
import { requireSuperAdminApi } from "@/lib/auth/admin-api";
import { noStoreJson, readBoundedPaymentJsonRequest } from "@/lib/payments/customer-api-policy";
import { PaymentError } from "@/lib/payments/errors";
import { createLiveGatewayVerification, getLiveGatewayVerification, resolveLiveGatewayVerificationConfiguration } from "@/lib/payments/live-gateway-verification.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";

function safeError(error: unknown) {
  if (error instanceof PaymentError) {
    if (error.code === "PAYMENT_PROVIDER_RATE_LIMITED") return noStoreJson({ error: "Live verification charge limit reached. Do not attempt additional charges." }, 429);
    if (error.code === "PAYMENT_PAYER_EMAIL_REQUIRED") return noStoreJson({ error: "A valid account email is required." }, 422);
    if (error.code === "PAYMENT_METADATA_INVALID") return noStoreJson({ error: "Invalid verification request." }, 422);
  }
  return noStoreJson({ error: "Live verification could not be started. Check the existing payment status before another attempt." }, 503);
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdminApi({ request });
  if (auth.response) return auth.response;
  const rate = await checkIpRateLimit(request, "live-gateway-status:" + auth.user.id, RATE_LIMITS.PAYMENT_STATUS);
  if (!rate.ok) return noStoreJson({ error: "Too many verification requests." }, 429);
  const reference = request.nextUrl.searchParams.get("reference");
  if (!reference) {
    const configuration = resolveLiveGatewayVerificationConfiguration();
    return noStoreJson({ eligible: configuration.eligible, reason: configuration.reason, amount: "1.00", currency: "ZAR" });
  }
  try {
    const record = await getLiveGatewayVerification(auth.user.id, reference, request.nextUrl.searchParams.get("refresh") === "1");
    return record ? noStoreJson({ verification: record }) : noStoreJson({ error: "Verification not found." }, 404);
  } catch {
    return noStoreJson({ error: "Payment status could not be verified safely." }, 503);
  }
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/admin/payment-providers/live-verification" });
  if (originFailure) return originFailure;
  const auth = await requireSuperAdminApi({ request });
  if (auth.response) return auth.response;
  const rate = await checkIpRateLimit(request, "live-gateway-start:" + auth.user.id, { max: 3, windowMs: 60 * 60 * 1000 });
  if (!rate.ok) return noStoreJson({ error: "Live verification start rate limit reached." }, 429);
  const payload = await readBoundedPaymentJsonRequest(request);
  if ("response" in payload) return payload.response;
  const idempotencyKey = (payload.body as { operationId?: unknown } | null)?.operationId;
  if (typeof idempotencyKey !== "string" || idempotencyKey.length > 80) return noStoreJson({ error: "Valid operation identifier required." }, 422);
  try {
    const result = await createLiveGatewayVerification({ id: auth.user.id, email: auth.user.email }, idempotencyKey);
    return noStoreJson({ verification: result });
  } catch (error) {
    return safeError(error);
  }
}
