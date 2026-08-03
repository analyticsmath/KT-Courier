import type { NextRequest } from "next/server";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { PayoutDestinationActionSchema, PayoutDestinationParamsSchema } from "@/lib/validation/withdrawals";
import { validateWithdrawalJsonRequest, withdrawalNoStoreJson } from "./api-policy";

export async function preparePayoutDestinationMutation(request: NextRequest, params: Promise<{ id: string }>, path: string, actorUserId: string) {
  const originFailure = await enforceSameOriginRequest(request, { path }); if (originFailure) return { response: originFailure } as const;
  const parsedParams = PayoutDestinationParamsSchema.safeParse(await params); if (!parsedParams.success) return { response: withdrawalNoStoreJson({ error: "Payout destination not found." }, 404) } as const;
  const rate = checkIpRateLimit(request, `payout-destination:${actorUserId}`, RATE_LIMITS.PAYOUT_DESTINATION_MANAGE); if (!rate.ok) return { response: withdrawalNoStoreJson({ error: "Too many payout destination actions." }, 429) } as const;
  const requestFailure = validateWithdrawalJsonRequest(request); if (requestFailure) return { response: requestFailure } as const;
  let body: unknown; try { body = await request.json(); } catch { return { response: withdrawalNoStoreJson({ error: "Invalid JSON body." }, 422) } as const; }
  const parsed = PayoutDestinationActionSchema.safeParse(body); if (!parsed.success) return { response: withdrawalNoStoreJson({ error: "A valid operation ID is required." }, 422) } as const;
  return { publicReference: parsedParams.data.id, operationId: parsed.data.operationId } as const;
}
