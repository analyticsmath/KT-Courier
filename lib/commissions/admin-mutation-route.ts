import type { NextRequest } from "next/server";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { commissionNoStoreJson, validateCommissionJsonRequest } from "./api-policy";

export async function prepareCommissionMutation(request: NextRequest, actorUserId: string, path: string, kind: "plan" | "reversal") {
  const originFailure = await enforceSameOriginRequest(request, { path });
  if (originFailure) return { response: originFailure } as const;
  const rate = checkIpRateLimit(request, `commission:${kind}:${actorUserId}`, kind === "reversal" ? RATE_LIMITS.COMMISSION_REVERSAL : RATE_LIMITS.COMMISSION_PLAN_MUTATION);
  if (!rate.ok) return { response: commissionNoStoreJson({ error: "Too many commission actions." }, 429) } as const;
  const requestFailure = validateCommissionJsonRequest(request);
  if (requestFailure) return { response: requestFailure } as const;
  try { return { body: await request.json() } as const; }
  catch { return { response: commissionNoStoreJson({ error: "Invalid JSON body." }, 422) } as const; }
}
