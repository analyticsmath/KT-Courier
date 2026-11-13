import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ recover: vi.fn(), batch: vi.fn() }));
vi.mock("@/lib/reporting/report-recovery-batch", () => ({ recoverExpiredReportClaims: mock.recover }));
vi.mock("@/lib/reporting/report-batch", () => ({ runReportBatch: mock.batch }));
vi.mock("@/lib/promotions/production-lock", () => ({ isActualProductionInstance: () => false }));
import { PROCESSOR_HANDLERS, type ProcessorHandler } from "@/lib/processors/processor-service";

it("recovers stale claims and processes queued and due retries with a bounded batch", async () => {
  mock.recover.mockResolvedValueOnce({ examined: 1, recovered: 1 });
  mock.batch.mockResolvedValueOnce({ examined: 1, completed: 1, skipped: 0, failed: 0 }).mockResolvedValueOnce({ examined: 1, completed: 1, skipped: 0, failed: 0 });
  const result = await (PROCESSOR_HANDLERS as Record<string, ProcessorHandler>)["generate-report-jobs"]({ mode: "APPLY", batchSize: 4, operationId: "test" });
  expect(mock.recover).toHaveBeenCalledWith({ limit: 4 });
  expect(mock.batch).toHaveBeenNthCalledWith(1, 2, "FAILED_RETRYABLE");
  expect(mock.batch).toHaveBeenNthCalledWith(2, 3, "QUEUED");
  expect(result.itemsCompleted).toBe(2);
});
