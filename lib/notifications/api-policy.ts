/* eslint-disable @typescript-eslint/no-explicit-any -- NextRequest-compatible rate-limit adapter. */
import { getCurrentUser } from "@/lib/auth/current-user";
import { forbidden, tooManyRequests, unauthorized } from "@/lib/api/response";
import { checkIpRateLimit } from "@/lib/security/rate-limit";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permission-keys";

export async function requireNotificationUser(request: Request, mutation = false, permission: PermissionKey = mutation ? PERMISSIONS.NOTIFICATION_MANAGE_OWN_READ_STATE : PERMISSIONS.NOTIFICATION_READ_OWN) {
  const user = await getCurrentUser();
  if (!user) return { response: unauthorized() } as const;
  const rate = await checkIpRateLimit(request as any, `notifications:${mutation ? "write" : "read"}:${user.id}`, { max: mutation ? 60 : 180, windowMs: 60_000 });
  if (!rate.ok) return { response: tooManyRequests() } as const;
  if (!await hasPermission({ userId: user.id, role: user.role, permissionKey: permission })) return { response: forbidden("Notification permission denied.") } as const;
  if (mutation) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host || new URL(origin).host !== host) return { response: forbidden("Same-origin request required.") } as const;
  }
  return { user } as const;
}

export function notificationInboxDto(item: { publicReference: string; title: string; body: string; actionRoute: string | null; state: string; createdAt: Date; expiresAt: Date | null }) {
  return { reference: item.publicReference, title: item.title, body: item.body, actionRoute: item.actionRoute, state: item.state, createdAt: item.createdAt, expiresAt: item.expiresAt };
}
