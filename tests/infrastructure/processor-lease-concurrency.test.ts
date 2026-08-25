import { describe, expect, it } from "vitest";
import { PROCESSOR_REGISTRY } from "@/lib/processors/processor-registry";

describe("Processor Lease Concurrency & Registry Invariants", () => {
  it("registers required background processors with lease configuration", () => {
    const requiredProcessors = [
      "consume-verified-payment-events",
      "finalize-paid-marketplace-checkouts",
      "process-subscription-renewals",
      "release-mature-store-earnings",
      "release-mature-driver-earnings",
      "process-data-retention",
      "scan-payment-reconciliation",
    ];

    for (const name of requiredProcessors) {
      const processor = PROCESSOR_REGISTRY[name];
      expect(processor).toBeDefined();
      expect(processor.name).toBe(name);
      expect(processor.maxExecutionDurationSeconds).toBeGreaterThan(0);
      expect(processor.defaultBatchSize).toBeGreaterThan(0);
    }
  });
});
