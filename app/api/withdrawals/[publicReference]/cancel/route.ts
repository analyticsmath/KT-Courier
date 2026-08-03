import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { cancelWithdrawalRequest } from "@/lib/services/withdrawal-request.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { WithdrawalActionSchema, WithdrawalPublicParamsSchema } from "@/lib/validation/withdrawals";
import { validateWithdrawalJsonRequest, withdrawalApiError, withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function POST(request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) {
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/withdrawals/[publicReference]/cancel" });
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return withdrawalNoStoreJson({ error: "Authentication required." }, 401);
  const parameter = WithdrawalPublicParamsSchema.safeParse(await params);
  if (!parameter.success) return withdrawalNoStoreJson({ error: "Withdrawal not found." }, 404);
  const rate = checkIpRateLimit(request, `withdrawal-cancel:${user.id}`, RATE_LIMITS.WITHDRAWAL_MUTATION);
  if (!rate.ok) return withdrawalNoStoreJson({ error: "Too many withdrawal actions." }, 429);
  const requestFailure = validateWithdrawalJsonRequest(request);
  if (requestFailure) return requestFailure;
  let body: unknown; try { body = await request.json(); } catch { return withdrawalNoStoreJson({ error: "Invalid JSON body." }, 422); }
  const parsed = WithdrawalActionSchema.safeParse(body);
  if (!parsed.success) return withdrawalNoStoreJson({ error: "A valid operation ID is required." }, 422);
  try {
    const withdrawal = await cancelWithdrawalRequest({ actorUserId: user.id, publicReference: parameter.data.publicReference, operationId: parsed.data.operationId });
    return withdrawalNoStoreJson({ withdrawal: { publicReference: withdrawal.publicReference, status: withdrawal.status, amount: withdrawal.amount.toFixed(2), currency: "ZAR" } });
  } catch (error) { return withdrawalApiError(error); }
}
