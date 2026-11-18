import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { noStoreJson, paymentApiError, resolveExplicitStoreContextId } from "@/lib/payments/customer-api-policy";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getCustomerPaymentStatus, getOwnedPaymentIdentity } from "@/lib/services/payment-customer-query.service";
import { recoverPendingPaystackPaymentForPaymentId } from "@/lib/services/paystack-verify-recovery.service";
import { CustomerPaymentParamsSchema } from "@/lib/validation/payments";

const ALLOWED_ROLES = new Set(["CUSTOMER", "STORE"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicReference: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return noStoreJson({ error: "Authentication required." }, 401);
  if (!ALLOWED_ROLES.has(user.role)) return noStoreJson({ error: "Payment is unavailable for this account." }, 403);
  const rate = await checkIpRateLimit(request, `payment-status:${user.id}`, RATE_LIMITS.PAYMENT_STATUS);
  if (!rate.ok) return noStoreJson({ error: "Too many status requests." }, 429);
  const parsed = CustomerPaymentParamsSchema.safeParse(await params);
  if (!parsed.success) return noStoreJson({ error: "Payment not found." }, 404);
  try {
    const storeContextId = resolveExplicitStoreContextId(request);
    let payment = await getCustomerPaymentStatus(user.id, parsed.data.publicReference, storeContextId);
    if (!payment) return noStoreJson({ error: "Payment not found." }, 404);
    if (["CREATED", "REQUIRES_ACTION", "PROCESSING"].includes(payment.status)) {
      const identity = await getOwnedPaymentIdentity(user.id, parsed.data.publicReference, storeContextId).catch(() => null);
      if (identity) {
        const recovery = await recoverPendingPaystackPaymentForPaymentId(identity.id, {
          trigger: "customer_status_poll",
        }).catch(() => null);
        if (recovery?.recovered || recovery?.outcome === "FAILED_VIA_VERIFY") {
          payment = (await getCustomerPaymentStatus(user.id, parsed.data.publicReference, storeContextId)) ?? payment;
        }
      }
    }
    return noStoreJson({ payment });
  } catch (error) {
    return paymentApiError(error);
  }
}
