import { describe, expect, it } from "vitest";
import { PROCESSOR_REGISTRY } from "@/lib/processors/processor-registry";
import { acquireProcessorLease, completeProcessorRun } from "@/lib/processors/lease-authority";
import { executeRegisteredProcessor, getProcessorInventory } from "@/lib/processors/processor-service";

describe("Phase 5: Processor Inventory & Lease Governance", () => {
  it("registers all operational processors with required metadata", () => {
    const requiredProcessors = [
      "consume-verified-payment-events",
      "finalize-paid-marketplace-checkouts",
      "process-subscription-renewals",
      "scan-refund-reconciliation",
      "scan-withdrawal-reconciliation",
      "release-mature-store-earnings",
      "release-mature-driver-earnings",
      "process-promoter-qualifications",
      "end-expired-promotions",
      "process-valid-click-charges",
      "deliver-notifications",
      "deliver-developer-webhooks",
      "generate-report-jobs",
      "expire-report-artifacts",
      "process-privacy-requests",
      "process-data-retention",
      "expire-developer-api-credentials",
      "scan-payment-reconciliation",
    ];

    for (const name of requiredProcessors) {
      const proc = PROCESSOR_REGISTRY[name];
      expect(proc).toBeDefined();
      expect(proc.name).toBe(name);
      expect(proc.classification).toBeDefined();
      expect(proc.requiredPermission).toBeDefined();
      expect(proc.operationalOwnerCategory).toBeDefined();
    }
  });

  it("returns full inventory from getProcessorInventory", async () => {
    const inventory = await getProcessorInventory();
    expect(inventory.length).toBeGreaterThanOrEqual(18);
  });

  it("rejects execution of unregistered processor names", async () => {
    await expect(
      executeRegisteredProcessor({
        name: "unregistered-fake-processor",
        mode: "DRY_RUN",
      }),
    ).rejects.toThrow(/Unregistered processor/);
  });

  it("prevents competing lease acquisition when an active unexpired lease exists", async () => {
    const jobName = "process-subscription-renewals";
    const partition = "test-billing";
    const op1 = `RUN-${Date.now()}-1`;
    const op2 = `RUN-${Date.now()}-2`;

    const lease1 = await acquireProcessorLease({
      jobName,
      partition,
      leaseOwner: "worker-1",
      operationId: op1,
      leaseDurationSeconds: 300,
    });

    expect(lease1.acquired).toBe(true);

    const lease2 = await acquireProcessorLease({
      jobName,
      partition,
      leaseOwner: "worker-2",
      operationId: op2,
    });

    expect(lease2.acquired).toBe(false);
    expect(lease2.reason).toContain("Active unexpired lease held by worker-1");

    // Clean up lease 1
    await completeProcessorRun({
      operationId: op1,
      leaseOwner: "worker-1",
      status: "APPLY_COMPLETED",
    });
  });

  it("prevents a stale owner from completing a run owned by another worker", async () => {
    const jobName = "deliver-notifications";
    const partition = "test-notif";
    const opId = `RUN-${Date.now()}-stale`;

    await acquireProcessorLease({
      jobName,
      partition,
      leaseOwner: "worker-A",
      operationId: opId,
      leaseDurationSeconds: 300,
    });

    await expect(
      completeProcessorRun({
        operationId: opId,
        leaseOwner: "worker-B", // Wrong owner!
        status: "APPLY_COMPLETED",
      }),
    ).rejects.toThrow(/Stale lease owner 'worker-B' cannot complete run owned by 'worker-A'/);

    // Clean up with correct owner
    await completeProcessorRun({
      operationId: opId,
      leaseOwner: "worker-A",
      status: "CANCELLED",
    });
  });
});
