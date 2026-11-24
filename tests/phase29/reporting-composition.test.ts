import { describe, it, expect } from "vitest";
import {
  initializeReportingSubsystem,
  initializeReportingSubsystemAsync,
  REPORTING_PRODUCTION_COMPOSITION_ORDER,
} from "@/lib/reporting/composition-root";
import { REPORTING_PRODUCTION_LOCK_REASON } from "@/lib/reporting/contracts";
import { REPORTING_ACTIVATION_SETTING_KEY } from "@/lib/reporting/activation";

describe("Phase 29 Reporting Subsystem Composition", () => {
  it("must define a stable composition order", () => {
    expect(REPORTING_PRODUCTION_COMPOSITION_ORDER.length).toBe(6);
    expect(REPORTING_PRODUCTION_COMPOSITION_ORDER).toContain("DatabaseConnection");
    expect(REPORTING_PRODUCTION_COMPOSITION_ORDER).toContain("ReportDefinitions");
  });

  it("fails closed when unapproved or unconfigured, and activates with dual-control approval plus durable S3 storage", async () => {
    const syncSubsystem = initializeReportingSubsystem();
    expect(syncSubsystem.status).toBe("LOCKED");
    if (syncSubsystem.status === "LOCKED") {
      expect(syncSubsystem.code).toBe(REPORTING_PRODUCTION_LOCK_REASON);
    }

    const lockedAsync = await initializeReportingSubsystemAsync({
      db: { systemSetting: { findUnique: async () => null } },
      env: { REPORT_ARTIFACT_STORAGE: "local" },
    });
    expect(lockedAsync.status).toBe("LOCKED");

    const approvedAsync = await initializeReportingSubsystemAsync({
      db: {
        systemSetting: {
          findUnique: async ({ where }: { where: { key: string } }) =>
            where.key === REPORTING_ACTIVATION_SETTING_KEY
              ? {
                  value: {
                    status: "APPROVED",
                    requestedByUserId: "maker-1",
                    requestedAt: "2026-11-24T08:00:00.000Z",
                    reason: "Verify durable S3 reporting export readiness",
                    approvedByUserId: "checker-2",
                    approvedAt: "2026-11-24T09:00:00.000Z",
                    approvalNote: "Verified Railway S3 bucket configuration",
                    revokedByUserId: null,
                    revokedAt: null,
                    version: 2,
                  },
                }
              : null,
        },
      },
      env: {
        NODE_ENV: "production",
        REPORT_ARTIFACT_STORAGE: "s3",
        REPORT_ARTIFACT_S3_ENDPOINT: "https://storage.example.test",
        REPORT_ARTIFACT_S3_BUCKET: "kt-reports",
        REPORT_ARTIFACT_S3_ACCESS_KEY_ID: "key_id",
        REPORT_ARTIFACT_S3_SECRET_ACCESS_KEY: "secret_value",
      },
      now: new Date("2026-11-24T10:00:00.000Z"),
    });
    expect(approvedAsync.status).toBe("APPROVED");
  });
});
