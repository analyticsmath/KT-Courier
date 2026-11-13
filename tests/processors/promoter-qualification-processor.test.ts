import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ select: vi.fn(), gate: vi.fn(), confirm: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { promoterQualification: { findMany: mock.select } } }));
vi.mock("@/lib/promoters/production-readiness", () => ({ assertPromotersProductionReady: mock.gate }));
vi.mock("@/lib/promoters/qualification-earning.service", () => ({ confirmPromoterQualification: mock.confirm }));
import { PROCESSOR_HANDLERS } from "@/lib/processors/processor-service";

const context = { batchSize: 2, operationId: "processor-run", mode: "APPLY" as const };
beforeEach(() => {
  vi.resetAllMocks();
  mock.select.mockResolvedValue([{ id: "qualification-id", publicReference: "qualification-ref" }]);
  mock.confirm.mockResolvedValue({ status: "QUALIFIED_HELD" });
});

it("previews observed qualifications without opening the financial gate or mutating them", async () => {
  const result = await PROCESSOR_HANDLERS["process-promoter-qualifications"]({ ...context, mode: "DRY_RUN" });
  expect(result).toMatchObject({ itemsExamined: 1, itemsCompleted: 0, itemsSkipped: 1 });
  expect(mock.gate).not.toHaveBeenCalled();
  expect(mock.confirm).not.toHaveBeenCalled();
  expect(mock.select).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "EVIDENCE_OBSERVED" }, take: 2 }));
});

it("confirms with the same stable operation ID as the command-line processor", async () => {
  const result = await PROCESSOR_HANDLERS["process-promoter-qualifications"](context);
  const hash = createHash("sha256").update("qualification-ref").digest("hex").slice(0, 32);
  expect(result.itemsCompleted).toBe(1);
  expect(mock.confirm).toHaveBeenCalledWith(expect.anything(), { qualificationId: "qualification-id", operationId: `process-promoter-qualifications:${hash}` });
});

it("does not confirm when production authorization blocks execution", async () => {
  mock.gate.mockImplementation(() => { throw new Error("production locked"); });
  await expect(PROCESSOR_HANDLERS["process-promoter-qualifications"](context)).rejects.toThrow("production locked");
  expect(mock.confirm).not.toHaveBeenCalled();
});
