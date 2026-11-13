import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ artifact: vi.fn(), job: vi.fn(), audit: vi.fn(), open: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { reportExportArtifact: { findUnique: state.artifact }, reportJob: { findUnique: state.job }, reportDownloadAudit: { create: state.audit } } }));
vi.mock("@/lib/reporting/authorization", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/reporting/authorization")>()), authorizeReportDefinition: vi.fn(async () => {}) }));
import { ReportDownloadService } from "@/lib/reporting/services";

it("refuses a foreign requester before opening the private file", async () => {
  state.artifact.mockResolvedValueOnce({ id: "artifact", jobId: "job", expiresAt: new Date("2030-01-01"), storageKey: "private" });
  state.job.mockResolvedValueOnce({ requesterUserId: "owner", definitionKey: "customer-courier-orders", status: "COMPLETED" });
  const service = new ReportDownloadService({ provider: "LOCAL_SECURE", open: state.open } as never);
  await expect(service.getArtifactFile("artifact", "other", "CUSTOMER")).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.open).not.toHaveBeenCalled();
  expect(state.audit).not.toHaveBeenCalled();
});
