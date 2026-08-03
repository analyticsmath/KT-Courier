import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { prisma } from "@/lib/db/prisma";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import { forbidden, serviceUnavailable, tooManyRequests } from "@/lib/api/response";
import { PROMOTERS_PRODUCTION_VALIDATION_APPROVED } from "./production-readiness";

export async function requirePromoterAdmin(request: NextRequest, permission: string, path: string, mutate = false) {
  const rate = checkIpRateLimit(request, path, { max: mutate ? 30 : 120, windowMs: 10 * 60 * 1000 }); if (!rate.ok) return { response: tooManyRequests(rate.retryAfterSeconds) } as const;
  if (mutate) { const origin = await enforceSameOriginRequest(request, { path }); if (origin) return { response: origin } as const; }
  const auth = await requireAdminApiPermission(permission, { request }); if (auth.response) return auth;
  const denied = await prisma.userPermission.findFirst({ where: { userId: auth.user.id, effect: "DENY", permission: { key: permission } }, select: { id: true } }); if (denied) return { response: forbidden("Administrative promoter permission is explicitly denied.") } as const;
  if (!PROMOTERS_PRODUCTION_VALIDATION_APPROVED) return { response: serviceUnavailable("Promoter operations are locked pending consolidated validation.") } as const;
  return auth;
}
