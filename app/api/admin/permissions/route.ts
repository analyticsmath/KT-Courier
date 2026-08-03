import { type NextRequest } from "next/server";
import { requireAdminApiPermission, requireSuperAdminApi } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  listPermissions,
  syncSystemPermissions,
  PermissionServiceError,
} from "@/lib/services/admin-permissions.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { ok, forbidden, serverError } from "@/lib/api/response";

function permissionErrorResponse(error: unknown) {
  if (error instanceof PermissionServiceError && error.code === "FORBIDDEN") {
    return forbidden(error.message);
  }
  return serverError();
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(
    PERMISSIONS.EMPLOYEES_PERMISSIONS_MANAGE,
    { request: req }
  );
  if (auth.response) return auth.response;

  try {
    return ok(await listPermissions());
  } catch {
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireSuperAdminApi({
    request: req,
    message: "Only super admins can sync system permissions",
  });
  if (auth.response) return auth.response;

  try {
    const result = await syncSystemPermissions({
      actor: { id: auth.user.id, role: auth.user.role },
      request: req,
    });
    return ok(result);
  } catch (error) {
    return permissionErrorResponse(error);
  }
}
