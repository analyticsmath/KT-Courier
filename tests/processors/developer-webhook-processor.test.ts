import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ gate: vi.fn(), recovery: vi.fn(), select: vi.fn(), apply: vi.fn() }));
vi.mock("@/lib/developer-api/production-readiness", () => ({ assertDeveloperApiProductionReady: mock.gate }));
vi.mock("@/lib/developer-api/webhook-recovery", () => ({ recoverStaleWebhookClaims: mock.recovery }));
vi.mock("@/lib/developer-api/composition-root", () => ({ resolveDeveloperApiProductionComposition: () => ({ services: { processors: { select: mock.select, apply: mock.apply } } }) }));
import { PROCESSOR_HANDLERS } from "@/lib/processors/processor-service";
const context = { mode: "APPLY" as const, batchSize: 4, operationId: "webhook-run" };
beforeEach(() => { vi.clearAllMocks(); mock.recovery.mockResolvedValue({ examined: 1, recovered: 1 }); mock.select.mockImplementation(async (kind: string) => [{ kind, reference: kind, record: {} }]); mock.apply.mockResolvedValue({ status: "SUCCEEDED" }); });
it("uses the production gate and bounded retry and pending delivery selectors", async () => {
  const result = await PROCESSOR_HANDLERS["deliver-developer-webhooks"](context);
  expect(mock.gate).toHaveBeenCalledOnce();
  expect(mock.select).toHaveBeenCalledWith("retry", 2);
  expect(mock.select).toHaveBeenCalledWith("deliver", 3);
  expect(result).toMatchObject({ itemsExamined: 2, itemsCompleted: 2, itemsReconciled: 1 });
});
it("reports a failed delivery rather than counting it as completed", async () => {
  mock.apply.mockResolvedValueOnce({ status: "FAILED_RETRYABLE" });
  await expect(PROCESSOR_HANDLERS["deliver-developer-webhooks"](context)).rejects.toThrow("1 failure");
});
it("does not select or send when the external execution gate is locked", async () => {
  mock.gate.mockImplementationOnce(() => { throw new Error("locked"); });
  await expect(PROCESSOR_HANDLERS["deliver-developer-webhooks"](context)).rejects.toThrow("locked");
  expect(mock.select).not.toHaveBeenCalled(); expect(mock.apply).not.toHaveBeenCalled();
});
