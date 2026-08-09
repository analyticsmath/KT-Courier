import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, serverError } from "@/lib/api/response";
import { ReportAdministrationService } from "@/lib/reporting/services";

const reports = new ReportAdministrationService();

export async function GET(request: Request) {
  const auth = await requireAdminApiPermission(PERMISSIONS.REPORT_JOB_READ, { request });
  if (auth.response) return auth.response;
  try { return ok({ data: await reports.listJobs() }); } catch { return serverError(); }
}
