import type { NextRequest } from "next/server";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import { tooManyRequests, unprocessable, serviceUnavailable } from "@/lib/api/response";
import { normalizePromoterCode } from "@/lib/promoters/code-security";
import { resolvePromoterProductionComposition } from "@/lib/promoters/composition-root";

export async function POST(request: NextRequest) {
  const rate = await checkIpRateLimit(request, "promoter-referral-code-resolve", { max: 30, windowMs: 10 * 60 * 1000 }); if (!rate.ok) return tooManyRequests(rate.retryAfterSeconds);
  const root = resolvePromoterProductionComposition(); if (root.status === "LOCKED") return serviceUnavailable("Referral operations are locked pending consolidated validation.");
  try { const body: unknown = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some((key) => key !== "code") || typeof (body as { code?: unknown }).code !== "string") return unprocessable("Invalid referral-code request."); const resolved = await root.services.lifecycle.resolvePromoterReferralCode({ code: normalizePromoterCode((body as { code: string }).code) }); return Response.json({ referral: resolved }); } catch { return unprocessable("Referral code is unavailable."); }
}
