import type { NextRequest } from "next/server";
import { resolveFinanceWithdrawalReference } from "@/lib/services/withdrawal-query.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { WithdrawalAdminParamsSchema } from "@/lib/validation/withdrawals";
import { validateWithdrawalJsonRequest, withdrawalNoStoreJson } from "./api-policy";

export async function prepareAdminWithdrawalMutation(request: NextRequest, params: Promise<{ id: string }>, path: string, actorUserId: string) {
  const originFailure = await enforceSameOriginRequest(request, { path });
  if (originFailure) return { response: originFailure } as const;
  const parsedParams = WithdrawalAdminParamsSchema.safeParse(await params);
  if (!parsedParams.success) return { response: withdrawalNoStoreJson({ error: "Withdrawal not found." }, 404) } as const;
  const rate = await checkIpRateLimit(request, `withdrawal-admin:${actorUserId}`, RATE_LIMITS.WITHDRAWAL_MUTATION);
  if (!rate.ok) return { response: withdrawalNoStoreJson({ error: "Too many withdrawal actions." }, 429) } as const;
  const requestFailure = validateWithdrawalJsonRequest(request);
  if (requestFailure) return { response: requestFailure } as const;
  const publicReference = await resolveFinanceWithdrawalReference(parsedParams.data.id);
  if (!publicReference) return { response: withdrawalNoStoreJson({ error: "Withdrawal not found." }, 404) } as const;
  return { publicReference } as const;
}

export async function readAdminWithdrawalMutationBody(request: NextRequest): Promise<{ body: unknown } | { response: ReturnType<typeof withdrawalNoStoreJson> }> {
  try { return { body: await request.json() }; }
  catch { return { response: withdrawalNoStoreJson({ error: "Invalid JSON body." }, 422) }; }
}
