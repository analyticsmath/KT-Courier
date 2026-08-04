import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, forbidden } from "@/lib/api/response";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    return forbidden("Admin access required.");
  }

  const artifacts = await db.reportExportArtifact.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
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

  return ok({ data: artifacts });
}
