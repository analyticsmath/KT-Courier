import { expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ select: vi.fn(), apply: vi.fn() }));
vi.mock("@/lib/developer-api/composition-root", () => ({ resolveDeveloperApiProductionComposition: () => ({ services: { processors: state } }) }));
import { PROCESSOR_HANDLERS, type ProcessorHandler } from "@/lib/processors/processor-service";

it("performs bounded credential expiry through the canonical service", async () => {
  state.select.mockResolvedValueOnce([{ reference: "credential", record: { id: "id" } }]);
  state.apply.mockResolvedValueOnce({ expired: true });
  const result = await (PROCESSOR_HANDLERS as Record<string, ProcessorHandler>)["expire-developer-api-credentials"]({ mode: "APPLY", batchSize: 5, operationId: "test" });
  expect(state.select).toHaveBeenCalledWith("expire-credentials", 5);
  expect(result).toMatchObject({ itemsExamined: 1, itemsCompleted: 1 });
});

it("does not mutate in dry-run mode", async () => {
  state.apply.mockClear(); state.select.mockResolvedValueOnce([{ reference: "credential", record: { id: "id" } }]);
  const result = await (PROCESSOR_HANDLERS as Record<string, ProcessorHandler>)["expire-developer-api-credentials"]({ mode: "DRY_RUN", batchSize: 5, operationId: "test" });
  expect(state.apply).not.toHaveBeenCalled();
  expect(result).toMatchObject({ itemsExamined: 1, itemsCompleted: 0 });
});

it("propagates the platform authorization lock", async () => {
  state.select.mockResolvedValueOnce([{ reference: "credential", record: { id: "id" } }]);
  state.apply.mockRejectedValueOnce(new Error("developer platform locked"));
  await expect((PROCESSOR_HANDLERS as Record<string, ProcessorHandler>)["expire-developer-api-credentials"]({ mode: "APPLY", batchSize: 5, operationId: "test" })).rejects.toThrow("developer platform locked");
});
