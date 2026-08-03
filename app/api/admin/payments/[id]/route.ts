import { type NextRequest } from "next/server";
import { notFound, ok, serviceUnavailable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPaymentDetail } from "@/lib/services/payment-query.service";
import { PaymentDetailParamsSchema } from "@/lib/validation/payments";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PAYMENTS_READ, { request });
  if (auth.response) return auth.response;
  const parsed = PaymentDetailParamsSchema.safeParse(await params);
  if (!parsed.success) return notFound("Payment not found.");
  try {
    const detail = await getPaymentDetail(parsed.data.id);
    return detail ? ok(detail) : notFound("Payment not found.");
  } catch {
    return serviceUnavailable("Payment details are temporarily unavailable.");
  }
}

