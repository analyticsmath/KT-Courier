import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { driverEarningNoStoreJson, validateDriverEarningJsonRequest } from "./api-policy";

export async function prepareDriverEarningReversalMutation(request: NextRequest, actorUserId: string) {
  const originFailure = await enforceSameOriginRequest(request, { path: "/api/admin/driver-earnings/[id]/reverse" });
  if (originFailure) return { response: originFailure } as const;
  const rate = checkIpRateLimit(request, `driver-earning-reversal:${actorUserId}`, RATE_LIMITS.COMMISSION_REVERSAL);
  if (!rate.ok) return { response: driverEarningNoStoreJson({ error: "Too many driver earning reversal actions." }, 429) } as const;
  const requestFailure = validateDriverEarningJsonRequest(request); if (requestFailure) return { response: requestFailure } as const;
  try { return { body: await request.json() } as const; } catch { return { response: driverEarningNoStoreJson({ error: "Invalid JSON body." }, 422) } as const; }
}

export async function recordDriverEarningAdminMutation(request: NextRequest, input: Readonly<{ actorUserId: string; entityId: string; message: string; operationId: string; reasonCode: string; evidenceReference: string }>): Promise<void> {
  await prisma.adminActivityLog.create({ data: { actorUserId: input.actorUserId, action: "UPDATE", entityType: "DriverEarning", entityId: input.entityId, message: input.message, metadata: { operationId: input.operationId, reasonCode: input.reasonCode, evidenceReference: input.evidenceReference, sourceAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null } } });
}
