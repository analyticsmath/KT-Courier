import { describe, expect, it } from "vitest";
import {
  PROCESSOR_REGISTRY,
  type ProcessorName,
  type ImplementedProcessorName,
} from "@/lib/processors/processor-registry";
import {
  PROCESSOR_HANDLERS,
  executeRegisteredProcessor,
} from "@/lib/processors/processor-service";

describe("Workstream A: Processor Registry and Compile-Time Closure", () => {
  it("enforces all registered processors have required metadata and status", () => {
    const entries = Object.entries(PROCESSOR_REGISTRY) as Array<[ProcessorName, (typeof PROCESSOR_REGISTRY)[ProcessorName]]>;
    expect(entries.length).toBeGreaterThanOrEqual(19);

    for (const [key, proc] of entries) {
      expect(proc.name).toBe(key);
      expect(proc.version).toBeDefined();
      expect(proc.purpose).toBeDefined();
      expect(["CRON", "EVENT", "MANUAL"]).toContain(proc.triggerType);
      expect(proc.classification).toBeDefined();
      expect(typeof proc.leaseRequired).toBe("boolean");
      expect(typeof proc.defaultPartition).toBe("string");
      expect(typeof proc.defaultBatchSize).toBe("number");
      expect(typeof proc.maxBatchSize).toBe("number");
      expect(typeof proc.maxExecutionDurationSeconds).toBe("number");
      expect(typeof proc.dryRunSupported).toBe("boolean");
      expect(typeof proc.manualExecutionAllowed).toBe("boolean");
      expect(proc.requiredPermission).toBeDefined();
      expect(proc.operationalOwnerCategory).toBeDefined();
      expect(["IMPLEMENTED", "DISABLED"]).toContain(proc.status);
    }
  });

  it("satisfies compile-time closure: every IMPLEMENTED processor has a concrete handler", () => {
    const allProcessors = Object.values(PROCESSOR_REGISTRY) as Array<(typeof PROCESSOR_REGISTRY)[ProcessorName]>;
    const implementedNames = allProcessors
      .filter((p) => p.status === "IMPLEMENTED")
      .map((p) => p.name as ImplementedProcessorName);

    expect(implementedNames.length).toBeGreaterThanOrEqual(8);

    for (const name of implementedNames) {
      expect(PROCESSOR_HANDLERS[name]).toBeDefined();
      expect(typeof PROCESSOR_HANDLERS[name]).toBe("function");
    }
  });

  it("throws PROCESSOR_HANDLER_NOT_IMPLEMENTED when executing a disabled processor", async () => {
    const allProcessors = Object.values(PROCESSOR_REGISTRY) as Array<(typeof PROCESSOR_REGISTRY)[ProcessorName]>;
    const disabledNames = allProcessors
      .filter((p) => p.status === "DISABLED")
      .map((p) => p.name as ProcessorName);

    expect(disabledNames.length).toBeGreaterThanOrEqual(8);

    for (const name of disabledNames) {
      await expect(
        executeRegisteredProcessor({
          name,
          mode: "APPLY",
        }),
      ).rejects.toThrow(/PROCESSOR_HANDLER_NOT_IMPLEMENTED/);
    }
  });

  it("enforces strict DRY_RUN guarantee: 0 mutations and zero side-effects", async () => {
    const result = await executeRegisteredProcessor({
      name: "release-mature-store-earnings",
      mode: "DRY_RUN",
      batchSize: 10,
    });

    expect(result.success).toBe(true);
    expect(result.mode).toBe("DRY_RUN");
    expect(result.itemsClaimed).toBe(0);
    expect(result.itemsCompleted).toBe(0);
    expect(result.itemsRetried).toBe(0);
    expect(result.safeSummary).toContain("[DRY_RUN]");

    const paymentResult = await executeRegisteredProcessor({
      name: "consume-verified-payment-events",
      mode: "DRY_RUN",
      batchSize: 10,
    });

    expect(paymentResult.success).toBe(true);
    expect(paymentResult.mode).toBe("DRY_RUN");
    expect(paymentResult.itemsClaimed).toBe(0);
    expect(paymentResult.itemsCompleted).toBe(0);
    expect(paymentResult.safeSummary).toContain("[DRY_RUN]");
  });
});
