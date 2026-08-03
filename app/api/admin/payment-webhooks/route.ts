import type { NextRequest } from "next/server";
import { badRequest, ok, serviceUnavailable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listPaymentWebhooks } from "@/lib/services/payment-confirmation-query.service";
import { confirmationSearchParamsToObject, PaymentWebhookListQuerySchema } from "@/lib/validation/payment-confirmation";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PAYMENT_WEBHOOKS_READ, { request });
  if (auth.response) return auth.response;
  const parsed = PaymentWebhookListQuerySchema.safeParse(confirmationSearchParamsToObject(request.nextUrl.searchParams));
  if (!parsed.success) return badRequest("Invalid payment webhook filters.");
  try { return ok(await listPaymentWebhooks(parsed.data)); }
  catch { return serviceUnavailable("Payment webhooks are temporarily unavailable."); }
}
