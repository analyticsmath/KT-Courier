import { expect, it, vi } from "vitest";
const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { reportReconciliationCase: { findMany } } }));
import { ReportAdministrationService } from "@/lib/reporting/services";

it("exposes the cleanup action without exposing the private storage key", async () => {
  findMany.mockResolvedValueOnce([{ id: "case", publicReference: "ref", reason: "REPORT_STORAGE_FAILURE", status: "OPEN", safeSummary: "Cleanup", openedAt: new Date(), safeEvidence: { source: "report_upload_cleanup", storageKey: "private-key" } }]);
  const result = await new ReportAdministrationService().listReconciliationCases();
  expect(result[0]).toMatchObject({ canCleanup: true });
  expect(JSON.stringify(result)).not.toContain("private-key");
});
