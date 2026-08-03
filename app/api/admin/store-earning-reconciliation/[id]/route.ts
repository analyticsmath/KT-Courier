import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getStoreEarningReconciliation } from "@/lib/services/store-earning-query.service";
import { storeEarningApiError, storeEarningNoStoreJson } from "@/lib/store-earnings/api-policy";
import { requireStoreEarningFinanceApiPermission } from "@/lib/store-earnings/finance-permission";
import { StoreEarningReconciliationParamsSchema } from "@/lib/validation/store-earnings";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStoreEarningFinanceApiPermission(PERMISSIONS.STORE_EARNINGS_RECONCILE); if ("response" in auth) return auth.response;
  const parsed = StoreEarningReconciliationParamsSchema.safeParse(await params); if (!parsed.success) return storeEarningNoStoreJson({ error: "Store earning reconciliation was not found." }, 404);
  try { const reconciliation = await getStoreEarningReconciliation(parsed.data.id); return reconciliation ? storeEarningNoStoreJson({ reconciliation }) : storeEarningNoStoreJson({ error: "Store earning reconciliation was not found." }, 404); }
  catch (error) { return storeEarningApiError(error); }
}
