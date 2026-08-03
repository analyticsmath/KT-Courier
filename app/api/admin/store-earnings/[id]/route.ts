import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getFinanceStoreEarning } from "@/lib/services/store-earning-query.service";
import { storeEarningApiError, storeEarningNoStoreJson } from "@/lib/store-earnings/api-policy";
import { requireStoreEarningFinanceApiPermission } from "@/lib/store-earnings/finance-permission";
import { StoreEarningIdParamsSchema } from "@/lib/validation/store-earnings";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStoreEarningFinanceApiPermission(PERMISSIONS.STORE_EARNINGS_READ); if ("response" in auth) return auth.response;
  const parsed = StoreEarningIdParamsSchema.safeParse(await params); if (!parsed.success) return storeEarningNoStoreJson({ error: "Store earning was not found." }, 404);
  try { const earning = await getFinanceStoreEarning(parsed.data.id); return earning ? storeEarningNoStoreJson({ earning }) : storeEarningNoStoreJson({ error: "Store earning was not found." }, 404); }
  catch (error) { return storeEarningApiError(error); }
}
