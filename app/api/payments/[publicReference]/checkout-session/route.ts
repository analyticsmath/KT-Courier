import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { noStoreJson, paymentApiError, readBoundedPaymentJsonRequest, resolveExplicitStoreContextId } from "@/lib/payments/customer-api-policy";
import { createProductionPaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { isPaystackEftChannelApproved } from "@/lib/payments/providers/paystack/paystack-config";
import { validatePaystackAuthorizationUrl } from "@/lib/payments/providers/paystack/paystack-client";
import { PaymentError } from "@/lib/payments/errors";
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
  const validated = await readBoundedPaymentJsonRequest(request);
  if ("response" in validated) return validated.response;
  const parsedParams = CustomerPaymentParamsSchema.safeParse(await params);
  if (!parsedParams.success) return noStoreJson({ error: "Payment not found." }, 404);
  const parsed = PaymentOperationSchema.safeParse(validated.body);
  if (!parsed.success) return noStoreJson({ error: "A valid operationId is required." }, 422);
  try {
    const storeContextId = resolveExplicitStoreContextId(request, parsed.data.storeContextId);
    const payment = await getOwnedPaymentIdentity(user.id, parsedParams.data.publicReference, storeContextId);
    if (!payment) return noStoreJson({ error: "Payment not found." }, 404);
    const registry = createProductionPaymentProviderRegistry();
    registry.getAdapter("PAYSTACK");
    const channel = parsed.data.channel ?? "CARD";
    if (channel === "EFT" && !isPaystackEftChannelApproved()) {
      throw new PaymentError("EFT_UNAVAILABLE", "Paystack EFT channel is not enabled on this merchant account.");
    }
    if (payment.status === "REQUIRES_ACTION" && payment.currentAttemptReference) {
      if (payment.currentActionType === "REDIRECT_GET" && payment.currentRedirectUrl) {
        // A persisted attempt is not a trusted browser redirect: verify it again
        // against the currently approved HTTPS Paystack host list on replay.
        return noStoreJson({ checkoutUrl: validatePaystackAuthorizationUrl(payment.currentRedirectUrl) });
      }
    }
    const session = await createProviderCheckoutSession(
      { id: user.id },
      {
        paymentId: payment.id,
        provider: "PAYSTACK",
        idempotencyKey: parsed.data.operationId,
        channel,
        ...(storeContextId ? { storeContextId } : {}),
      },
      { registry },
    );
    if (!session.attempt.publicReference) {
      return noStoreJson({ error: "Paystack checkout is not ready." }, 503);
    }
    if (session.attempt.checkoutActionType === "REDIRECT_GET" && session.attempt.redirectUrl) {
      return noStoreJson({ checkoutUrl: validatePaystackAuthorizationUrl(session.attempt.redirectUrl) });
    }
    return noStoreJson({ error: "Checkout action is not supported." }, 503);
  } catch (error) {
    return paymentApiError(error);
  }
}
