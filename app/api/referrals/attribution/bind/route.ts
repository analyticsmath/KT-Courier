/* eslint-disable @typescript-eslint/no-explicit-any -- canonical binding uses the generated Prisma delegate after Phase 26.5. */
import type { NextRequest } from "next/server";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import { tooManyRequests, unprocessable, serviceUnavailable } from "@/lib/api/response";
import { verifyPromoterReferralToken } from "@/lib/promoters/code-security";
import { resolvePromoterProductionComposition } from "@/lib/promoters/composition-root";
import { bindPromoterAttribution } from "@/lib/promoters/qualification-earning.service";

export async function POST(request: NextRequest) {
  const origin = await enforceSameOriginRequest(request, { path: "/api/referrals/attribution/bind" }); if (origin) return origin;
  const rate = checkIpRateLimit(request, "promoter-attribution-bind", { max: 10, windowMs: 10 * 60 * 1000 }); if (!rate.ok) return tooManyRequests(rate.retryAfterSeconds);
  const root = resolvePromoterProductionComposition(); if (root.status === "LOCKED") return serviceUnavailable("Referral operations are locked pending consolidated validation.");
  try { const body: any = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body) || !body.token || !body.operationId || !body.subjectCreatedAt) return unprocessable("Invalid attribution binding request."); const token = verifyPromoterReferralToken(body.token); if (!["CUSTOMER", "STORE"].includes(body.subjectType)) return unprocessable("Business-customer acquisition is unavailable."); const touch = await (root as any).repositories.touch.findByPublicReference(token.touchReference); if (!touch) return unprocessable("Referral touch is unavailable."); const attribution = await bindPromoterAttribution((root as any).repositories ? (await import("@/lib/db/prisma")).prisma : null, { ...body, touchId: touch.id, programVersionId: touch.programVersionId, subjectCreatedAt: new Date(body.subjectCreatedAt), expiresAt: new Date(Date.now() + 1), requestHash: body.requestHash ?? body.operationId }); return Response.json({ attribution: { publicReference: attribution.publicReference, status: attribution.status } }, { status: 201 }); } catch { return unprocessable("Attribution binding was rejected."); }
}
