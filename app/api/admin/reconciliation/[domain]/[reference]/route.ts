import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getEffectivePermissionKeysForUser } from "@/lib/auth/permissions";
import { notFound, ok } from "@/lib/api/response";
import { getUnifiedReconciliationCase } from "@/lib/reconciliation/service";
import type { ReconciliationDomain } from "@/lib/reconciliation/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string; reference: string }> },
) {
  const auth = await requireAdminApiPermission(
    [
      PERMISSIONS.PAYMENT_RECONCILIATION_READ,
      PERMISSIONS.REFUNDS_RECONCILE,
      PERMISSIONS.WITHDRAWALS_RECONCILE,
      PERMISSIONS.COMMISSION_RECONCILIATION_READ,
      PERMISSIONS.STORE_EARNINGS_RECONCILE,
      PERMISSIONS.DRIVER_EARNINGS_RECONCILE,
      PERMISSIONS.MARKETPLACE_CHECKOUT_RECONCILE,
      PERMISSIONS.STORE_ORDERS_RECONCILE,
      PERMISSIONS.SUBSCRIPTION_CONTRACTS_RECONCILE,
      PERMISSIONS.PROMOTIONS_RECONCILIATION_READ,
      PERMISSIONS.ADVERTISING_RECONCILIATION_READ,
      PERMISSIONS.NOTIFICATION_RECONCILIATION_READ,
      PERMISSIONS.DEVELOPER_RECONCILIATION_READ,
      PERMISSIONS.REPORT_RECONCILIATION_READ,
    ],
    { request },
  );
  if (auth.response) return auth.response;

  const { domain, reference } = await params;
  const effectiveKeys = await getEffectivePermissionKeysForUser({ userId: auth.user.id, role: auth.user.role });
  const actorPermissionKeys = new Set(effectiveKeys);

  try {
    const detail = await getUnifiedReconciliationCase(actorPermissionKeys, domain as ReconciliationDomain, reference);
    if (!detail) return notFound("Reconciliation case not found.");
    return ok({ data: detail });
  } catch (err) {
    return notFound(err instanceof Error ? err.message : "Reconciliation case not found.");
  }
}
