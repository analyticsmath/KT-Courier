import { type NextRequest } from "next/server";
import { requireAdminApiPermission, requireSuperAdminApi } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  createAdminEmployee,
  EmployeeServiceError,
  listAdminEmployees,
} from "@/lib/services/admin-employees.service";
import { AdminEmployeeCreateSchema } from "@/lib/validation/admin-employees";
import { formatZodErrors } from "@/lib/validation/auth";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import {
  ok,
  created,
  badRequest,
  conflict,
  forbidden,
  serverError,
  unprocessable,
} from "@/lib/api/response";

function employeeErrorResponse(error: unknown) {
  if (error instanceof EmployeeServiceError) {
    if (error.code === "FORBIDDEN") return forbidden(error.message);
    if (error.code === "CONFLICT") return conflict(error.message);
    if (error.code === "VALIDATION") return badRequest(error.message);
  }
  return serverError();
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.EMPLOYEES_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  try {
    return ok({ data: await listAdminEmployees() });
  } catch {
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireSuperAdminApi({
    request: req,
    message: "Only super admins can create admin employees",
  });
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = AdminEmployeeCreateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const employee = await createAdminEmployee({
      input: parsed.data,
      actor: { id: auth.user.id, role: auth.user.role },
      request: req,
    });
    return created(employee);
  } catch (error) {
    return employeeErrorResponse(error);
  }
}
