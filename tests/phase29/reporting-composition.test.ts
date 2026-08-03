import { describe, it, expect } from "vitest";
import { initializeReportingSubsystem, REPORTING_PRODUCTION_COMPOSITION_ORDER } from "@/lib/reporting/composition-root";
import { REPORTING_PRODUCTION_VALIDATION_APPROVED, REPORTING_PRODUCTION_LOCK_REASON } from "@/lib/reporting/contracts";

describe("Phase 29 Reporting Subsystem Composition", () => {
  it("must define a stable composition order", () => {
    expect(REPORTING_PRODUCTION_COMPOSITION_ORDER.length).toBe(6);
    expect(REPORTING_PRODUCTION_COMPOSITION_ORDER).toContain("DatabaseConnection");
    expect(REPORTING_PRODUCTION_COMPOSITION_ORDER).toContain("ReportDefinitions");
  });

  it("must remain locked when REPORTING_PRODUCTION_VALIDATION_APPROVED is false", () => {
    expect(REPORTING_PRODUCTION_VALIDATION_APPROVED).toBe(false);
    const subsystem = initializeReportingSubsystem();
    expect(subsystem.status).toBe("LOCKED");
    if (subsystem.status === "LOCKED") {
      expect(subsystem.code).toBe(REPORTING_PRODUCTION_LOCK_REASON);
    }
  });
});
