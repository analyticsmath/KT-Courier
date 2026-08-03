import type { NextRequest } from "next/server";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { storeEarningNoStoreJson, validateStoreEarningJsonRequest } from "./api-policy";

export async function prepareStoreEarningReversalMutation(request: NextRequest, actorUserId: string) {
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/admin/store-earnings/[id]/reverse" });
  if (originFailure) return { response: originFailure } as const;
  const rate = checkIpRateLimit(request, `store-earning-reversal:${actorUserId}`, RATE_LIMITS.COMMISSION_REVERSAL);
  if (!rate.ok) return { response: storeEarningNoStoreJson({ error: "Too many store earning reversal actions." }, 429) } as const;
  const requestFailure = validateStoreEarningJsonRequest(request);
  if (requestFailure) return { response: requestFailure } as const;
  try { return { body: await request.json() } as const; }
  catch { return { response: storeEarningNoStoreJson({ error: "Invalid JSON body." }, 422) } as const; }
}
