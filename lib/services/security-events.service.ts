import { prisma } from "@/lib/db/prisma";
import { getRequestMetadata } from "@/lib/security/request-metadata";
import { Prisma } from "@/types/db";
import { logApplicationEvent, sanitizeLogContext } from "@/lib/observability/logger";

export const SECURITY_EVENT_TYPES = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  SESSION_REVOKED: "SESSION_REVOKED",
  USER_STATUS_BLOCKED_SESSION: "USER_STATUS_BLOCKED_SESSION",
  USER_STATUS_CHANGED: "USER_STATUS_CHANGED",
  ORIGIN_CHECK_FAILED: "ORIGIN_CHECK_FAILED",
  PERMISSIONS_SYNCED: "PERMISSIONS_SYNCED",
  ROLE_PERMISSIONS_UPDATED: "ROLE_PERMISSIONS_UPDATED",
  USER_PERMISSIONS_UPDATED: "USER_PERMISSIONS_UPDATED",
  EMPLOYEE_CREATED: "EMPLOYEE_CREATED",
  EMPLOYEE_UPDATED: "EMPLOYEE_UPDATED",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  SUPER_ADMIN_PROTECTION_TRIGGERED: "SUPER_ADMIN_PROTECTION_TRIGGERED",
  SELF_PERMISSION_CHANGE_BLOCKED: "SELF_PERMISSION_CHANGE_BLOCKED",
  PRODUCTION_CONFIGURATION_REJECTED: "PRODUCTION_CONFIGURATION_REJECTED",
  REPORT_EXPORT_CREATED: "REPORT_EXPORT_CREATED",
} as const;

export type SecurityEventSeverity =
  | "INFO"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export interface RecordSecurityEventInput {
  type: string;
  severity?: SecurityEventSeverity;
  userId?: string | null;
  actorUserId?: string | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  request?: Request;
}

export async function recordSecurityEvent(
  input: RecordSecurityEventInput
): Promise<void> {
  try {
    const requestMetadata = input.request
      ? getRequestMetadata(input.request)
      : { ipAddress: null, userAgent: null };

    await prisma.securityEvent.create({
      data: {
        userId: input.userId ?? null,
        actorUserId: input.actorUserId ?? null,
        type: input.type,
        severity: input.severity ?? "INFO",
        message: input.message ? input.message.replace(/[\r\n\0]/g, " ").slice(0, 512) : null,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
        metadata:
          input.metadata !== undefined && input.metadata !== null
            ? (sanitizeLogContext(input.metadata) as Prisma.InputJsonValue)
            : undefined,
      },
    });
  } catch {
    logApplicationEvent({
      level: "ERROR",
      event: "security_event.write_failed",
      message: "Security event persistence failed.",
      actorReference: input.actorUserId ?? input.userId ?? undefined,
      outcome: "FAILURE",
      errorCategory: "SECURITY_EVENT_WRITE_FAILED",
    });
  }
}
