import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { completeManualWithdrawalPayout } from "@/lib/services/withdrawal-payout.service";
import { WithdrawalCompletePayoutSchema } from "@/lib/validation/withdrawals";
import { prepareAdminWithdrawalMutation, readAdminWithdrawalMutationBody } from "@/lib/withdrawals/admin-mutation-route";
import { withdrawalApiError, withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.WITHDRAWALS_PROCESS, { request }); if (auth.response) return auth.response;
  const prepared = await prepareAdminWithdrawalMutation(request, params, "/api/admin/withdrawals/[id]/complete-payout", auth.user.id); if ("response" in prepared) return prepared.response;
  const payload = await readAdminWithdrawalMutationBody(request); if ("response" in payload) return payload.response;
  const parsed = WithdrawalCompletePayoutSchema.safeParse(payload.body); if (!parsed.success) return withdrawalNoStoreJson({ error: "Invalid manual payout evidence." }, 422);
  try { const withdrawal = await completeManualWithdrawalPayout({ actorUserId: auth.user.id, withdrawalPublicReference: prepared.publicReference, payoutAttemptPublicReference: parsed.data.payoutAttemptPublicReference, externalPayoutReference: parsed.data.externalPayoutReference, operationId: parsed.data.operationId, safeEvidenceReference: parsed.data.safeEvidenceReference }); return withdrawalNoStoreJson({ withdrawal: { publicReference: withdrawal.publicReference, status: withdrawal.status } }); }
  catch (error) { return withdrawalApiError(error); }
}
