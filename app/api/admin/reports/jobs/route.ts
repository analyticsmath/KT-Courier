import { getCurrentUser } from "@/lib/auth/current-user";
import { ok, unauthorized, forbidden } from "@/lib/api/response";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
    return forbidden("Admin access required.");
  }

  const jobs = await db.reportJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      publicReference: true,
      definitionKey: true,
      requesterRole: true,
      status: true,
      outputFormat: true,
      rowCount: true,
      createdAt: true,
    },
  });

  return ok({ data: jobs });
}
