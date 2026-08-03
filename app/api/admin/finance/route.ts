import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getFinanceDashboard } from "@/lib/services/finance-dashboard.service";
import { refundNoStoreJson, requireRefundAdminPermission } from "@/lib/refunds/api-policy";
import { requireStoreEarningFinanceApiPermission } from "@/lib/store-earnings/finance-permission";

export async function GET(request: NextRequest) {
  const auth = await requireRefundAdminPermission([PERMISSIONS.FINANCE_DASHBOARD_READ, PERMISSIONS.FINANCE_REFUNDS_READ], request);
  if ("response" in auth) return auth.response;
  const storeEarningAuth = await requireStoreEarningFinanceApiPermission(PERMISSIONS.FINANCE_STORE_EARNINGS_READ);
  if ("response" in storeEarningAuth) return storeEarningAuth.response;
  try { return refundNoStoreJson(await getFinanceDashboard()); }
  catch { return refundNoStoreJson({ error: "Finance overview is temporarily unavailable." }, 503); }
}
