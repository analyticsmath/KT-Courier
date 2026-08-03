import type { NextRequest } from "next/server";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { resolveFinanceRefundReference } from "@/lib/services/refund-query.service";
import { RefundAdminParamsSchema } from "@/lib/validation/refunds";
import { refundNoStoreJson, validateRefundJsonRequest } from "./api-policy";

export async function prepareAdminRefundMutation(request: NextRequest, params: Promise<{ id: string }>, path: string, actorUserId: string) {
  const originFailure = await enforceSameOriginRequest(request, { path });
  if (originFailure) return { response: originFailure } as const;
  const parsedParams = RefundAdminParamsSchema.safeParse(await params);
  if (!parsedParams.success) return { response: refundNoStoreJson({ error: "Refund not found." }, 404) } as const;
  const rate = checkIpRateLimit(request, `refund-admin:${actorUserId}`, RATE_LIMITS.REFUND_MUTATION);
  if (!rate.ok) return { response: refundNoStoreJson({ error: "Too many refund actions." }, 429) } as const;
  const requestFailure = validateRefundJsonRequest(request);
  if (requestFailure) return { response: requestFailure } as const;
  const publicReference = await resolveFinanceRefundReference(parsedParams.data.id);
  if (!publicReference) return { response: refundNoStoreJson({ error: "Refund not found." }, 404) } as const;
  return { id: parsedParams.data.id, publicReference } as const;
}

export async function readAdminRefundMutationBody(request: NextRequest): Promise<{ body: unknown } | { response: ReturnType<typeof refundNoStoreJson> }> {
  try { return { body: await request.json() }; }
  catch { return { response: refundNoStoreJson({ error: "Invalid JSON body." }, 422) }; }
}

