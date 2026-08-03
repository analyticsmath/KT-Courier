import type { NextRequest } from "next/server";
import { notFound, ok, serviceUnavailable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPaymentReconciliationDetail } from "@/lib/services/payment-confirmation-query.service";
import { PaymentReconciliationDetailParamsSchema } from "@/lib/validation/payment-confirmation";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PAYMENT_RECONCILIATION_READ, { request });
  if (auth.response) return auth.response;
  const parsed = PaymentReconciliationDetailParamsSchema.safeParse(await params);
  if (!parsed.success) return notFound("Payment reconciliation case not found.");
  try { const detail = await getPaymentReconciliationDetail(parsed.data.id); return detail ? ok(detail) : notFound("Payment reconciliation case not found."); }
  catch { return serviceUnavailable("Payment reconciliation details are temporarily unavailable."); }
}
