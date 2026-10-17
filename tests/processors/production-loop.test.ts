import { describe, expect, it, vi } from "vitest";
import { checkMarketplaceStoreOrderInitializationReadiness } from "@/lib/processors/marketplace-store-order-readiness";
import {
  createProcessorCadenceTracker,
  createProductionCycleWorkCheck,
  DEFAULT_PRODUCTION_PROCESSOR_CADENCE_MS,
  productionProcessors,
  runProductionCycle,
  summarizeProductionCycleReadiness,
} from "@/lib/processors/production-loop";

describe("production processor orchestration", () => {
  it("settles marketplace jobs after verified payment finalization", () => {
    expect(productionProcessors).toEqual([
      "apply-paystack-webhook-events",
      "consume-verified-payment-events",
      "settle-marketplace-store-orders",
      "initialize-marketplace-store-orders",
      "expire-marketplace-reservations",
      "process-earning-lifecycle",
      "deliver-notifications",
      "reconcile-expired-dispatch",
      "dispatch-marketplace-orders",
    ]);
  });
  it("avoids creating processor receipts for empty queues", async () => {
    const execute = vi.fn();
    expect((await runProductionCycle(execute, () => false, async () => false)).every((r) => r.status === "IDLE")).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
  it("holds pending store orders without retrying when the active operations policy is missing", async () => {
    const hasPendingOrder = vi.fn().mockResolvedValue(true);
    const hasActivePolicy = vi.fn().mockResolvedValue(false);
    const readiness = await checkMarketplaceStoreOrderInitializationReadiness({ hasPendingOrder, hasActivePolicy });

    expect(readiness).toEqual({ hasWork: false, blocker: "STORE_ORDER_OPERATIONAL_POLICY_REQUIRED" });
    expect(hasPendingOrder).toHaveBeenCalledOnce();
    expect(hasActivePolicy).toHaveBeenCalledOnce();
  });
  it("does not report a policy blocker when no store orders are waiting", async () => {
    const hasPendingOrder = vi.fn().mockResolvedValue(false);
    const hasActivePolicy = vi.fn();
    const readiness = await checkMarketplaceStoreOrderInitializationReadiness({ hasPendingOrder, hasActivePolicy });

    expect(readiness).toEqual({ hasWork: false, blocker: null });
    expect(hasActivePolicy).not.toHaveBeenCalled();
  });
  it("allows store-order initialization once an active policy is available", async () => {
    const readiness = await checkMarketplaceStoreOrderInitializationReadiness({
      hasPendingOrder: async () => true,
      hasActivePolicy: async () => true,
    });

    expect(readiness).toEqual({ hasWork: true, blocker: null });
  });
  it("keeps processor readiness blocked when the queue is held by policy configuration", () => {
    const idle = productionProcessors.map((name) => ({ name, status: "IDLE" as const, itemsCompleted: 0, itemsRetried: 0 }));

    expect(summarizeProductionCycleReadiness(idle, ["STORE_ORDER_OPERATIONAL_POLICY_REQUIRED"])).toEqual({
      healthy: false,
      readinessBlockers: ["STORE_ORDER_OPERATIONAL_POLICY_REQUIRED"],
    });
    expect(summarizeProductionCycleReadiness(idle, [])).toEqual({ healthy: true, readinessBlockers: [] });
  });
  it("uses queue discovery on startup while preserving the earning cursor's first pass", async () => {
    const hasWork = vi.fn(async (name: (typeof productionProcessors)[number]) => name === "deliver-notifications");
    const executed: string[] = [];
    const execute = vi.fn(async (input: { name: (typeof productionProcessors)[number]; mode: "APPLY"; operationId: string }) => {
      executed.push(input.name);
      return { itemsCompleted: 0, itemsRetried: 0 };
    });
    const firstCycleWork = createProductionCycleWorkCheck(hasWork, true);

    const results = await runProductionCycle(execute, () => false, firstCycleWork);

    expect(executed).toEqual(["process-earning-lifecycle", "deliver-notifications"]);
    expect(results.filter((result) => result.status === "IDLE")).toHaveLength(productionProcessors.length - 2);
    expect(hasWork).not.toHaveBeenCalledWith("process-earning-lifecycle");
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
    expect(new Set(ids).size).toBe(productionProcessors.length);
    expect(result.every((r) => r.status === "COMPLETED")).toBe(true);
  });
  it("keeps notifications running when payment processing fails, without exposing provider errors", async () => {
    const execute = vi.fn().mockRejectedValueOnce(new Error("private-provider-details")).mockResolvedValue({ itemsCompleted: 0, itemsRetried: 0 });
    const result = await runProductionCycle(execute);
    expect(execute).toHaveBeenCalledTimes(productionProcessors.length);
    expect(result.map((r) => r.status)).toEqual(["FAILED", ...productionProcessors.slice(1).map(() => "COMPLETED")]);
    expect(JSON.stringify(result)).not.toContain("private-provider-details");
  });
  it("recognises lease contention without treating database failures as a healthy peer", async () => {
    const execute = vi.fn().mockRejectedValueOnce(new Error("Active unexpired lease")).mockRejectedValueOnce(new Error("Database unavailable")).mockResolvedValue({ itemsCompleted: 0, itemsRetried: 0 });
    expect((await runProductionCycle(execute)).map((r) => r.status)).toEqual(["PEER_LEASE", "FAILED", ...productionProcessors.slice(2).map(() => "COMPLETED")]);
  });
  it("stops after finishing the in-flight task when shutdown is requested", async () => {
    let stop = false;
    const execute = vi.fn(async () => { stop = true; return { itemsCompleted: 1, itemsRetried: 0 }; });
    expect(await runProductionCycle(execute, () => stop)).toHaveLength(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it("throttles cadence-configured processors to bounded execution intervals", () => {
    let mockTime = 100_000;
    const tracker = createProcessorCadenceTracker(DEFAULT_PRODUCTION_PROCESSOR_CADENCE_MS, () => mockTime);

    // Initial cycle: due immediately (last = 0)
    expect(tracker.isDue("reconcile-expired-dispatch")).toBe(true);
    expect(tracker.isDue("dispatch-marketplace-orders")).toBe(true);
    // Unconfigured processor: always due
    expect(tracker.isDue("apply-paystack-webhook-events")).toBe(true);

    // Mark checked at mockTime
    tracker.markChecked("reconcile-expired-dispatch");
    tracker.markChecked("dispatch-marketplace-orders");
    expect(tracker.isDue("reconcile-expired-dispatch")).toBe(false);
    expect(tracker.isDue("dispatch-marketplace-orders")).toBe(false);

    // Advance by 30 seconds (standard loop interval): still not due (needs 60s)
    mockTime += 30_000;
    expect(tracker.isDue("reconcile-expired-dispatch")).toBe(false);
    expect(tracker.isDue("dispatch-marketplace-orders")).toBe(false);

    // Advance by another 30 seconds: now 60s has passed, should be due
    mockTime += 30_000;
    expect(tracker.isDue("reconcile-expired-dispatch")).toBe(true);
    expect(tracker.isDue("dispatch-marketplace-orders")).toBe(true);
  });
  it("integrates cadence filter into work check to prevent empty database sweeps", async () => {
    let mockTime = 1_000_000;
    const tracker = createProcessorCadenceTracker({ "reconcile-expired-dispatch": 60_000 }, () => mockTime);
    const hasWork = vi.fn(async () => true);
    const workCheck = createProductionCycleWorkCheck(hasWork, false, tracker);

    // First cycle: due, so hasWork is invoked
    const res1 = await workCheck("reconcile-expired-dispatch");
    expect(res1).toBe(true);
    expect(hasWork).toHaveBeenCalledTimes(1);

    // Second cycle after 30s: not due, hasWork is NOT invoked (preventing DB sweep)
    mockTime += 30_000;
    const res2 = await workCheck("reconcile-expired-dispatch");
    expect(res2).toBe(false);
    expect(hasWork).toHaveBeenCalledTimes(1);

    // Third cycle after another 30s: due again, hasWork is invoked
    mockTime += 30_000;
    const res3 = await workCheck("reconcile-expired-dispatch");
    expect(res3).toBe(true);
    expect(hasWork).toHaveBeenCalledTimes(2);
  });
});
