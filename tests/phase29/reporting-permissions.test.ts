import { describe, it, expect } from "vitest";
import { PERMISSIONS, DEFAULT_ADMIN_PERMISSION_KEYS } from "@/lib/auth/permission-keys";

describe("Phase 29 Reporting Permissions", () => {
  it("must contain all required reporting permissions", () => {
    expect(PERMISSIONS.REPORT_READ_OWN).toBe("report.read_own");
    expect(PERMISSIONS.REPORT_GENERATE_OWN).toBe("report.generate_own");
    expect(PERMISSIONS.REPORT_EXPORT_OWN).toBe("report.export_own");
    expect(PERMISSIONS.REPORT_DOWNLOAD_OWN).toBe("report.download_own");
    expect(PERMISSIONS.STORE_REPORT_READ).toBe("store_report.read");
    expect(PERMISSIONS.DRIVER_REPORT_READ_OWN).toBe("driver_report.read_own");
    expect(PERMISSIONS.PROMOTER_REPORT_READ_OWN).toBe("promoter_report.read_own");
    expect(PERMISSIONS.REPORT_DEFINITION_READ).toBe("report_definition.read");
    expect(PERMISSIONS.REPORT_JOB_READ).toBe("report_job.read");
    expect(PERMISSIONS.REPORT_ARTIFACT_READ).toBe("report_artifact.read");
    expect(PERMISSIONS.REPORT_RECONCILIATION_READ).toBe("report_reconciliation.read");
  });

  it("must include administration permissions in admin defaults", () => {
    expect(DEFAULT_ADMIN_PERMISSION_KEYS).toContain(PERMISSIONS.REPORT_DEFINITION_READ);
    expect(DEFAULT_ADMIN_PERMISSION_KEYS).toContain(PERMISSIONS.REPORT_JOB_READ);
    expect(DEFAULT_ADMIN_PERMISSION_KEYS).toContain(PERMISSIONS.REPORT_ARTIFACT_READ);
    expect(DEFAULT_ADMIN_PERMISSION_KEYS).toContain(PERMISSIONS.REPORT_RECONCILIATION_READ);
  });
});
