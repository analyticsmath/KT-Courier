import { type NextRequest } from "next/server";
import { badRequest, ok, serviceUnavailable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { PaymentError } from "@/lib/payments/errors";
import { listPayments } from "@/lib/services/payment-query.service";
import { PaymentListQuerySchema, paymentSearchParamsToObject } from "@/lib/validation/payments";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PAYMENTS_READ, { request });
  if (auth.response) return auth.response;

  const parsed = PaymentListQuerySchema.safeParse(paymentSearchParamsToObject(request.nextUrl.searchParams));
  if (!parsed.success) return badRequest("Invalid payment filters.");
  try {
    return ok(await listPayments(parsed.data));
  } catch (error) {
    if (error instanceof PaymentError) return badRequest("Invalid payment filters.");
    return serviceUnavailable("Payments are temporarily unavailable.");
  }
}

