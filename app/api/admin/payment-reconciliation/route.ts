import type { NextRequest } from "next/server";
import { badRequest, ok, serviceUnavailable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listPaymentReconciliation } from "@/lib/services/payment-confirmation-query.service";
import { confirmationSearchParamsToObject, PaymentReconciliationListQuerySchema } from "@/lib/validation/payment-confirmation";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PAYMENT_RECONCILIATION_READ, { request });
  if (auth.response) return auth.response;
  const parsed = PaymentReconciliationListQuerySchema.safeParse(confirmationSearchParamsToObject(request.nextUrl.searchParams));
  if (!parsed.success) return badRequest("Invalid payment reconciliation filters.");
  try { return ok(await listPaymentReconciliation(parsed.data)); }
  catch { return serviceUnavailable("Payment reconciliation is temporarily unavailable."); }
}
