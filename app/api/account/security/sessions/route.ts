import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { revokeSessionById, revokeAllUserSessions } from "@/lib/auth/session";

const revokeSchema = z.object({
  sessionId: z.string().min(1).optional(),
  revokeAllOthers: z.boolean().optional(),
  reason: z.string().max(200).optional(),
}).refine((data) => Boolean(data.sessionId || data.revokeAllOthers), {
  message: "Either sessionId or revokeAllOthers must be provided.",
});

export async function DELETE(request: NextRequest) {
  const origin = await enforceSameOriginRequest(request);
  if (origin) return origin;

  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = revokeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest("INVALID_SESSION_REVOCATION_REQUEST");
  }

  const { sessionId, revokeAllOthers, reason } = parsed.data;
  const revokeReason = reason || "CUSTOMER_MANUAL_REVOKE";

  if (revokeAllOthers) {
    const count = await revokeAllUserSessions({
      userId: user.id,
      reason: revokeReason,
      revokedByUserId: user.id,
    });
    return ok({ revokedCount: count });
  }

  if (sessionId) {
    const success = await revokeSessionById({
      sessionId,
      userId: user.id,
      reason: revokeReason,
      revokedByUserId: user.id,
    });

    if (!success) {
      return notFound("Session not found or already revoked.");
    }

    return ok({ revokedSessionId: sessionId });
  }

  return badRequest("UNHANDLED_REVOCATION_ACTION");
}
