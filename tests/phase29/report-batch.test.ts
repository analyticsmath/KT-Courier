import { expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ findMany: vi.fn(), processJob: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { reportJob: { findMany: dependencies.findMany } } }));
vi.mock("@/lib/reporting/services", () => ({ ReportJobService: class { processJob = dependencies.processJob; } }));
import { runReportBatch } from "@/lib/reporting/report-batch";

it("executes a bounded queue and continues after an individual failure", async () => {
  dependencies.findMany.mockResolvedValueOnce([{ publicReference: "REP-1" }, { publicReference: "REP-2" }]);
  dependencies.processJob.mockRejectedValueOnce(new Error("storage failure")).mockResolvedValueOnce({ status: "COMPLETED" });
  expect(await runReportBatch(2)).toEqual({ examined: 2, completed: 1, skipped: 0, failed: 1 });
  expect(dependencies.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2, where: { status: "QUEUED" } }));
  expect(dependencies.processJob).toHaveBeenCalledTimes(2);
});

it("rejects unbounded or invalid batch sizes", async () => {
  await expect(runReportBatch(0)).rejects.toThrow("batch size");
  await expect(runReportBatch(51)).rejects.toThrow("batch size");
});

it("only retries failed jobs when explicitly requested", async () => {
  dependencies.findMany.mockResolvedValueOnce([{ publicReference: "REP-failed" }]);
  dependencies.processJob.mockResolvedValueOnce({ status: "COMPLETED" });
  await runReportBatch(5, "FAILED_RETRYABLE");
  expect(dependencies.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { status: "FAILED_RETRYABLE" }, take: 5 }));
});
