import type { NextRequest } from "next/server";
import { notFound, ok, serviceUnavailable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPaymentWebhookDetail } from "@/lib/services/payment-confirmation-query.service";
import { PaymentWebhookDetailParamsSchema } from "@/lib/validation/payment-confirmation";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PAYMENT_WEBHOOKS_READ, { request });
  if (auth.response) return auth.response;
  const parsed = PaymentWebhookDetailParamsSchema.safeParse(await params);
  if (!parsed.success) return notFound("Payment webhook not found.");
  try { const detail = await getPaymentWebhookDetail(parsed.data.id); return detail ? ok(detail) : notFound("Payment webhook not found."); }
  catch { return serviceUnavailable("Payment webhook details are temporarily unavailable."); }
}
