import { describe, expect, it, vi } from "vitest";
import { checkMarketplaceStoreOrderInitializationReadiness } from "@/lib/processors/marketplace-store-order-readiness";
import {
  createProcessorCadenceTracker,
  createProductionCycleWorkCheck,
  DEFAULT_PRODUCTION_PROCESSOR_CADENCE_MS,
  DELEGATED_COMPOSITE_PROCESSORS,
  evaluateCommercialGateState,
  hasEnabledCommercialProcessorWork,
  mergeClusterProcessorHeartbeats,
  productionProcessors,
  resolveProcessorWorkerIdentity,
  runProductionCycle,
  summarizeProductionCycleReadiness,
  hasEnabledOrdinaryReferralWork,
} from "@/lib/processors/production-loop";
import { PROCESSOR_REGISTRY } from "@/lib/processors/processor-registry";

describe("production processor orchestration", () => {
  it("settles marketplace jobs after verified payment finalization and accounts for all 32 registered processors", () => {
    expect(productionProcessors).toEqual([
      "apply-paystack-webhook-events",
      "consume-verified-payment-events",
      "settle-marketplace-store-orders",
      "initialize-marketplace-store-orders",
      "expire-marketplace-reservations",
      "process-earning-lifecycle",
      "process-ordinary-referral-awards",
      "end-expired-promotions",
      "expire-report-artifacts",
      "generate-report-jobs",
      "expire-developer-api-credentials",
      "deliver-notifications",
      "reconcile-expired-dispatch",
      "escalate-unassigned-courier-orders",
      "expire-unpaid-courier-orders",
      "monitor-overdue-driver-cash",
      "dispatch-marketplace-orders",
      "scan-payment-reconciliation",
      "scan-refund-reconciliation",
      "scan-withdrawal-reconciliation",
      "scan-paystack-transfer-reconciliation",
      "process-managed-marketing-lifecycle",
      "process-privacy-requests",
      "process-data-retention",
      "reconcile-customer-parcel-loyalty",
      "process-subscription-renewals",
      "process-promoter-qualifications",
      "process-valid-click-charges",
      "deliver-developer-webhooks",
    ]);
    const covered = new Set<string>([
      ...productionProcessors,
      ...Object.keys(DELEGATED_COMPOSITE_PROCESSORS),
    ]);
    expect(covered.size).toBe(Object.keys(PROCESSOR_REGISTRY).length);
  });
  it("keeps commercial processors fail-closed when gated and opens automatically when authorized (CR-158/159)", async () => {
    const hasPending = vi.fn().mockResolvedValue(true);
    expect(await hasEnabledCommercialProcessorWork({ enabled: true, approved: false, hasPending })).toBe(false);
    expect(hasPending).not.toHaveBeenCalled();
    expect(evaluateCommercialGateState({ enabled: true, approved: false, blockerCode: "PROMOTERS_PRODUCTION_LOCKED" })).toEqual({
      activationState: "ACTIVATION_GATED",
      blockerCode: "PROMOTERS_PRODUCTION_LOCKED",
    });
    expect(await hasEnabledCommercialProcessorWork({ enabled: true, approved: true, hasPending })).toBe(true);
    expect(hasPending).toHaveBeenCalledOnce();
  });
  it("surfaces processor failure and retry backlog blockers loudly instead of reporting healthy (CR-160)", () => {
    const withFailure = productionProcessors.map((name, idx) => ({
      name,
      status: idx === 0 ? ("FAILED" as const) : ("IDLE" as const),
      itemsCompleted: 0,
      itemsRetried: idx === 1 ? 2 : 0,
    }));
    const summary = summarizeProductionCycleReadiness(withFailure, []);
    expect(summary.healthy).toBe(false);
    expect(summary.readinessBlockers).toContain("PROCESSOR_FAILED_APPLY_PAYSTACK_WEBHOOK_EVENTS");
    expect(summary.readinessBlockers).toContain("PROCESSOR_RETRY_BACKLOG_CONSUME_VERIFIED_PAYMENT_EVENTS");
  });
  it("runs automatic referrals only when issuing is enabled and work is pending", async () => {
    const hasPending = vi.fn().mockResolvedValue(true);
    const isEnabled = vi.fn().mockResolvedValue(false);
    expect(await hasEnabledOrdinaryReferralWork({ isAuthorized: false, isEnabled, hasPending })).toBe(false);
    expect(isEnabled).not.toHaveBeenCalled();
    expect(await hasEnabledOrdinaryReferralWork({ isAuthorized: true, isEnabled, hasPending })).toBe(false);
    expect(hasPending).not.toHaveBeenCalled();
    isEnabled.mockResolvedValue(true);
    expect(await hasEnabledOrdinaryReferralWork({ isAuthorized: true, isEnabled, hasPending })).toBe(true);
    hasPending.mockResolvedValue(false);
    expect(await hasEnabledOrdinaryReferralWork({ isAuthorized: true, isEnabled, hasPending })).toBe(false);
    expect(DEFAULT_PRODUCTION_PROCESSOR_CADENCE_MS["process-ordinary-referral-awards"]).toBe(300_000);
  });
  it("avoids creating processor receipts for empty queues", async () => {
    const execute = vi.fn();
    expect((await runProductionCycle(execute, () => false, async () => false)).every((r) => r.status === "IDLE")).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
  it("holds pending store orders without retrying when the active operations policy is missing", async () => {
    const hasPendingOrder = vi.fn().mockResolvedValue(true);
    const hasActivePolicy = vi.fn().mockResolvedValue(false);
    const readiness = await checkMarketplaceStoreOrderInitializationReadiness({ hasPendingOrder, hasActivePolicy, hasReconciliationOrder: async () => false });

    expect(readiness).toEqual({ hasWork: false, blocker: "STORE_ORDER_OPERATIONAL_POLICY_REQUIRED" });
    expect(hasPendingOrder).toHaveBeenCalledOnce();
    expect(hasActivePolicy).toHaveBeenCalledOnce();
  });
  it("does not report a policy blocker when no store orders are waiting", async () => {
    const hasPendingOrder = vi.fn().mockResolvedValue(false);
    const hasActivePolicy = vi.fn();
    const readiness = await checkMarketplaceStoreOrderInitializationReadiness({ hasPendingOrder, hasActivePolicy, hasReconciliationOrder: async () => false });

    expect(readiness).toEqual({ hasWork: false, blocker: null });
    expect(hasActivePolicy).not.toHaveBeenCalled();
  });
  it("allows store-order initialization once an active policy is available", async () => {
    const readiness = await checkMarketplaceStoreOrderInitializationReadiness({
      hasReconciliationOrder: async () => false,
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
  it("runs all four finance reconciliation processors in operations on their bounded cadence", async () => {
    let now = 2_000_000;
    const scans = [
      "scan-payment-reconciliation",
      "scan-refund-reconciliation",
      "scan-withdrawal-reconciliation",
      "scan-paystack-transfer-reconciliation",
    ] as const;
    const tracker = createProcessorCadenceTracker(DEFAULT_PRODUCTION_PROCESSOR_CADENCE_MS, () => now);
    const hasWork = vi.fn(async () => true);
    const workCheck = createProductionCycleWorkCheck(hasWork, false, tracker);
    for (const name of scans) expect(await workCheck(name)).toBe(true);
    expect(hasWork).toHaveBeenCalledTimes(4);
    for (const name of scans) expect(await workCheck(name)).toBe(false);
    expect(hasWork).toHaveBeenCalledTimes(4);
    now += 900_000;
    for (const name of scans) expect(await workCheck(name)).toBe(true);
    expect(hasWork).toHaveBeenCalledTimes(8);
    expect(scans.every(name => productionProcessors.includes(name))).toBe(true);
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

  it("does not postpone 24-hour unpaid parcel expiry by 5 minutes after an empty check right before deadline (C08)", async () => {
    let mockTime = 1_000_000;
    let orderExpired = false;
    const tracker = createProcessorCadenceTracker(DEFAULT_PRODUCTION_PROCESSOR_CADENCE_MS, () => mockTime);
    const hasWork = vi.fn(async () => orderExpired);
    const workCheck = createProductionCycleWorkCheck(hasWork, false, tracker);

    // At 23h 59m 40s (no expired orders yet): returns false WITHOUT starting a 5-min throttle
    expect(await workCheck("expire-unpaid-courier-orders")).toBe(false);
    expect(hasWork).toHaveBeenCalledTimes(1);

    // 30s later (order crosses 24h 00m 10s deadline): immediately detects and runs!
    mockTime += 30_000;
    orderExpired = true;
    expect(await workCheck("expire-unpaid-courier-orders")).toBe(true);
    expect(hasWork).toHaveBeenCalledTimes(2);
  });

  it("merges competing multi-worker heartbeats (operations vs query-storefront-categories) without clobbering monotonic progress or retry backlogs (C08)", () => {
    expect(resolveProcessorWorkerIdentity({ RAILWAY_SERVICE_NAME: "query-storefront-categories" })).toBe(
      "query-storefront-categories",
    );

    const makeProcessors = (
      overrides: Partial<Record<(typeof productionProcessors)[number], Partial<{
        status: "COMPLETED" | "PEER_LEASE" | "FAILED" | "IDLE";
        itemsCompleted: number;
        itemsRetried: number;
        activationState: "ACTIVE" | "ACTIVATION_GATED" | "DISABLED_BY_FLAG";
        blockerCode: string | null;
        lastSuccessAt: string | null;
      }>>>,
    ) =>
      productionProcessors.map((name) => ({
        name,
        status: "IDLE" as const,
        itemsCompleted: 0,
        itemsRetried: 0,
        activationState: "ACTIVE" as const,
        blockerCode: null,
        lastSuccessAt: null,
        ...(overrides[name] ?? {}),
      }));

    const workerASnapshot = {
      workerId: "query-storefront-categories",
      observedAt: "2026-11-21T10:00:00.000Z",
      healthy: true,
      readinessBlockers: [],
      releaseSha: "f06493ff",
      activationGatedProcessors: [],
      processors: makeProcessors({
        "expire-unpaid-courier-orders": {
          status: "COMPLETED",
          itemsCompleted: 3,
          lastSuccessAt: "2026-11-21T10:00:00.000Z",
        },
        "process-ordinary-referral-awards": {
          activationState: "ACTIVE",
          blockerCode: null,
        },
      }),
    };

    const firstMerge = mergeClusterProcessorHeartbeats({
      workerSnapshot: workerASnapshot,
      totalRegistered: 32,
    });
    expect(firstMerge.activeWorkerIds).toEqual(["query-storefront-categories"]);

    // 5 seconds later, competing `operations` worker (with fewer env vars) runs and sees PEER_LEASE / IDLE
    const workerBSnapshot = {
      workerId: "operations",
      observedAt: "2026-11-21T10:00:05.000Z",
      healthy: true,
      readinessBlockers: [],
      releaseSha: "f06493ff",
      activationGatedProcessors: [],
      processors: makeProcessors({
        "expire-unpaid-courier-orders": {
          status: "PEER_LEASE",
          itemsCompleted: 0,
          lastSuccessAt: null,
        },
        "process-ordinary-referral-awards": {
          activationState: "DISABLED_BY_FLAG",
          blockerCode: "ORDINARY_REFERRAL_WORKFLOW_WORKER_DISABLED",
        },
      }),
    };

    const secondMerge = mergeClusterProcessorHeartbeats({
      workerSnapshot: workerBSnapshot,
      existingClusterHeartbeat: firstMerge,
      totalRegistered: 32,
    });

    expect(secondMerge.activeWorkerIds).toEqual(["operations", "query-storefront-categories"]);
    const expiryProc = secondMerge.processors.find((p) => p.name === "expire-unpaid-courier-orders");
    expect(expiryProc).toMatchObject({
      status: "COMPLETED",
      itemsCompleted: 3,
      lastSuccessAt: "2026-11-21T10:00:00.000Z",
    });
    expect(secondMerge.workerDiscrepancies).toContain(
      "WORKER_ACTIVATION_DRIFT_PROCESS_ORDINARY_REFERRAL_AWARDS",
    );
  });
});

 it.each([false, true])("keeps unresolved snapshot cases a readiness blocker while allowing valid work: %s", async (pending) => {
  const readiness = await checkMarketplaceStoreOrderInitializationReadiness({ hasPendingOrder: async () => pending, hasActivePolicy: async () => true, hasReconciliationOrder: async () => true });
  expect(readiness).toEqual({ hasWork: pending, blocker: "STORE_ORDER_SNAPSHOT_RECONCILIATION_REQUIRED" });
  const idle = productionProcessors.map(name => ({ name, status: "IDLE" as const, itemsCompleted: 0, itemsRetried: 0 }));
  expect(summarizeProductionCycleReadiness(idle, [readiness.blocker!]).healthy).toBe(false);
 });
