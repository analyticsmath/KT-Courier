import {
  REPORTING_PRODUCTION_LOCK_REASON,
  REPORTING_PRODUCTION_VALIDATION_APPROVED,
  ReportingError,
} from "./contracts";

export { REPORTING_PRODUCTION_LOCK_REASON, REPORTING_PRODUCTION_VALIDATION_APPROVED };

export function assertReportingProductionReady(): void {
  if (!REPORTING_PRODUCTION_VALIDATION_APPROVED) {
    throw new ReportingError(
      REPORTING_PRODUCTION_LOCK_REASON,
      423,
      "Live reporting production workflows are locked until Phase 30 consolidated validation is approved."
    );
  }
}
