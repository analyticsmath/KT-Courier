import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listStoreEarningReconciliation } from "@/lib/services/store-earning-query.service";
import { storeEarningApiError, storeEarningNoStoreJson } from "@/lib/store-earnings/api-policy";
import { requireStoreEarningFinanceApiPermission } from "@/lib/store-earnings/finance-permission";
import { StoreEarningReconciliationListQuerySchema, storeEarningSearchParams } from "@/lib/validation/store-earnings";

export async function GET(request: NextRequest) {
  const auth = await requireStoreEarningFinanceApiPermission(PERMISSIONS.STORE_EARNINGS_RECONCILE); if ("response" in auth) return auth.response;
  const parsed = StoreEarningReconciliationListQuerySchema.safeParse(storeEarningSearchParams(request.nextUrl.searchParams)); if (!parsed.success) return storeEarningNoStoreJson({ error: "Invalid reconciliation filters." }, 422);
  try { return storeEarningNoStoreJson(await listStoreEarningReconciliation(parsed.data)); }
  catch (error) { return storeEarningApiError(error); }
}
