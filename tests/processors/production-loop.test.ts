import { describe, expect, it, vi } from "vitest";
import { productionProcessors, runProductionCycle } from "@/lib/processors/production-loop";

describe("production processor orchestration", () => {
  it("avoids creating processor receipts for empty queues", async () => {
    const execute = vi.fn();
    expect((await runProductionCycle(execute, () => false, async () => false)).every((r) => r.status === "IDLE")).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
  it("finishes each approved task before starting the next and gives each execution a unique receipt", async () => {
    let inFlight = 0;
    const ids: string[] = [];
    const names: string[] = [];
    const result = await runProductionCycle(async (input) => {
      expect(inFlight++).toBe(0);
      expect(input.mode).toBe("APPLY");
      ids.push(input.operationId); names.push(input.name);
      await Promise.resolve(); inFlight--;
      return { itemsCompleted: 2, itemsRetried: 0 };
    });
    expect(names).toEqual(productionProcessors);
    expect(new Set(ids).size).toBe(3);
    expect(result.every((r) => r.status === "COMPLETED")).toBe(true);
  });
  it("keeps notifications running when payment processing fails, without exposing provider errors", async () => {
    const execute = vi.fn().mockRejectedValueOnce(new Error("private-provider-details")).mockResolvedValue({ itemsCompleted: 0, itemsRetried: 0 });
    const result = await runProductionCycle(execute);
    expect(execute).toHaveBeenCalledTimes(3);
    expect(result.map((r) => r.status)).toEqual(["FAILED", "COMPLETED", "COMPLETED"]);
    expect(JSON.stringify(result)).not.toContain("private-provider-details");
  });
  it("recognises lease contention without treating database failures as a healthy peer", async () => {
    const execute = vi.fn().mockRejectedValueOnce(new Error("Active unexpired lease")).mockRejectedValueOnce(new Error("Database unavailable")).mockResolvedValue({ itemsCompleted: 0, itemsRetried: 0 });
    expect((await runProductionCycle(execute)).map((r) => r.status)).toEqual(["PEER_LEASE", "FAILED", "COMPLETED"]);
  });
  it("stops after finishing the in-flight task when shutdown is requested", async () => {
    let stop = false;
    const execute = vi.fn(async () => { stop = true; return { itemsCompleted: 1, itemsRetried: 0 }; });
    expect(await runProductionCycle(execute, () => stop)).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
