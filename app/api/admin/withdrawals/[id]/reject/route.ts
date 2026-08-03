import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { rejectWithdrawal } from "@/lib/services/withdrawal-finance-review.service";
import { WithdrawalRejectSchema } from "@/lib/validation/withdrawals";
import { prepareAdminWithdrawalMutation, readAdminWithdrawalMutationBody } from "@/lib/withdrawals/admin-mutation-route";
import { withdrawalApiError, withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.WITHDRAWALS_REVIEW, { request }); if (auth.response) return auth.response;
  const prepared = await prepareAdminWithdrawalMutation(request, params, "/api/admin/withdrawals/[id]/reject", auth.user.id); if ("response" in prepared) return prepared.response;
  const payload = await readAdminWithdrawalMutationBody(request); if ("response" in payload) return payload.response;
  const parsed = WithdrawalRejectSchema.safeParse(payload.body); if (!parsed.success) return withdrawalNoStoreJson({ error: "A valid operation ID and safe reason code are required." }, 422);
  try { const withdrawal = await rejectWithdrawal({ actorUserId: auth.user.id, publicReference: prepared.publicReference, operationId: parsed.data.operationId, reasonCode: parsed.data.reasonCode }); return withdrawalNoStoreJson({ withdrawal: { publicReference: withdrawal.publicReference, status: withdrawal.status } }); }
  catch (error) { return withdrawalApiError(error); }
}
