import { expect, it, vi } from "vitest";
const run = vi.hoisted(() => vi.fn());
vi.mock("@/lib/subscriptions/subscription-renewal-batch", () => ({ runSubscriptionRenewalBatch: run }));
import { PROCESSOR_HANDLERS } from "@/lib/processors/processor-service";
const context = { mode: "APPLY" as const, batchSize: 5, operationId: "renewal-run" };
it("uses bounded renewal preparation and reports reconciliation", async () => {
  run.mockResolvedValueOnce({ examined: 3, prepared: 1, skipped: 1, reconciled: 1, failed: 0 });
  expect(await PROCESSOR_HANDLERS["process-subscription-renewals"](context)).toMatchObject({ itemsExamined: 3, itemsCompleted: 1, itemsReconciled: 1 });
  expect(run).toHaveBeenCalledWith({ limit: 5 });
});
it("surfaces processing failure rather than reporting success", async () => {
  run.mockResolvedValueOnce({ examined: 1, prepared: 0, skipped: 0, reconciled: 0, failed: 1 });
  await expect(PROCESSOR_HANDLERS["process-subscription-renewals"](context)).rejects.toThrow("failed");
});
