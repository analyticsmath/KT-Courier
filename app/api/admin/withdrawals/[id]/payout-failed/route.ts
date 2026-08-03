import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { recordWithdrawalPayoutFailure } from "@/lib/services/withdrawal-payout.service";
import { WithdrawalPayoutFailureSchema } from "@/lib/validation/withdrawals";
import { prepareAdminWithdrawalMutation, readAdminWithdrawalMutationBody } from "@/lib/withdrawals/admin-mutation-route";
import { withdrawalApiError, withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.WITHDRAWALS_PROCESS, { request }); if (auth.response) return auth.response;
  const prepared = await prepareAdminWithdrawalMutation(request, params, "/api/admin/withdrawals/[id]/payout-failed", auth.user.id); if ("response" in prepared) return prepared.response;
  const payload = await readAdminWithdrawalMutationBody(request); if ("response" in payload) return payload.response;
  const parsed = WithdrawalPayoutFailureSchema.safeParse(payload.body); if (!parsed.success) return withdrawalNoStoreJson({ error: "Invalid payout failure evidence." }, 422);
  try { const withdrawal = await recordWithdrawalPayoutFailure({ actorUserId: auth.user.id, withdrawalPublicReference: prepared.publicReference, payoutAttemptPublicReference: parsed.data.payoutAttemptPublicReference, operationId: parsed.data.operationId, failureCategory: parsed.data.failureCategory, failureCode: parsed.data.failureCode, safeFailureMessage: parsed.data.safeFailureMessage }); return withdrawalNoStoreJson({ withdrawal: { publicReference: withdrawal.publicReference, status: withdrawal.status } }); }
  catch (error) { return withdrawalApiError(error); }
}
