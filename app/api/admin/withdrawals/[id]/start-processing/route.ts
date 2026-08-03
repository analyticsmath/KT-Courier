import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { startWithdrawalPayout } from "@/lib/services/withdrawal-payout.service";
import { WithdrawalActionSchema } from "@/lib/validation/withdrawals";
import { prepareAdminWithdrawalMutation, readAdminWithdrawalMutationBody } from "@/lib/withdrawals/admin-mutation-route";
import { withdrawalApiError, withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.WITHDRAWALS_PROCESS, { request }); if (auth.response) return auth.response;
  const prepared = await prepareAdminWithdrawalMutation(request, params, "/api/admin/withdrawals/[id]/start-processing", auth.user.id); if ("response" in prepared) return prepared.response;
  const payload = await readAdminWithdrawalMutationBody(request); if ("response" in payload) return payload.response;
  const parsed = WithdrawalActionSchema.safeParse(payload.body); if (!parsed.success) return withdrawalNoStoreJson({ error: "A valid operation ID is required." }, 422);
  try { const attempt = await startWithdrawalPayout({ actorUserId: auth.user.id, publicReference: prepared.publicReference, operationId: parsed.data.operationId }); return withdrawalNoStoreJson({ payoutAttempt: { publicReference: attempt.publicReference, status: attempt.status } }); }
  catch (error) { return withdrawalApiError(error); }
}
