import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { reverseStoreEarning } from "@/lib/services/store-earning-reversal.service";
import { prepareStoreEarningReversalMutation } from "@/lib/store-earnings/admin-mutation-route";
import { storeEarningApiError, storeEarningNoStoreJson } from "@/lib/store-earnings/api-policy";
import { requireStoreEarningFinanceApiPermission } from "@/lib/store-earnings/finance-permission";
import { StoreEarningIdParamsSchema, StoreEarningReversalSchema } from "@/lib/validation/store-earnings";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStoreEarningFinanceApiPermission(PERMISSIONS.STORE_EARNINGS_REVERSE); if ("response" in auth) return auth.response;
  const id = StoreEarningIdParamsSchema.safeParse(await params); if (!id.success) return storeEarningNoStoreJson({ error: "Store earning was not found." }, 404);
  const payload = await prepareStoreEarningReversalMutation(request, auth.user.id); if ("response" in payload) return payload.response;
  const parsed = StoreEarningReversalSchema.safeParse(payload.body); if (!parsed.success) return storeEarningNoStoreJson({ error: "Invalid store earning reversal request." }, 422);
  try { return storeEarningNoStoreJson({ earning: await reverseStoreEarning({ earningId: id.data.id, actorUserId: auth.user.id, ...parsed.data }) }); }
  catch (error) { return storeEarningApiError(error); }
}
