import { type NextRequest } from "next/server";
import { ok, unprocessable, serverError } from "@/lib/api/response";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { currentCompanyProfile, activateCompanyProfile } from "@/lib/services/company-profile.service";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { formatZodErrors } from "@/lib/validation/auth";
import { CompanyProfileUpdateSchema } from "@/lib/validation/company-profile";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMPANY_SETTINGS_READ, { request: req });
  if (auth.response) return auth.response;
  try {
    return ok(await currentCompanyProfile());
  } catch {
    return serverError();
  }
}

export async function PUT(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;
  const auth = await requireAdminApiPermission(PERMISSIONS.COMPANY_SETTINGS_MANAGE, { request: req });
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }
  const parsed = CompanyProfileUpdateSchema.safeParse(body);
  if (!parsed.success) return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));

  try {
    return ok(await activateCompanyProfile(auth.user.id, parsed.data));
  } catch {
    return serverError();
  }
}
