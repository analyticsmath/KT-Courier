import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok } from "@/lib/api/response";
import { REPORT_DEFINITIONS } from "@/lib/reporting/contracts";

export async function GET(request: Request) {
  const auth = await requireAdminApiPermission(PERMISSIONS.REPORT_DEFINITION_READ, { request });
  if (auth.response) return auth.response;

  return ok({ data: Object.values(REPORT_DEFINITIONS) });
}
