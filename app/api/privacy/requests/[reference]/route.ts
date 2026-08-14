import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, notFound, ok, unauthorized, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { cancelOwnPrivacyRequest, getPrivacyRequest, PrivacyRequestError } from "@/lib/services/privacy-requests.service";
const schema = z.object({ operationId: z.string().regex(/^DSAROP-[A-Z0-9-]{12,80}$/), confirmCancellation: z.literal(true) }).strict();
export async function GET(_request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const user = await getCurrentUser(); if (!user) return unauthorized(); try { const data = await getPrivacyRequest((await params).reference, user.id); return data ? ok({ data }) : notFound("Privacy request not found."); } catch (e) { return notFound("Privacy request not found."); } }
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const user = await getCurrentUser(); if (!user) return unauthorized(); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Privacy request cancellation validation failed."); try { return ok({ data: await cancelOwnPrivacyRequest({ userId: user.id, publicReference: (await params).reference, operationId: parsed.data.operationId }) }); } catch (e) { return badRequest(e instanceof PrivacyRequestError ? e.code : "PRIVACY_REQUEST_CANCEL_FAILED"); } }
