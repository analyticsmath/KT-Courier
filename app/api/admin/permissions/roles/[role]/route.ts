import { type NextRequest } from "next/server";
import { requireAdminApiPermission, requireSuperAdminApi } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  getRolePermissions,
  updateRolePermissions,
  PermissionServiceError,
} from "@/lib/services/admin-permissions.service";
import { RolePermissionsUpdateSchema, parseUserRole } from "@/lib/validation/admin-permissions";
import { formatZodErrors } from "@/lib/validation/auth";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  ok,
  badRequest,
  forbidden,
  notFound,
  serverError,
  unprocessable,
} from "@/lib/api/response";

function permissionErrorResponse(error: unknown) {
  if (error instanceof PermissionServiceError) {
    if (error.code === "FORBIDDEN") return forbidden(error.message);
    if (error.code === "NOT_FOUND") return notFound(error.message);
    if (error.code === "VALIDATION") return badRequest(error.message);
  }
  return serverError();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  const auth = await requireAdminApiPermission(
    PERMISSIONS.EMPLOYEES_PERMISSIONS_MANAGE,
    { request: req }
  );
  if (auth.response) return auth.response;

  const { role: rawRole } = await params;
  const role = parseUserRole(rawRole);
  if (!role) return badRequest("Invalid role.");

  try {
    return ok(await getRolePermissions(role));
  } catch (error) {
    return permissionErrorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireSuperAdminApi({
    request: req,
    message: "Only super admins can update role permissions",
  });
  if (auth.response) return auth.response;

  const { role: rawRole } = await params;
  const role = parseUserRole(rawRole);
  if (!role) return badRequest("Invalid role.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = RolePermissionsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const result = await updateRolePermissions({
      role,
      permissionKeys: parsed.data.permissionKeys,
      actor: { id: auth.user.id, role: auth.user.role },
      request: req,
    });
    return ok(result);
  } catch (error) {
    return permissionErrorResponse(error);
  }
}
