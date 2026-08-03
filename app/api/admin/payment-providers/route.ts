import { type NextRequest } from "next/server";
import { ok, serviceUnavailable } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listPaymentProviders } from "@/lib/services/payment-query.service";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PAYMENT_PROVIDERS_READ, { request });
  if (auth.response) return auth.response;
  try {
    return ok(listPaymentProviders());
  } catch {
    return serviceUnavailable("Payment provider readiness is temporarily unavailable.");
  }
}

