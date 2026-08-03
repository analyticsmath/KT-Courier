import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, notFound, forbidden, badRequest } from "@/lib/api/response";
import { ReportDownloadService } from "@/lib/reporting/services";
import { db } from "@/lib/db";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

const downloadService = new ReportDownloadService();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const { reference } = await params;

  const job = await db.reportJob.findUnique({
    where: { publicReference: reference },
  });

  if (!job) return notFound("Report job not found.");

  const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
  if (!isAdmin && job.requesterUserId !== session.id) {
    return forbidden("You do not own this report job.");
  }

  const artifact = await db.reportExportArtifact.findUnique({
    where: { jobId: job.id },
  });

  if (!artifact) {
    return badRequest("Export artifact is not ready or does not exist.");
  }

  if (new Date() > artifact.expiresAt) {
    return badRequest("Export artifact has expired.");
  }

  const token = downloadService.generateDownloadToken(artifact.id, session.id, session.role, 900);
  const downloadUrl = `/api/reports/${reference}/download?token=${token}`;

  return ok({
    data: {
      downloadUrl,
      token,
      expiresInSeconds: 900,
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const { reference } = await params;
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    const session = await getCurrentUser();
    if (!session) return unauthorized();
    // Re-verify owner if no token
    const job = await db.reportJob.findUnique({ where: { publicReference: reference } });
    if (!job) return notFound("Report job not found.");
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    if (!isAdmin && job.requesterUserId !== session.id) return forbidden("Access denied.");
    const artifact = await db.reportExportArtifact.findUnique({ where: { jobId: job.id } });
    if (!artifact) return notFound("Artifact not found.");

    try {
      const fileData = await downloadService.getArtifactFile(
        artifact.id,
        session.id,
        session.role,
        req.headers.get("x-forwarded-for") || undefined,
        req.headers.get("user-agent") || undefined
      );

      return new NextResponse(fileData.content, {
        headers: {
          "Content-Type": fileData.contentType,
          "Content-Disposition": `attachment; filename="${fileData.filename}"`,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (err: any) {
      return badRequest(err.message || "Failed to download artifact.");
    }
  }

  try {
    const verified = downloadService.verifyDownloadToken(token);
    const job = await db.reportJob.findUnique({ where: { publicReference: reference } });
    if (!job) return notFound("Report job not found.");

    const artifact = await db.reportExportArtifact.findUnique({ where: { jobId: job.id } });
    if (!artifact || artifact.id !== verified.artifactId) {
      return badRequest("Mismatched artifact download token.");
    }

    const fileData = await downloadService.getArtifactFile(
      artifact.id,
      verified.userId,
      verified.role,
      req.headers.get("x-forwarded-for") || undefined,
      req.headers.get("user-agent") || undefined
    );

    return new NextResponse(fileData.content, {
      headers: {
        "Content-Type": fileData.contentType,
        "Content-Disposition": `attachment; filename="${fileData.filename}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err: any) {
    return badRequest(err.message || "Failed to download artifact.");
  }
}
