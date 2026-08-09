import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, notFound, forbidden, badRequest } from "@/lib/api/response";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { authorizeReportDefinition, getApprovedReportDefinition } from "@/lib/reporting/authorization";
import { ReportDownloadService } from "@/lib/reporting/services";
import { db } from "@/lib/db";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { getRequestMetadata } from "@/lib/security/request-metadata";

const downloadService = new ReportDownloadService();

async function authorizeArtifactAccess(args: { user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; requesterUserId: string; definitionKey: string; crossOwnerPermission: string }) {
  const definition = getApprovedReportDefinition(args.definitionKey);
  if (args.user.id === args.requesterUserId) {
    await authorizeReportDefinition(args.user, definition, "DOWNLOAD");
    return true;
  }

  if (args.user.role !== "ADMIN" && args.user.role !== "SUPER_ADMIN") return false;
  await authorizeReportDefinition(args.user, definition, "READ");
  return hasPermission({ userId: args.user.id, role: args.user.role, permissionKey: args.crossOwnerPermission });
}

async function resolveAuthorizedArtifact(reference: string, user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  const job = await db.reportJob.findUnique({ where: { publicReference: reference } });
  if (!job) return { response: notFound("Report job not found.") } as const;
  const allowed = await authorizeArtifactAccess({ user, requesterUserId: job.requesterUserId, definitionKey: job.definitionKey, crossOwnerPermission: PERMISSIONS.REPORT_ARTIFACT_READ });
  if (!allowed) return { response: forbidden("You do not have access to this export artifact.") } as const;
  const artifact = await db.reportExportArtifact.findUnique({ where: { jobId: job.id } });
  if (!artifact) return { response: notFound("Export artifact is not available.") } as const;
  if (new Date() >= artifact.expiresAt || job.status === "EXPIRED") return { response: badRequest("Export artifact has expired.") } as const;
  return { job, artifact } as const;
}

/** Retained for the existing browser flow; the returned URL never contains a bearer token. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { reference } = await params;
  const resolved = await resolveAuthorizedArtifact(reference, user);
  if ("response" in resolved) return resolved.response;
  return ok({ data: { downloadUrl: `/api/reports/${encodeURIComponent(reference)}/download` } });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { reference } = await params;
  const resolved = await resolveAuthorizedArtifact(reference, user);
  if ("response" in resolved) return resolved.response;

  try {
    const metadata = getRequestMetadata(req);
    const fileData = await downloadService.getArtifactFile(resolved.artifact.id, user.id, user.role, metadata.ipAddress ?? undefined, metadata.userAgent ?? undefined);
    return new NextResponse(fileData.content.toString("utf8"), {
      headers: {
        "Content-Type": fileData.contentType,
        "Content-Disposition": `attachment; filename="${fileData.filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return badRequest("Export artifact could not be downloaded.");
  }
}
