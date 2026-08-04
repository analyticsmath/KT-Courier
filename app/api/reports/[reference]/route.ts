import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, notFound, forbidden } from "@/lib/api/response";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
) {
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const { reference } = await params;

  const job = await db.reportJob.findUnique({
    where: { publicReference: reference },
    select: {
      id: true,
      publicReference: true,
      definitionKey: true,
      requesterUserId: true,
      requesterRole: true,
      status: true,
      outputFormat: true,
      rowCount: true,
      createdAt: true,
      errorMessage: true,
    },
  });

  if (!job) return notFound("Report job not found.");

  const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
  if (!isAdmin && job.requesterUserId !== session.id) {
    return forbidden("You do not own this report job.");
  }

  const artifact = await db.reportExportArtifact.findUnique({
    where: { jobId: job.id },
    select: {
      id: true,
      publicReference: true,
      format: true,
      byteSize: true,
      checksum: true,
      downloadCount: true,
      expiresAt: true,
    },
  });

  return ok({
    data: {
      id: job.id,
      publicReference: job.publicReference,
      definitionKey: job.definitionKey,
      requesterRole: job.requesterRole,
      status: job.status,
      outputFormat: job.outputFormat,
      rowCount: job.rowCount,
      createdAt: job.createdAt,
      errorMessage: job.errorMessage,
      artifact,
    },
  });
}
