import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ getCase: vi.fn(), findArtifact: vi.fn(), updateCase: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { reportReconciliationCase: { findUnique: mock.getCase, updateMany: mock.updateCase }, reportExportArtifact: { findFirst: mock.findArtifact } } }));
import { ReportReconciliationService } from "@/lib/reporting/reconciliation";

it("does not remove an object referenced by a committed artifact", async () => {
  mock.getCase.mockResolvedValueOnce({ id: "case", status: "OPEN", reason: "REPORT_STORAGE_FAILURE", safeEvidence: { source: "report_upload_cleanup", storageKey: "private", storageProvider: "LOCAL_SECURE" } });
  mock.findArtifact.mockResolvedValueOnce({ id: "artifact" });
  const service = new ReportReconciliationService({ provider: "LOCAL_SECURE", delete: mock.remove } as never);
  await expect(service.cleanupUncommittedObject("case")).rejects.toThrow("referenced");
  expect(mock.remove).not.toHaveBeenCalled();
  expect(mock.updateCase).not.toHaveBeenCalled();
});

it("converges only after an unreferenced object is removed", async () => {
  mock.getCase.mockResolvedValueOnce({ id: "case", status: "OPEN", reason: "REPORT_STORAGE_FAILURE", safeEvidence: { source: "report_upload_cleanup", storageKey: "private", storageProvider: "LOCAL_SECURE" } });
  mock.findArtifact.mockResolvedValueOnce(null);
  mock.remove.mockResolvedValueOnce(true);
  const service = new ReportReconciliationService({ provider: "LOCAL_SECURE", delete: mock.remove } as never);
  await service.cleanupUncommittedObject("case");
  expect(mock.remove).toHaveBeenCalledWith("private");
  expect(mock.updateCase).toHaveBeenCalledOnce();
});
