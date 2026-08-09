import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, badRequest, forbidden } from "@/lib/api/response";
import { ReportJobService } from "@/lib/reporting/services";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { authorizeReportDefinition, getApprovedReportDefinition } from "@/lib/reporting/authorization";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { db } from "@/lib/db";

const jobService = new ReportJobService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const { reference } = await params;
  const job = await db.reportJob.findUnique({ where: { publicReference: reference } });
  if (!job) return badRequest("Report job is not available.");
  const definition = getApprovedReportDefinition(job.definitionKey);
  let isAdmin = false;
  if (job.requesterUserId === session.id) await authorizeReportDefinition(session, definition, "READ");
  else if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
    await authorizeReportDefinition(session, definition, "READ");
    isAdmin = await hasPermission({ userId: session.id, role: session.role, permissionKey: PERMISSIONS.REPORT_JOB_CANCEL });
  } else return forbidden("You do not have access to this report job.");

  try {
    const updated = await jobService.cancelJob(reference, session.id, isAdmin);
    return ok({ data: updated });
  } catch {
    return badRequest("Report job could not be cancelled.");
  }
}
