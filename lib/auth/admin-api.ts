import { type NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import {
  recordSecurityEvent,
  SECURITY_EVENT_TYPES,
} from "@/lib/services/security-events.service";
import { forbidden, unauthorized } from "@/lib/api/response";
import { UserRole } from "@/types/db";
import type { AuthenticatedUser } from "@/types/domain";

export type AdminApiAuthResult =
  | { user: AuthenticatedUser; response?: never }
  | { user?: never; response: NextResponse };

function toPermissionList(permissionKeys: string | string[]): string[] {
  return Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];
}

export async function requireAdminApiPermission(
  permissionKeys: string | string[],
  options?: {
    request?: Request;
    message?: string;
  }
): Promise<AdminApiAuthResult> {
  const user = await getCurrentUser();
  if (!user) return { response: unauthorized() };

  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN) {
    return { response: forbidden() };
  }

  if (user.role === UserRole.SUPER_ADMIN) return { user };

  const requiredPermissionKeys = toPermissionList(permissionKeys);
  const allowedChecks = await Promise.all(
    requiredPermissionKeys.map((permissionKey) =>
      hasPermission({
        userId: user.id,
        role: user.role,
        permissionKey,
      })
    )
  );

  if (allowedChecks.some(Boolean)) return { user };

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.PERMISSION_DENIED,
    severity: "MEDIUM",
    userId: user.id,
    actorUserId: user.id,
    message: options?.message ?? "Admin permission check denied",
    request: options?.request,
    metadata: {
      permissionKeys: requiredPermissionKeys,
    },
  });

  return { response: forbidden() };
}

export async function requireSuperAdminApi(
  options?: {
    request?: Request;
    message?: string;
  }
): Promise<AdminApiAuthResult> {
  const user = await getCurrentUser();
  if (!user) return { response: unauthorized() };

  if (user.role !== UserRole.SUPER_ADMIN) {
    await recordSecurityEvent({
      type: SECURITY_EVENT_TYPES.PERMISSION_DENIED,
      severity: "HIGH",
      userId: user.id,
      actorUserId: user.id,
      message: options?.message ?? "Super admin access required",
      request: options?.request,
      metadata: { requiredRole: UserRole.SUPER_ADMIN },
    });
    return { response: forbidden("Super admin access is required.") };
  }

  return { user };
}
