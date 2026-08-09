import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, notFound, forbidden } from "@/lib/api/response";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { authorizeReportDefinition, getApprovedReportDefinition } from "@/lib/reporting/authorization";
import { db } from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  const { reference } = await params;
  const job = await db.reportJob.findUnique({ where: { publicReference: reference } });
  if (!job) return notFound("Report job not found.");

  const definition = getApprovedReportDefinition(job.definitionKey);
  let allowed = false;
  if (job.requesterUserId === session.id) {
    await authorizeReportDefinition(session, definition, "READ");
    allowed = true;
  } else if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
    await authorizeReportDefinition(session, definition, "READ");
    allowed = await hasPermission({ userId: session.id, role: session.role, permissionKey: PERMISSIONS.REPORT_JOB_READ });
  }
  if (!allowed) return forbidden("You do not have access to this report job.");

  const artifact = await db.reportExportArtifact.findUnique({ where: { jobId: job.id }, select: { publicReference: true, format: true, byteSize: true, checksum: true, downloadCount: true, expiresAt: true } });
  return ok({
    data: {
      id: job.id, publicReference: job.publicReference, definitionKey: job.definitionKey,
      requesterRole: job.requesterRole, status: job.status, outputFormat: job.outputFormat,
      rowCount: job.rowCount, createdAt: job.createdAt,
      errorMessage: job.errorMessage ? "Report generation did not complete." : null,
      artifact: artifact && new Date() < artifact.expiresAt ? artifact : null,
    },
  });
}
