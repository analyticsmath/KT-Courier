import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { reverseCommissionAccrual } from "@/lib/services/commission-reversal.service";
import { CommissionAccrualParamsSchema, CommissionReversalSchema } from "@/lib/validation/commissions";
import { commissionApiError, commissionNoStoreJson } from "@/lib/commissions/api-policy";
import { prepareCommissionMutation } from "@/lib/commissions/admin-mutation-route";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSIONS_REVERSE, { request }); if (auth.response) return auth.response;
  const id = CommissionAccrualParamsSchema.safeParse(await params); if (!id.success) return commissionNoStoreJson({ error: "Commission accrual was not found." }, 404);
  const payload = await prepareCommissionMutation(request, auth.user.id, "/api/admin/commissions/[id]/reverse", "reversal"); if ("response" in payload) return payload.response;
  const parsed = CommissionReversalSchema.safeParse(payload.body); if (!parsed.success) return commissionNoStoreJson({ error: "Invalid commission reversal request." }, 422);
  try { return commissionNoStoreJson({ commission: await reverseCommissionAccrual({ accrualId: id.data.id, operationId: parsed.data.operationId, reasonCode: parsed.data.reasonCode, actorUserId: auth.user.id }) }); }
  catch (error) { return commissionApiError(error); }
}
