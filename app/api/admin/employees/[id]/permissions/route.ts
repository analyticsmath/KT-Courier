import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  getEffectivePermissionsForAdminUser,
  PermissionServiceError,
  updateUserPermissionOverrides,
} from "@/lib/services/admin-permissions.service";
import { UserPermissionOverridesUpdateSchema } from "@/lib/validation/admin-permissions";
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
    if (error.code === "CONFLICT") return badRequest(error.message);
  }
  return serverError();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(
    PERMISSIONS.EMPLOYEES_PERMISSIONS_MANAGE,
    { request: req }
  );
  if (auth.response) return auth.response;

  const { id } = await params;

  try {
    return ok(await getEffectivePermissionsForAdminUser(id));
  } catch (error) {
    return permissionErrorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(
    PERMISSIONS.EMPLOYEES_PERMISSIONS_MANAGE,
    { request: req }
  );
  if (auth.response) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = UserPermissionOverridesUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const result = await updateUserPermissionOverrides({
      userId: id,
      overrides: parsed.data.overrides,
      actor: { id: auth.user.id, role: auth.user.role },
      request: req,
    });
    return ok(result);
  } catch (error) {
    return permissionErrorResponse(error);
  }
}
