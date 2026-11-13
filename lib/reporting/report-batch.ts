import { db } from "@/lib/db";
import { logApplicationEvent } from "@/lib/observability/logger";
import { ReportJobService } from "./services";

/** Selection is advisory: processJob performs the atomic status claim. */
export async function runReportBatch(limit = 10) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("Report batch size must be an integer between 1 and 50.");
  const jobs = await db.reportJob.findMany({
    where: { status: "QUEUED" }, take: limit,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { publicReference: true },
  });
  const service = new ReportJobService();
  const result = { examined: jobs.length, completed: 0, skipped: 0, failed: 0 };
  for (const job of jobs) {
    try {
      const outcome = await service.processJob(job.publicReference);
      if (outcome?.status === "COMPLETED") result.completed++;
      else result.skipped++;
    } catch {
      result.failed++;
      logApplicationEvent({ level: "ERROR", event: "report.batch_item_failed", message: "A queued report could not be processed.", operation: "report_batch", resourceReference: job.publicReference, outcome: "FAILURE", errorCategory: "REPORT_GENERATION_FAILED" });
    }
  }
  return result;
}
