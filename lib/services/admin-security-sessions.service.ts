import crypto from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { revokeAllUserSessions, revokeSessionById } from "@/lib/auth/session";
import { recordAdminActivity } from "./admin-activity.service";
import { recordSecurityEvent, SECURITY_EVENT_TYPES } from "./security-events.service";

export async function listAdministrativeSessionViews(userId: string) {
  return prisma.session.findMany({
    where: { userId }, orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, createdAt: true, expiresAt: true, revokedAt: true, revokedReason: true },
  });
}

function operationId(): string {
  return `SES-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

export async function revokeAdministrativeSessions(input: {
  actorUserId: string;
  targetUserId: string;
  sessionId?: string;
  reasonCode: "SECURITY_REVIEW" | "IDENTITY_CHANGED" | "SUSPICION" | "ACCESS_REMOVED";
  request?: Request;
}): Promise<{ operationId: string; revokedSessionCount: number }> {
  const operation = operationId();
  const requestHash = crypto.createHash("sha256").update(`${input.actorUserId}:${input.targetUserId}:${input.sessionId ?? "ALL"}:${input.reasonCode}`).digest("hex");
  const revokedSessionCount = input.sessionId
    ? Number(await revokeSessionById({ sessionId: input.sessionId, userId: input.targetUserId, reason: input.reasonCode, revokedByUserId: input.actorUserId }))
    : await revokeAllUserSessions({ userId: input.targetUserId, reason: input.reasonCode, revokedByUserId: input.actorUserId });

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.SESSION_REVOKED,
    severity: "HIGH",
    userId: input.targetUserId,
    actorUserId: input.actorUserId,
    message: "Administrative session revocation completed",
    request: input.request,
    metadata: { operationId: operation, requestHash, reasonCode: input.reasonCode, revokedSessionCount },
  });
  await recordAdminActivity({
    actorUserId: input.actorUserId,
    action: "UPDATE",
    entityType: "Session",
    entityId: input.sessionId ?? input.targetUserId,
    message: "Administrative session revocation completed",
    metadata: { operationId: operation, requestHash, reasonCode: input.reasonCode, revokedSessionCount },
  });
  return { operationId: operation, revokedSessionCount };
}
