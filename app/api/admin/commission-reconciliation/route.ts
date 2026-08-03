import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listCommissionReconciliation } from "@/lib/services/commission-query.service";
import { CommissionReconciliationListQuerySchema, commissionSearchParams } from "@/lib/validation/commissions";
import { commissionNoStoreJson } from "@/lib/commissions/api-policy";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSION_RECONCILIATION_READ, { request }); if (auth.response) return auth.response;
  const parsed = CommissionReconciliationListQuerySchema.safeParse(commissionSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) return commissionNoStoreJson({ error: "Invalid commission reconciliation filters." }, 422);
  try { return commissionNoStoreJson(await listCommissionReconciliation(parsed.data)); }
  catch { return commissionNoStoreJson({ error: "Commission reconciliation is temporarily unavailable." }, 503); }
}
