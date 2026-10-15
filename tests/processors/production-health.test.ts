import { describe, expect, it } from "vitest";
import { getProductionProcessorHealthState, getProductionProcessorHealthStatus } from "@/lib/processors/production-health";

describe("production processor liveness and readiness", () => {
  it("keeps Railway liveness healthy during the first processor cycle", () => {
    const state = getProductionProcessorHealthState({ stopping: false, healthy: false, lastCycleAt: 0, now: 1_000 });

    expect(state).toEqual({ live: true, ready: false });
    expect(getProductionProcessorHealthStatus("/health", state)).toBe(200);
    expect(getProductionProcessorHealthStatus("/ready", state)).toBe(503);
  });

  it("reports readiness only after a recent healthy cycle", () => {
    const current = getProductionProcessorHealthState({ stopping: false, healthy: true, lastCycleAt: 500_000, now: 500_001 });
    const stale = getProductionProcessorHealthState({ stopping: false, healthy: true, lastCycleAt: 1, now: 421_002 });
    const stopping = getProductionProcessorHealthState({ stopping: true, healthy: true, lastCycleAt: 500_000, now: 500_001 });

    expect(current.ready).toBe(true);
    expect(getProductionProcessorHealthStatus("/ready", current)).toBe(200);
    expect(stale).toEqual({ live: true, ready: false });
    expect(getProductionProcessorHealthStatus("/ready", stale)).toBe(503);
    expect(stopping).toEqual({ live: false, ready: false });
    expect(getProductionProcessorHealthStatus("/health", stopping)).toBe(503);
  });

  it("returns 404 for unknown health paths", () => {
    expect(getProductionProcessorHealthStatus("/metrics", { live: true, ready: true })).toBe(404);
  });
});
