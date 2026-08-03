import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  EmployeeServiceError,
  getAdminEmployee,
  updateAdminEmployee,
} from "@/lib/services/admin-employees.service";
import { AdminEmployeeUpdateSchema } from "@/lib/validation/admin-employees";
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

function employeeErrorResponse(error: unknown) {
  if (error instanceof EmployeeServiceError) {
    if (error.code === "FORBIDDEN") return forbidden(error.message);
    if (error.code === "NOT_FOUND") return notFound(error.message);
    if (error.code === "VALIDATION") return badRequest(error.message);
  }
  return serverError();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.EMPLOYEES_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id } = await params;
  const employee = await getAdminEmployee(id);
  if (!employee) return notFound("Admin employee not found.");

  return ok(employee);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.EMPLOYEES_UPDATE, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = AdminEmployeeUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const employee = await updateAdminEmployee({
      id,
      input: parsed.data,
      actor: { id: auth.user.id, role: auth.user.role },
      request: req,
    });
    return ok(employee);
  } catch (error) {
    return employeeErrorResponse(error);
  }
}
