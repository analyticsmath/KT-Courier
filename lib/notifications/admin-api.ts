import { NextResponse } from "next/server";
import { ZodType } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import { resolveNotificationProductionComposition } from "./composition-root";
import { NotificationPolicyError } from "./contracts";

export async function notificationAdminAccess(request: Request, permission: string, mutation = false) {
  if (mutation) {
    const originFailure = await enforceSameOriginRequest(request as never);
    if (originFailure) return { response: originFailure } as const;
  }
  const auth = await requireAdminApiPermission(permission, { request });
  if (auth.response) return auth;
  const rate = checkIpRateLimit(request as never, `notification-admin:${mutation ? "write" : "read"}:${auth.user.id}`, { max: mutation ? 60 : 180, windowMs: 60_000 });
  if (!rate.ok) return { response: NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 }) } as const;
  return { user: auth.user, authority: resolveNotificationProductionComposition().services } as const;
}

export async function parseNotificationBody<T>(request: Request, schema: ZodType<T>) {
  try { return { data: schema.parse(await request.json()) } as const; }
  catch { return { response: NextResponse.json({ error: "Invalid notification request." }, { status: 422 }) } as const; }
}

export function notificationFailure(error: unknown) {
  const code = error instanceof NotificationPolicyError ? error.code : "NOTIFICATION_OPERATION_FAILED";
  const status = code.includes("NOT_FOUND") ? 404 : code.includes("CONFLICT") || code.includes("IMMUTABLE") || code.includes("TRANSITION") || code.includes("SEPARATION") ? 409 : 422;
  return NextResponse.json({ error: code }, { status });
}
