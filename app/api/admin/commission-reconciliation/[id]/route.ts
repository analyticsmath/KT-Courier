import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getCommissionReconciliation } from "@/lib/services/commission-query.service";
import { CommissionReconciliationParamsSchema } from "@/lib/validation/commissions";
import { commissionNoStoreJson } from "@/lib/commissions/api-policy";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSION_RECONCILIATION_READ, { request }); if (auth.response) return auth.response;
  const parsed = CommissionReconciliationParamsSchema.safeParse(await params); if (!parsed.success) return commissionNoStoreJson({ error: "Commission reconciliation case was not found." }, 404);
  try { const reconciliation = await getCommissionReconciliation(parsed.data.id); return reconciliation ? commissionNoStoreJson({ reconciliation }) : commissionNoStoreJson({ error: "Commission reconciliation case was not found." }, 404); }
  catch { return commissionNoStoreJson({ error: "Commission reconciliation is temporarily unavailable." }, 503); }
}
