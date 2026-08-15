/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 client generation is deferred. */
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import { forbidden, serviceUnavailable, tooManyRequests, unauthorized } from "@/lib/api/response";
import { PROMOTERS_PRODUCTION_VALIDATION_APPROVED } from "./production-readiness";

export async function requirePromoterPermission(permission: string) {
  const user = await getCurrentUser();
  if (!user) return { response: unauthorized() } as const;
  const account = await (prisma as any).promoterAccount.findFirst({ where: { userId: user.id }, select: { id: true, publicReference: true, status: true } });
  if (!account || user.role !== "PROMOTER" || account.status === "SUSPENDED" || account.status === "TERMINATED") return { response: forbidden("Promoter account is not eligible.") } as const;
  const denied = await prisma.userPermission.findFirst({ where: { userId: user.id, effect: "DENY", permission: { key: permission } }, select: { id: true } });
  if (denied || !(await hasPermission({ userId: user.id, role: user.role, permissionKey: permission }))) return { response: forbidden("Promoter permission is explicitly denied or unavailable.") } as const;
  return { user, account } as const;
}

export async function requirePromoterMutation(request: NextRequest, permission: string, endpoint: string) {
  const origin = await enforceSameOriginRequest(request, { path: endpoint }); if (origin) return { response: origin } as const;
  const rate = await checkIpRateLimit(request, endpoint, { max: 30, windowMs: 10 * 60 * 1000 }); if (!rate.ok) return { response: tooManyRequests(rate.retryAfterSeconds) } as const;
  const auth = await requirePromoterPermission(permission); if ("response" in auth) return auth;
  if (!PROMOTERS_PRODUCTION_VALIDATION_APPROVED) return { response: serviceUnavailable("Promoter operations are locked pending consolidated validation.") } as const;
  return auth;
}

export async function requirePromoterRead(permission: string, request?: NextRequest, endpoint = "promoter-read") {
  if (request) {
    const rate = await checkIpRateLimit(request, endpoint, { max: 120, windowMs: 10 * 60 * 1000 });
    if (!rate.ok) return { response: tooManyRequests(rate.retryAfterSeconds) } as const;
  }
  return requirePromoterPermission(permission);
}
export function promoterJson(payload: unknown, status = 200) { return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } }); }
export function safePromoterRow<T extends Record<string, unknown>>(row: T) { const clone = { ...row } as Record<string, unknown>; for (const key of ["legalName", "complianceEvidence", "safeEvidence", "codeHmac", "codeFingerprint", "customerUserId", "businessAccountId", "paymentId", "courierOrderId", "marketplaceOrderId", "marketplaceStoreOrderId", "storeSettlementId"]) delete clone[key]; return clone; }
