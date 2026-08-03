import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listFinanceStoreEarnings } from "@/lib/services/store-earning-query.service";
import { storeEarningApiError, storeEarningNoStoreJson } from "@/lib/store-earnings/api-policy";
import { requireStoreEarningFinanceApiPermission } from "@/lib/store-earnings/finance-permission";
import { FinanceStoreEarningListQuerySchema, storeEarningSearchParams } from "@/lib/validation/store-earnings";

export async function GET(request: NextRequest) {
  const auth = await requireStoreEarningFinanceApiPermission(PERMISSIONS.STORE_EARNINGS_READ); if ("response" in auth) return auth.response;
  const parsed = FinanceStoreEarningListQuerySchema.safeParse(storeEarningSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) return storeEarningNoStoreJson({ error: "Invalid store earning filters." }, 422);
  try { return storeEarningNoStoreJson(await listFinanceStoreEarnings(parsed.data)); }
  catch (error) { return storeEarningApiError(error); }
}
