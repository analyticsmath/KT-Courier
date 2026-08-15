import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, ok, unauthorized, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { createPrivacyRequest, listOwnPrivacyRequests, PRIVACY_REQUEST_TYPES, PrivacyRequestError } from "@/lib/services/privacy-requests.service";

const schema = z.object({ requestType: z.enum(PRIVACY_REQUEST_TYPES), scope: z.array(z.string().trim().min(1).max(80)).max(20).optional(), requestContext: z.record(z.string(), z.string().trim().max(240)).optional(), operationId: z.string().regex(/^DSAROP-[A-Z0-9-]{12,80}$/) }).strict();
export async function GET() { const user = await getCurrentUser(); if (!user) return unauthorized(); return ok({ data: await listOwnPrivacyRequests(user.id) }); }
export async function POST(request: NextRequest) {
  const origin = await enforceSameOriginRequest(request); if (origin) return origin;
  const user = await getCurrentUser(); if (!user) return unauthorized();
  const rate = await checkIpRateLimit(request, `privacy-request:${user.id}`, RATE_LIMITS.PRIVACY_REQUEST_SUBMISSION); if (!rate.ok) return badRequest("PRIVACY_REQUEST_RATE_LIMITED");
  const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Privacy request validation failed.");
  try { return ok({ data: await createPrivacyRequest({ requesterUserId: user.id, ...parsed.data }) }); } catch (error) { return badRequest(error instanceof PrivacyRequestError ? error.code : "PRIVACY_REQUEST_CREATE_FAILED"); }
}
