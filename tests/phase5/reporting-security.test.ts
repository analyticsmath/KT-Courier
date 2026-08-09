import { describe, expect, it } from "vitest";
import { LocalSecureReportArtifactStorage } from "@/lib/reporting/artifact-storage";
import { normalizeReportRequest } from "@/lib/reporting/authorization";
import { REPORT_DEFINITIONS } from "@/lib/reporting/contracts";
import { sanitizeCsvCell } from "@/lib/reporting/csv-sanitizer";

describe("Phase 5 reporting security", () => {
  it("rejects traversal and absolute artifact storage keys", async () => {
    const storage = new LocalSecureReportArtifactStorage("artifacts/phase5-test-reports");
    await expect(storage.open("../secret.csv")).rejects.toMatchObject({ code: "INVALID_ARTIFACT_STORAGE_KEY" });
    await expect(storage.open("C:/secret.csv")).rejects.toMatchObject({ code: "INVALID_ARTIFACT_STORAGE_KEY" });
  });

  it("rejects arbitrary report fields and unavailable formats", () => {
    const definition = REPORT_DEFINITIONS["customer-courier-orders"]!;
    expect(() => normalizeReportRequest({ definition, filters: { arbitrarySql: "select *" }, outputFormat: "CSV" })).toThrow(/unsupported/i);
    expect(() => normalizeReportRequest({ definition, filters: {}, outputFormat: "XLSX" })).toThrow(/not available/i);
  });

  it("neutralizes spreadsheet formula injection after leading whitespace", () => {
    expect(sanitizeCsvCell(" =SUM(1,2)")).toContain("' =SUM");
    expect(sanitizeCsvCell("@EXEC")).toBe("'@EXEC");
  });
});
