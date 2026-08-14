import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { MARKETING_CHANNELS, PrivacyPreferenceError, getMarketingPreferences, setMarketingPreference } from "@/lib/privacy/preference.service";

const schema = z.object({ channel: z.enum(MARKETING_CHANNELS), optedIn: z.boolean(), operationId: z.string().trim().min(8).max(160), noticeVersion: z.string().trim().min(1).max(120).optional() }).strict();
const auth = async () => { const user = await getCurrentUser(); return user ?? null; };

export async function GET() { const user = await auth(); return user ? NextResponse.json({ preferences: await getMarketingPreferences(user.id) }) : NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 }); }
export async function PATCH(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request, { path: new URL(request.url).pathname }); if (originFailure) return originFailure;
  const user = await auth(); if (!user) return NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "MARKETING_PREFERENCE_INVALID" }, { status: 422 });
  try { const value = await setMarketingPreference({ userId: user.id, ...parsed.data, source: "USER_SELF_SERVICE" }); return NextResponse.json({ preference: { channel: value.channel, status: value.status, updatedAt: value.updatedAt } }); }
  catch (error) { return NextResponse.json({ error: error instanceof PrivacyPreferenceError ? error.code : "MARKETING_PREFERENCE_INVALID" }, { status: 422 }); }
}
