import { db } from "@/lib/db";
import type { ActivationDbClient } from "@/lib/governance/module-activation";
import type { S3EnvSource } from "@/lib/storage/s3-sigv4";
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

export async function initializeReportingSubsystemAsync(
  options: Readonly<{ db?: ActivationDbClient; env?: S3EnvSource; now?: Date; requireGovernanceInNonProd?: boolean }> = {},
) {
  try {
    await assertReportingProductionReady({ requireGovernanceInNonProd: true, ...options });
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

/** Fail-closed synchronous subsystem handle for callers that have not resolved async governance state. */
export function initializeReportingSubsystem() {
  return Object.freeze({
    status: "LOCKED" as const,
    code: REPORTING_PRODUCTION_LOCK_REASON,
    database: db,
    jobService: new ReportJobService(),
    downloadService: new ReportDownloadService(),
    reconciliationService: new ReportReconciliationService(),
  });
}
