import { cookies } from "next/headers";
import {
  extractSessionToken,
  findSessionWithUser,
  isUserStatusAllowedForSession,
  revokeSessionByTokenHash,
} from "./session";
import type { AuthenticatedUser } from "@/types/domain";
import {
  recordSecurityEvent,
  SECURITY_EVENT_TYPES,
} from "@/lib/services/security-events.service";

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const rawToken = extractSessionToken(cookieStore);
  if (!rawToken) return null;

  const session = await findSessionWithUser(rawToken);
  if (!session) return null;

  const { user } = session;
  if (!isUserStatusAllowedForSession(user.status)) {
    await revokeSessionByTokenHash({
      tokenHash: session.tokenHash,
      reason: "USER_STATUS_NOT_ALLOWED",
    });

    await recordSecurityEvent({
      type: SECURITY_EVENT_TYPES.USER_STATUS_BLOCKED_SESSION,
      severity: "HIGH",
      userId: user.id,
      message: "Rejected active session because user status is not allowed",
      metadata: {
        status: user.status,
        sessionId: session.id,
      },
    });

    await recordSecurityEvent({
      type: SECURITY_EVENT_TYPES.SESSION_REVOKED,
      severity: "HIGH",
      userId: user.id,
      message: "Revoked session because user status is not allowed",
      metadata: {
        reason: "USER_STATUS_NOT_ALLOWED",
        status: user.status,
        sessionId: session.id,
      },
    });

    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
  };
}
