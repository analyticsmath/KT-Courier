import { expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/lib/advertising/click-charge-batch", () => ({ runAdvertisingClickBatch: mock.run }));
import { PROCESSOR_HANDLERS } from "@/lib/processors/processor-service";
it("runs bounded charging and reports reconciliation", async () => {
  mock.run.mockResolvedValueOnce({ examined: 3, charged: 1, reconciled: 2, failed: 0 });
  expect(await PROCESSOR_HANDLERS["process-valid-click-charges"]({ mode: "APPLY", batchSize: 5, operationId: "run" })).toMatchObject({ itemsExamined: 3, itemsCompleted: 1, itemsReconciled: 2 });
  expect(mock.run).toHaveBeenCalledWith({ limit: 5, apply: true });
});
it("reports a failed reconciliation rather than success", async () => {
  mock.run.mockResolvedValueOnce({ examined: 1, charged: 0, reconciled: 0, failed: 1 });
  await expect(PROCESSOR_HANDLERS["process-valid-click-charges"]({ mode: "APPLY", batchSize: 5, operationId: "run" })).rejects.toThrow("failed");
});
