import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { beginWithdrawalReview } from "@/lib/services/withdrawal-finance-review.service";
import { WithdrawalActionSchema } from "@/lib/validation/withdrawals";
import { prepareAdminWithdrawalMutation, readAdminWithdrawalMutationBody } from "@/lib/withdrawals/admin-mutation-route";
import { withdrawalApiError, withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.WITHDRAWALS_REVIEW, { request }); if (auth.response) return auth.response;
  const prepared = await prepareAdminWithdrawalMutation(request, params, "/api/admin/withdrawals/[id]/review", auth.user.id); if ("response" in prepared) return prepared.response;
  const payload = await readAdminWithdrawalMutationBody(request); if ("response" in payload) return payload.response;
  const parsed = WithdrawalActionSchema.safeParse(payload.body); if (!parsed.success) return withdrawalNoStoreJson({ error: "A valid operation ID is required." }, 422);
  try { const withdrawal = await beginWithdrawalReview({ actorUserId: auth.user.id, publicReference: prepared.publicReference, operationId: parsed.data.operationId }); return withdrawalNoStoreJson({ withdrawal: { publicReference: withdrawal.publicReference, status: withdrawal.status } }); }
  catch (error) { return withdrawalApiError(error); }
}
