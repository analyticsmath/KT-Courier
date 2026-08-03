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
  });

  if (!job) return notFound("Report job not found.");

  const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
  if (!isAdmin && job.requesterUserId !== session.id) {
    return forbidden("You do not own this report job.");
  }

  const artifact = await db.reportExportArtifact.findUnique({
    where: { jobId: job.id },
  });

  return ok({
    data: {
      ...job,
      artifact: artifact
        ? {
            publicReference: artifact.publicReference,
            format: artifact.format,
            byteSize: artifact.byteSize,
            checksum: artifact.checksum,
            expiresAt: artifact.expiresAt,
            downloadCount: artifact.downloadCount,
          }
        : null,
    },
  });
}
