import { ReportReconciliationService } from "@/lib/reporting/reconciliation";
import { logApplicationEvent } from "@/lib/observability/logger";
import { prisma } from "@/lib/db/prisma";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const reconciliation = new ReportReconciliationService();
  const result = await reconciliation.scanReconciliation(!apply);
  logApplicationEvent({
    level: "INFO",
    event: "report_artifact_expiry.completed",
    message: apply ? "Report artifact expiry applied." : "Report artifact expiry dry run completed.",
    operation: "report_artifact_expiry",
    outcome: "SUCCESS",
    context: { apply, artifactsExpired: result.artifactsExpired, casesOpened: result.casesOpened },
  });
  process.stdout.write(`${JSON.stringify({ mode: apply ? "APPLY_COMPLETED" : "DRY_RUN_COMPLETED", ...result })}\n`);
}

main()
  .catch(() => {
    logApplicationEvent({ level: "ERROR", event: "report_artifact_expiry.failed", message: "Report artifact expiry failed.", operation: "report_artifact_expiry", outcome: "FAILURE", errorCategory: "REPORT_ARTIFACT_EXPIRY_FAILED" });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
