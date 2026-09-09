import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { noStoreJson, paymentApiError, validatePaymentJsonRequest } from "@/lib/payments/customer-api-policy";
import { createProductionPaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getOwnedPaymentIdentity } from "@/lib/services/payment-customer-query.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import { CustomerPaymentParamsSchema, PaymentOperationSchema } from "@/lib/validation/payments";

const ALLOWED_ROLES = new Set(["CUSTOMER", "STORE"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicReference: string }> },
) {
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/payments/[publicReference]/checkout-session" });
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return noStoreJson({ error: "Authentication required." }, 401);
  if (!ALLOWED_ROLES.has(user.role)) return noStoreJson({ error: "Payment is unavailable for this account." }, 403);
  const rate = await checkIpRateLimit(request, `payment-checkout:${user.id}`, RATE_LIMITS.PAYMENT_CHECKOUT);
  if (!rate.ok) return noStoreJson({ error: "Too many payment requests." }, 429);
  const requestFailure = validatePaymentJsonRequest(request);
  if (requestFailure) return requestFailure;
  const parsedParams = CustomerPaymentParamsSchema.safeParse(await params);
  if (!parsedParams.success) return noStoreJson({ error: "Payment not found." }, 404);
  let body: unknown;
  try { body = await request.json(); } catch { return noStoreJson({ error: "Invalid JSON body." }, 422); }
  const parsed = PaymentOperationSchema.safeParse(body);
  if (!parsed.success) return noStoreJson({ error: "A valid operationId is required." }, 422);
  try {
    const payment = await getOwnedPaymentIdentity(user.id, parsedParams.data.publicReference);
    if (!payment) return noStoreJson({ error: "Payment not found." }, 404);
    const registry = createProductionPaymentProviderRegistry();
    registry.getAdapter("PAYSTACK");
    if (payment.status === "REQUIRES_ACTION" && payment.currentAttemptReference) {
      if (payment.currentActionType === "REDIRECT_GET" && payment.currentRedirectUrl) {
        return noStoreJson({ checkoutUrl: payment.currentRedirectUrl });
      }
      if (payment.currentActionType === "FORM_POST") {
        return noStoreJson({ checkoutUrl: `/payments/payfast/checkout/${encodeURIComponent(payment.currentAttemptReference)}` });
      }
    }
    const session = await createProviderCheckoutSession(
      { id: user.id },
      { paymentId: payment.id, provider: "PAYSTACK", idempotencyKey: parsed.data.operationId },
      { registry },
    );
    if (!session.attempt.publicReference) {
      return noStoreJson({ error: "Paystack checkout is not ready." }, 503);
    }
    if (session.attempt.checkoutActionType === "REDIRECT_GET" && session.attempt.redirectUrl) {
      return noStoreJson({ checkoutUrl: session.attempt.redirectUrl });
    }
    if (session.attempt.checkoutActionType === "FORM_POST") {
      return noStoreJson({ checkoutUrl: `/payments/payfast/checkout/${encodeURIComponent(session.attempt.publicReference)}` });
    }
    return noStoreJson({ error: "Checkout action is not supported." }, 503);
  } catch (error) {
    return paymentApiError(error);
  }
}
