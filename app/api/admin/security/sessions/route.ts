import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { listAdministrativeSessionViews, revokeAdministrativeSessions } from "@/lib/services/admin-security-sessions.service";

const revokeSchema = z.object({
  targetUserId: z.string().trim().min(1).max(128),
  sessionId: z.string().trim().min(1).max(128).optional(),
  reasonCode: z.enum(["SECURITY_REVIEW", "IDENTITY_CHANGED", "SUSPICION", "ACCESS_REMOVED"]),
}).strict();

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.SECURITY_READ, { request });
  if (auth.response) return auth.response;
  const targetUserId = request.nextUrl.searchParams.get("userId")?.trim();
  if (!targetUserId || targetUserId.length > 128) return badRequest("A valid user reference is required.");
  return ok({ data: await listAdministrativeSessionViews(targetUserId) });
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireAdminApiPermission(PERMISSIONS.SECURITY_SESSIONS_MANAGE, { request });
  if (auth.response) return auth.response;
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 2_048) return badRequest("Request body is too large.");
  const parsed = revokeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return unprocessable("Session revocation request is invalid.");
  const result = await revokeAdministrativeSessions({ actorUserId: auth.user.id, ...parsed.data, request });
  return ok({ data: result });
}
