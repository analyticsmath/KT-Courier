import { expect, it, vi } from "vitest";
const expiry = vi.hoisted(() => vi.fn());
vi.mock("@/lib/reporting/report-expiry-batch", () => ({ expireReportArtifacts: expiry }));
vi.mock("@/lib/promotions/production-lock", () => ({ isActualProductionInstance: () => false }));
import { PROCESSOR_HANDLERS, type ProcessorHandler } from "@/lib/processors/processor-service";

it("executes bounded artifact expiry and reports completed work", async () => {
  expiry.mockResolvedValueOnce({ examined: 2, deleted: 1, alreadyAbsent: 1, skipped: 0, failed: 0 });
  const handler = (PROCESSOR_HANDLERS as Record<string, ProcessorHandler>)["expire-report-artifacts"];
  const result = await handler({ mode: "APPLY", batchSize: 20, operationId: "test" });
  expect(expiry).toHaveBeenCalledWith({ limit: 20 });
  expect(result).toMatchObject({ itemsExamined: 2, itemsCompleted: 2 });
});

it("marks the run failed if cleanup is incomplete", async () => {
  expiry.mockResolvedValueOnce({ examined: 1, deleted: 0, alreadyAbsent: 0, skipped: 0, failed: 1 });
  const handler = (PROCESSOR_HANDLERS as Record<string, ProcessorHandler>)["expire-report-artifacts"];
  await expect(handler({ mode: "APPLY", batchSize: 20, operationId: "test" })).rejects.toThrow("Report artifact expiry");
});
