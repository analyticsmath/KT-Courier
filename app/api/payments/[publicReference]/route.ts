import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { noStoreJson } from "@/lib/payments/customer-api-policy";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { getCustomerPaymentStatus } from "@/lib/services/payment-customer-query.service";
import { CustomerPaymentParamsSchema } from "@/lib/validation/payments";

const ALLOWED_ROLES = new Set(["CUSTOMER", "STORE"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ publicReference: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return noStoreJson({ error: "Authentication required." }, 401);
  if (!ALLOWED_ROLES.has(user.role)) return noStoreJson({ error: "Payment is unavailable for this account." }, 403);
  const rate = checkIpRateLimit(request, `payment-status:${user.id}`, RATE_LIMITS.PAYMENT_STATUS);
  if (!rate.ok) return noStoreJson({ error: "Too many status requests." }, 429);
  const parsed = CustomerPaymentParamsSchema.safeParse(await params);
  if (!parsed.success) return noStoreJson({ error: "Payment not found." }, 404);
  const payment = await getCustomerPaymentStatus(user.id, parsed.data.publicReference);
  return payment ? noStoreJson({ payment }) : noStoreJson({ error: "Payment not found." }, 404);
}
