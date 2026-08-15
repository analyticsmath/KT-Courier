import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  extractSessionToken,
  deleteSessionCookies,
  findSessionWithUser,
  revokeSessionByToken,
} from "@/lib/auth/session";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  recordSecurityEvent,
  SECURITY_EVENT_TYPES,
} from "@/lib/services/security-events.service";

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const cookieStore = await cookies();
  const rawToken = extractSessionToken(cookieStore);
  let userId: string | null = null;

  if (rawToken) {
    try {
      const session = await findSessionWithUser(rawToken);
      userId = session?.user.id ?? null;
      await revokeSessionByToken({
        rawToken,
        reason: "LOGOUT",
        revokedByUserId: userId,
      });
    } catch (error) {
      console.error("Failed to revoke logout session", error);
      // Session may already be expired — continue to clear cookie
    }
  }

  deleteSessionCookies(cookieStore);

  await recordSecurityEvent({
    type: SECURITY_EVENT_TYPES.LOGOUT,
    severity: "INFO",
    userId,
    message: "User logged out",
    request: req,
  });

  return NextResponse.json({ message: "Logged out successfully." });
}
