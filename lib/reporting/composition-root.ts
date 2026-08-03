import { db } from "@/lib/db";
import { REPORTING_PRODUCTION_LOCK_REASON, assertReportingProductionReady } from "./production-readiness";
import { ReportJobService, ReportDownloadService } from "./services";
import { ReportReconciliationService } from "./reconciliation";

export const REPORTING_PRODUCTION_COMPOSITION_ORDER = [
  "DatabaseConnection",
  "ReportDefinitions",
  "ReportJobService",
  "ReportArtifactService",
  "ReportDownloadService",
  "ReportReconciliationService",
] as const;

export function initializeReportingSubsystem() {
  try {
    assertReportingProductionReady();
    return Object.freeze({
      status: "APPROVED" as const,
      database: db,
      jobService: new ReportJobService(),
      downloadService: new ReportDownloadService(),
      reconciliationService: new ReportReconciliationService(),
    });
  } catch {
    return Object.freeze({
      status: "LOCKED" as const,
      code: REPORTING_PRODUCTION_LOCK_REASON,
      database: db,
      jobService: new ReportJobService(),
      downloadService: new ReportDownloadService(),
      reconciliationService: new ReportReconciliationService(),
    });
  }
}
