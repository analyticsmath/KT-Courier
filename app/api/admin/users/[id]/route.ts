import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  getUserDetail,
  adminUpdateUser,
} from "@/lib/services/admin-users.service";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import {
  ok,
  forbidden,
  notFound,
  unprocessable,
  serverError,
} from "@/lib/api/response";
import { AdminUserUpdateSchema } from "@/lib/validation/admin";
import { formatZodErrors } from "@/lib/validation/auth";
import { UserRole, UserStatus } from "@/types/db";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  recordSecurityEvent,
  SECURITY_EVENT_TYPES,
} from "@/lib/services/security-events.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.USERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) return notFound("User not found.");

  return ok(detail);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const initialAuth = await requireAdminApiPermission(
    [PERMISSIONS.USERS_UPDATE, PERMISSIONS.USERS_SUSPEND],
    { request: req }
  );
  if (initialAuth.response) return initialAuth.response;
  let session = initialAuth.user;

  const { id } = await params;

  // Fetch target user to enforce safety rules
  const target = await getUserDetail(id);
  if (!target) return notFound("User not found.");

  // ADMIN cannot modify SUPER_ADMIN or another ADMIN's status
  if (session.role === UserRole.ADMIN) {
    if (
      target.user.role === UserRole.SUPER_ADMIN ||
      target.user.role === UserRole.ADMIN
    ) {
      return forbidden("Admins cannot modify other admin accounts.");
    }
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = AdminUserUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  const statusWillChange =
    parsed.data.status !== undefined && parsed.data.status !== target.user.status;
  const requiredPermission = statusWillChange
    ? PERMISSIONS.USERS_SUSPEND
    : PERMISSIONS.USERS_UPDATE;
  const exactAuth = await requireAdminApiPermission(requiredPermission, {
    request: req,
  });
  if (exactAuth.response) return exactAuth.response;
  session = exactAuth.user;

  if (parsed.data.status && parsed.data.status !== UserStatus.ACTIVE) {
    if (target.user.id === session.id) {
      await recordSecurityEvent({
        type: SECURITY_EVENT_TYPES.USER_STATUS_CHANGED,
        severity: "HIGH",
        userId: target.user.id,
        actorUserId: session.id,
        message: "Blocked admin self-disable attempt",
        request: req,
        metadata: {
          attemptedStatus: parsed.data.status,
        },
      });
      return forbidden("Admins cannot suspend or disable their own account.");
    }

    if (session.role === UserRole.ADMIN && target.user.role === UserRole.SUPER_ADMIN) {
      await recordSecurityEvent({
        type: SECURITY_EVENT_TYPES.USER_STATUS_CHANGED,
        severity: "HIGH",
        userId: target.user.id,
        actorUserId: session.id,
        message: "Blocked admin attempt to change super admin status",
        request: req,
        metadata: {
          attemptedStatus: parsed.data.status,
        },
      });
      return forbidden("Admins cannot modify super admin accounts.");
    }
  }

  try {
    const updated = await adminUpdateUser(
      id,
      parsed.data as { name?: string; phone?: string; status?: UserStatus },
      { actorUserId: session.id, request: req }
    );

    await recordAdminActivity({
      actorUserId: session.id,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      message: `Updated user ${target.user.email}`,
      metadata: { changes: Object.keys(parsed.data) },
    });

    return ok(updated);
  } catch {
    return serverError();
  }
}
