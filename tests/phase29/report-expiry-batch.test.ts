import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ findMany: vi.fn(), findUnique: vi.fn(), job: vi.fn(), updateMany: vi.fn(), recordDeletion: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { reportExportArtifact: { findMany: mock.findMany, findUnique: mock.findUnique, updateMany: mock.recordDeletion }, reportJob: { findUnique: mock.job, updateMany: mock.updateMany } } }));
vi.mock("@/lib/reporting/artifact-storage", () => ({ getReportArtifactStorage: () => ({ provider: "LOCAL_SECURE", delete: mock.remove }), assertReportStorageReady: vi.fn() }));
import { expireReportArtifacts } from "@/lib/reporting/report-expiry-batch";

beforeEach(() => { vi.clearAllMocks(); });

it("revokes an expired job before deleting its artifact and allows a later retry", async () => {
  const artifact = { id: "artifact", jobId: "job", storageKey: "key", storageProvider: "LOCAL_SECURE", expiresAt: new Date("2026-01-01") };
  mock.findMany.mockResolvedValue([artifact]);
  mock.findUnique.mockResolvedValue(artifact);
  mock.updateMany.mockResolvedValue({ count: 1 });
  mock.job.mockResolvedValue({ status: "EXPIRED" });
  mock.remove.mockRejectedValueOnce(new Error("storage offline")).mockResolvedValueOnce(true);
  const first = await expireReportArtifacts({ limit: 10, now: new Date("2026-11-01") });
  expect(first.failed).toBe(1);
  expect(mock.updateMany.mock.invocationCallOrder[0]).toBeLessThan(mock.remove.mock.invocationCallOrder[0]);
  const second = await expireReportArtifacts({ limit: 10, now: new Date("2026-11-01") });
  expect(second.deleted).toBe(1);
});

it("does not delete an artifact whose stored expiry or key changed", async () => {
  const artifact = { id: "artifact", jobId: "job", storageKey: "old", storageProvider: "LOCAL_SECURE", expiresAt: new Date("2026-01-01") };
  mock.findMany.mockResolvedValue([artifact]);
  mock.findUnique.mockResolvedValue({ ...artifact, storageKey: "new", expiresAt: new Date("2027-01-01") });
  mock.updateMany.mockResolvedValue({ count: 0 });
  const result = await expireReportArtifacts({ limit: 10, now: new Date("2026-11-01") });
  expect(result.skipped).toBe(1);
  expect(mock.remove).not.toHaveBeenCalled();
});
