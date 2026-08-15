import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit, type RateLimitPolicy } from "@/lib/security/rate-limit";
import { UserRole } from "@/types/db";
import { ManagedMarketingRequestError, type ManagedMarketingRequestActor } from "./managed-marketing.service";

const reference = z.string().trim().min(1).max(120);
const selection = z.object({ channelReference: reference, placementReferences: z.array(reference).min(1).max(30) }).strict();
const draftFields = {
  packageReference: reference,
  selections: z.array(selection).min(1).max(20),
  objective: z.string().trim().min(1).max(160),
  audience: z.record(z.string(), z.unknown()).default({}),
  message: z.string().trim().min(1).max(4000),
  destinationLink: z.string().trim().url().max(2000),
  instructions: z.string().trim().max(4000).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  operationId: reference,
  requestHash: z.string().trim().min(1).max(256).optional(),
};

export const createDraftSchema = z.object({ ...draftFields, executionMode: z.enum(["MANUAL", "AUTOMATED_PROVIDER"]).default("MANUAL") }).strict();
export const updateDraftSchema = z.object({ ...draftFields, executionMode: z.enum(["MANUAL", "AUTOMATED_PROVIDER"]).optional() }).strict();
export const creativeSchema = z.object({ source: z.enum(["PRIVATE_MEDIA", "CATALOG_MEDIA"]), mediaReference: reference, role: z.string().trim().min(1).max(80).optional() }).strict();
export const submitSchema = z.object({ operationId: reference }).strict();
export const paymentSchema = z.object({ operationId: reference }).strict();

export async function storeMarketingActor(permission: string): Promise<{ actor: ManagedMarketingRequestActor } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "AUTHENTICATION_REQUIRED" }, { status: 401 }) };
  if (user.role !== UserRole.STORE || !(await hasPermission({ userId: user.id, role: user.role, permissionKey: permission }))) return { response: NextResponse.json({ error: "MANAGED_MARKETING_REQUEST_FORBIDDEN" }, { status: 403 }) };
  return { actor: { actorUserId: user.id, actorRole: user.role } };
}

export async function prepareStoreMarketingMutation(request: NextRequest, actor: ManagedMarketingRequestActor, policy: RateLimitPolicy) {
  const originFailure = await enforceSameOriginRequest(request, { path: new URL(request.url).pathname });
  if (originFailure) return { response: originFailure } as const;
  const result = await checkIpRateLimit(request, `managed-marketing:${actor.actorUserId}`, policy);
  if (!result.ok) return { response: NextResponse.json({ error: result.failClosed ? "SERVICE_TEMPORARILY_UNAVAILABLE" : "MANAGED_MARKETING_RATE_LIMIT" }, { status: result.failClosed ? 503 : 429, headers: result.retryAfterSeconds ? { "Retry-After": String(result.retryAfterSeconds) } : undefined }) } as const;
  return {} as const;
}

export async function parseStoreMarketingBody<T extends z.ZodTypeAny>(request: NextRequest, schema: T): Promise<z.infer<T> | NextResponse> {
  try { return schema.parse(await request.json()); }
  catch { return NextResponse.json({ error: "MANAGED_MARKETING_REQUEST_INVALID" }, { status: 422 }); }
}

export function isStoreMarketingResponse(value: unknown): value is NextResponse { return value instanceof NextResponse; }

export function storeMarketingError(error: unknown) {
  const code = error instanceof ManagedMarketingRequestError ? error.code : "MANAGED_MARKETING_REQUEST_FAILED";
  const status = /(?:FORBIDDEN|NOT_ALLOWED)$/.test(code) ? 403 : /NOT_FOUND$/.test(code) ? 404 : /(?:LOCKED|CONFLICT|ALREADY_ATTACHED)$/.test(code) ? 409 : 422;
  return NextResponse.json({ error: code }, { status });
}
