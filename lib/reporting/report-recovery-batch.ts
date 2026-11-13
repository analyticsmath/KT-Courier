import { db } from "@/lib/db";

/** Fence stale attempts before an operator retries them. Legacy claims remain for review. */
export async function recoverExpiredReportClaims({ limit = 50, now = new Date() }: { limit?: number; now?: Date } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isFinite(now.getTime())) throw new Error("Invalid report recovery batch parameters.");
  const jobs = await db.reportJob.findMany({
    where: { status: "RUNNING", claimToken: { not: null }, claimExpiresAt: { lte: now } },
    select: { id: true, claimToken: true }, orderBy: [{ claimExpiresAt: "asc" }, { id: "asc" }], take: limit,
  });
  let recovered = 0;
  for (const job of jobs) {
    const result = await db.reportJob.updateMany({
      where: { id: job.id, status: "RUNNING", claimToken: job.claimToken, claimExpiresAt: { lte: now } },
      data: { status: "FAILED_RETRYABLE", claimToken: null, claimExpiresAt: null, failedAt: now, errorMessage: "REPORT_WORKER_LEASE_EXPIRED" },
    });
    recovered += result.count;
  }
  return { examined: jobs.length, recovered };
}
