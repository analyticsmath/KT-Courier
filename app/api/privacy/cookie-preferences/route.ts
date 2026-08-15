import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { RATE_LIMITS, checkIpRateLimit } from "@/lib/security/rate-limit";
import { PrivacyPreferenceError, getCookiePreference, hashAnonymousCookieSubject, safeCookiePreference, setCookiePreference } from "@/lib/privacy/preference.service";

const COOKIE_NAME = "kt_cookie_preference_subject";
const schema = z.object({ functional: z.boolean(), analytics: z.boolean(), marketing: z.boolean(), operationId: z.string().trim().min(8).max(160) }).strict();
async function subject() { const user = await getCurrentUser(); const jar = await cookies(); const anonymous = jar.get(COOKIE_NAME)?.value; return { userId: user?.id ?? null, anonymous, anonymousSubjectHash: user ? null : anonymous ? hashAnonymousCookieSubject(anonymous) : null }; }

export async function GET() { const value = await subject(); return NextResponse.json({ preference: safeCookiePreference(await getCookiePreference(value)) }); }
export async function PATCH(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, { path: new URL(request.url).pathname }); if (originFailure) return originFailure;
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "COOKIE_PREFERENCE_INVALID" }, { status: 422 });
  const limited = await checkIpRateLimit(request, "cookie-preference", RATE_LIMITS.COOKIE_PREFERENCE_MUTATION); if (!limited.ok) return NextResponse.json({ error: limited.failClosed ? "SERVICE_TEMPORARILY_UNAVAILABLE" : "COOKIE_PREFERENCE_RATE_LIMIT" }, { status: limited.failClosed ? 503 : 429 });
  const value = await subject();
  try {
    let anonymousCookie: string | undefined;
    let anonymousSubjectHash: string | null = null;
    if (!value.userId) {
      anonymousCookie = value.anonymous ?? randomUUID();
      anonymousSubjectHash = hashAnonymousCookieSubject(anonymousCookie);
    }
    const preference = await setCookiePreference({ userId: value.userId, anonymousSubjectHash, state: { functional: parsed.data.functional, analytics: parsed.data.analytics, marketing: parsed.data.marketing }, source: value.userId ? "USER_SELF_SERVICE" : "ANONYMOUS_BROWSER", operationId: parsed.data.operationId });
    const response = NextResponse.json({ preference: safeCookiePreference(preference) });
    if (!value.userId && !value.anonymous && anonymousCookie) response.cookies.set(COOKIE_NAME, anonymousCookie, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  }
  catch (error) { return NextResponse.json({ error: error instanceof PrivacyPreferenceError ? error.code : "COOKIE_PREFERENCE_INVALID" }, { status: 422 }); }
}
