import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { noStoreJson, paymentApiError, validatePaymentJsonRequest } from "@/lib/payments/customer-api-policy";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { OrderPaymentParamsSchema, PaymentOperationSchema } from "@/lib/validation/payments";

const ALLOWED_ROLES = new Set(["CUSTOMER", "STORE"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/orders/[id]/payment" });
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return noStoreJson({ error: "Authentication required." }, 401);
  if (!ALLOWED_ROLES.has(user.role)) return noStoreJson({ error: "Payment is unavailable for this account." }, 403);
  const rate = checkIpRateLimit(request, `payment-prepare:${user.id}`, RATE_LIMITS.PAYMENT_PREPARE);
  if (!rate.ok) return noStoreJson({ error: "Too many payment requests." }, 429);
  const requestFailure = validatePaymentJsonRequest(request);
  if (requestFailure) return requestFailure;
  const resolvedParams = await params;
  const parsedParams = OrderPaymentParamsSchema.safeParse({ orderId: resolvedParams.id });
  if (!parsedParams.success) return noStoreJson({ error: "Order not found." }, 404);
  let body: unknown;
  try { body = await request.json(); } catch { return noStoreJson({ error: "Invalid JSON body." }, 422); }
  const parsed = PaymentOperationSchema.safeParse(body);
  if (!parsed.success) return noStoreJson({ error: "A valid operationId is required." }, 422);
  try {
    const payment = await prepareOrderPayment(
      { id: user.id, email: user.email },
      { orderId: parsedParams.data.orderId, idempotencyKey: parsed.data.operationId },
    );
    return noStoreJson({
      payment: {
        publicReference: payment.publicReference,
        orderReference: payment.order.reference,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        status: payment.status,
        updatedAt: payment.updatedAt,
      },
    });
  } catch (error) {
    return paymentApiError(error);
  }
}
