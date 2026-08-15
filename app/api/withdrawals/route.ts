import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createWithdrawalRequest } from "@/lib/services/withdrawal-request.service";
import { listOwnerWithdrawals } from "@/lib/services/withdrawal-query.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { WithdrawalCreateSchema, WithdrawalListQuerySchema, withdrawalSearchParams } from "@/lib/validation/withdrawals";
import { validateWithdrawalJsonRequest, withdrawalApiError, withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

const ownerRoles = new Set(["STORE", "DRIVER", "PROMOTER"]);

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return withdrawalNoStoreJson({ error: "Authentication required." }, 401);
  if (!ownerRoles.has(user.role)) return withdrawalNoStoreJson({ error: "Withdrawals are unavailable for this account." }, 403);
  const parsed = WithdrawalListQuerySchema.safeParse(withdrawalSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) return withdrawalNoStoreJson({ error: "Invalid withdrawal filters." }, 422);
  try { return withdrawalNoStoreJson(await listOwnerWithdrawals(user.id, parsed.data)); }
  catch { return withdrawalNoStoreJson({ error: "Withdrawals are temporarily unavailable." }, 503); }
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/withdrawals" });
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return withdrawalNoStoreJson({ error: "Authentication required." }, 401);
  if (!ownerRoles.has(user.role)) return withdrawalNoStoreJson({ error: "Withdrawals are unavailable for this account." }, 403);
  const rate = await checkIpRateLimit(request, `withdrawal-request:${user.id}`, RATE_LIMITS.WITHDRAWAL_REQUEST);
  if (!rate.ok) return withdrawalNoStoreJson({ error: "Too many withdrawal requests." }, 429);
  const requestFailure = validateWithdrawalJsonRequest(request);
  if (requestFailure) return requestFailure;
  let body: unknown;
  try { body = await request.json(); } catch { return withdrawalNoStoreJson({ error: "Invalid JSON body." }, 422); }
  const parsed = WithdrawalCreateSchema.safeParse(body);
  if (!parsed.success) return withdrawalNoStoreJson({ error: "Invalid withdrawal request." }, 422);
  try {
    const withdrawal = await createWithdrawalRequest({ actorUserId: user.id, amount: parsed.data.amount, payoutDestinationPublicReference: parsed.data.payoutDestinationPublicReference, operationId: parsed.data.operationId });
    return withdrawalNoStoreJson({ withdrawal: { publicReference: withdrawal.publicReference, amount: withdrawal.amount.toFixed(2), currency: "ZAR", status: withdrawal.status, createdAt: withdrawal.createdAt.toISOString() } }, 201);
  } catch (error) { return withdrawalApiError(error); }
}
