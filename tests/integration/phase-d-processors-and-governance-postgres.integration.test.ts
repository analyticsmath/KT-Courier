import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { acquireProcessorLease, completeProcessorRun } from "@/lib/processors/lease-authority";
import {
  executeRegisteredProcessor,
  PROCESSOR_HANDLERS,
} from "@/lib/processors/processor-service";
import { PROCESSOR_REGISTRY } from "@/lib/processors/processor-registry";
import {
  createProcessorCadenceTracker,
  DELEGATED_COMPOSITE_PROCESSORS,
  evaluateCommercialGateState,
  productionProcessors,
  runProductionCycle,
  summarizeProductionCycleReadiness,
} from "@/lib/processors/production-loop";
import { getProductionReadiness } from "@/lib/production-readiness/service";
import { buildCapabilityMatrix } from "@/lib/production-readiness/capability-matrix.service";
import { capability } from "@/lib/production-readiness/contracts";
import {
  DIRECTIVE_REQUIREMENT_COVERAGE_REGISTER,
  PROCESSOR_EXECUTION_MATRIX,
} from "@/lib/governance/directive-code-coverage-register";

let dbVerified = false;
const runTag = randomUUID().slice(0, 8);
const testPartition = `phase-d-part-${runTag}`;
let priorHeartbeatSetting: { label: string; value: Prisma.InputJsonValue } | null = null;
const cleanupRunOperationIds: string[] = [];

describe("Phase D Processors, Worker Loop, Capability Matrix & Governance Proof (CR-156..165)", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    await requireDisposableStoreSettlementDatabase();
    dbVerified = true;
    const existing = await prisma.systemSetting.findUnique({
      where: { key: "production_processor_heartbeat" },
      select: { label: true, value: true },
    });
    if (existing) {
      priorHeartbeatSetting = {
        label: existing.label,
        value: existing.value as Prisma.InputJsonValue,
      };
    }
  });

  afterAll(async () => {
    if (!dbVerified) return;
    if (cleanupRunOperationIds.length > 0) {
      await prisma.operationalProcessorRun.deleteMany({
        where: {
          OR: [
            { operationId: { in: cleanupRunOperationIds } },
            { partition: testPartition },
          ],
        },
      });
    } else {
      await prisma.operationalProcessorRun.deleteMany({
        where: { partition: testPartition },
      });
    }
    if (priorHeartbeatSetting) {
      await prisma.systemSetting.upsert({
        where: { key: "production_processor_heartbeat" },
        create: {
          key: "production_processor_heartbeat",
          label: priorHeartbeatSetting.label,
          type: "JSON",
          value: priorHeartbeatSetting.value,
        },
        update: {
          value: priorHeartbeatSetting.value,
        },
      });
    } else {
      await prisma.systemSetting.deleteMany({
        where: { key: "production_processor_heartbeat" },
      });
    }
  });

  it("CR-156: executes read-only DRY_RUN across recurring and commercial processors without mutating domain rows or bypassing commercial APPLY locks", async () => {
    const dryRunTargets = [
      "process-subscription-renewals",
      "deliver-developer-webhooks",
      "generate-report-jobs",
      "expire-report-artifacts",
      "process-privacy-requests",
      "process-data-retention",
      "reconcile-customer-parcel-loyalty",
    ] as const;

    const beforeSubsCount = await prisma.subscriptionRenewalJob.count();
    const beforeWebhookDeliveries = await prisma.developerWebhookDelivery.count();

    const dryRunPrefixTargets = new Set([
      "process-subscription-renewals",
      "deliver-developer-webhooks",
      "generate-report-jobs",
      "expire-report-artifacts",
    ]);
    for (const name of dryRunTargets) {
      const opId = `PHASED-DRY-${runTag}-${name}`;
      cleanupRunOperationIds.push(opId);
      const result = await executeRegisteredProcessor({
        name,
        partition: testPartition,
        mode: "DRY_RUN",
        operationId: opId,
      });
      expect(result.success).toBe(true);
      expect(result.mode).toBe("DRY_RUN");
      expect(result.status).toBe("DRY_RUN_COMPLETED");
      expect(result.itemsCompleted).toBe(0);
      if (dryRunPrefixTargets.has(name)) {
        expect(result.safeSummary).toContain("[DRY_RUN]");
      }
    }

    expect(await prisma.subscriptionRenewalJob.count()).toBe(beforeSubsCount);
    expect(await prisma.developerWebhookDelivery.count()).toBe(beforeWebhookDeliveries);

    // Commercial APPLY remains fail-closed when production validation locks are false
    const lockedApplyTargets = [
      "process-subscription-renewals",
      "process-promoter-qualifications",
      "process-valid-click-charges",
      "deliver-developer-webhooks",
    ] as const;

    for (const name of lockedApplyTargets) {
      const opId = `PHASED-LOCKED-${runTag}-${name}`;
      cleanupRunOperationIds.push(opId);
      await expect(
        executeRegisteredProcessor({
          name,
          partition: testPartition,
          mode: "APPLY",
          operationId: opId,
        }),
      ).rejects.toThrow();

      const persistedRun = await prisma.operationalProcessorRun.findUnique({
        where: { operationId: opId },
        select: { status: true },
      });
      expect(persistedRun?.status).toBe("FAILED");
    }
  });

  it("CR-157: enforces single-lease mutual exclusion across concurrent worker replicas on the same job+partition", async () => {
    const opA = `PHASED-LEASE-A-${runTag}`;
    const opB = `PHASED-LEASE-B-${runTag}`;
    cleanupRunOperationIds.push(opA, opB);

    const [leaseA, leaseB] = await Promise.all([
      acquireProcessorLease({
        jobName: "process-privacy-requests",
        partition: testPartition,
        leaseOwner: "worker-replica-1",
        leaseDurationSeconds: 60,
        operationId: opA,
        mode: "DRY_RUN",
      }),
      acquireProcessorLease({
        jobName: "process-privacy-requests",
        partition: testPartition,
        leaseOwner: "worker-replica-2",
        leaseDurationSeconds: 60,
        operationId: opB,
        mode: "DRY_RUN",
      }),
    ]);

    const acquiredCount = [leaseA, leaseB].filter((l) => l.acquired).length;
    expect(acquiredCount).toBe(1);
    const winner = leaseA.acquired ? leaseA : leaseB;
    const loser = leaseA.acquired ? leaseB : leaseA;
    expect(loser.acquired).toBe(false);
    expect(loser.reason).toBeTruthy();

    // Execute while active lease is held -> peer executeRegisteredProcessor fails closed rather than double running
    const opCompeting = `PHASED-LEASE-COMPETE-${runTag}`;
    cleanupRunOperationIds.push(opCompeting);
    await expect(
      executeRegisteredProcessor({
        name: "process-privacy-requests",
        partition: testPartition,
        mode: "DRY_RUN",
        operationId: opCompeting,
      }),
    ).rejects.toThrow(/lease|already|in progress|held/i);

    await completeProcessorRun({
      operationId: winner.operationId!,
      leaseOwner: winner.leaseOwner,
      status: "DRY_RUN_COMPLETED",
      itemsClaimed: 0,
      itemsCompleted: 0,
      safeSummary: "Released winner lease cleanly after concurrent verification",
    });

    // After release, next execution succeeds cleanly
    const opAfterRelease = `PHASED-LEASE-AFTER-${runTag}`;
    cleanupRunOperationIds.push(opAfterRelease);
    const afterResult = await executeRegisteredProcessor({
      name: "process-privacy-requests",
      partition: testPartition,
      mode: "DRY_RUN",
      operationId: opAfterRelease,
    });
    expect(afterResult.success).toBe(true);
    expect(afterResult.status).toBe("DRY_RUN_COMPLETED");
  });

  it("CR-158..160: covers all 30 registry jobs via 27 loop + 3 delegated composites, isolates failing peers, and records honest ACTIVATION_GATED readiness", async () => {
    const registryNames = Object.keys(PROCESSOR_REGISTRY).sort();
    const coveredSet = new Set<string>([
      ...productionProcessors,
      ...Object.keys(DELEGATED_COMPOSITE_PROCESSORS),
    ]);
    expect(productionProcessors).toHaveLength(27);
    expect(Object.keys(DELEGATED_COMPOSITE_PROCESSORS)).toHaveLength(3);
    expect([...coveredSet].sort()).toEqual(registryNames);

    // Every delegated composite points to an active loop processor
    for (const parent of Object.values(DELEGATED_COMPOSITE_PROCESSORS)) {
      expect(productionProcessors).toContain(parent);
    }

    // Commercial gate helper stays honest
    expect(
      evaluateCommercialGateState({
        enabled: true,
        approved: false,
        blockerCode: "SUBSCRIPTIONS_PRODUCTION_LOCKED",
      }),
    ).toEqual({
      activationState: "ACTIVATION_GATED",
      blockerCode: "SUBSCRIPTIONS_PRODUCTION_LOCKED",
    });

    // Run real cycle executing authorized privacy processor while simulating one peer failing and another reporting retry backlog
    let privacyRunOpId: string | null = null;
    const cycleResults = await runProductionCycle(
      async ({ name, mode, operationId }) => {
        if (name === "process-privacy-requests") {
          privacyRunOpId = operationId;
          cleanupRunOperationIds.push(operationId);
          return executeRegisteredProcessor({
            name,
            partition: testPartition,
            mode,
            operationId,
          });
        }
        if (name === "deliver-notifications") {
          throw new Error("Simulated provider connection failure");
        }
        if (name === "scan-payment-reconciliation") {
          return { itemsCompleted: 1, itemsRetried: 2 };
        }
        return { itemsCompleted: 0, itemsRetried: 0 };
      },
      () => false,
      async (name) =>
        name === "process-privacy-requests" ||
        name === "deliver-notifications" ||
        name === "scan-payment-reconciliation",
    );

    expect(privacyRunOpId).toBeTruthy();
    const persistedPrivacyRun = await prisma.operationalProcessorRun.findUnique({
      where: { operationId: privacyRunOpId! },
      select: { status: true, safeSummary: true },
    });
    expect(persistedPrivacyRun?.status).toBe("APPLY_COMPLETED");
    expect(persistedPrivacyRun?.safeSummary).toBeTruthy();

    const deliveredResult = cycleResults.find((r) => r.name === "deliver-notifications");
    const reconResult = cycleResults.find((r) => r.name === "scan-payment-reconciliation");
    const privacyResult = cycleResults.find((r) => r.name === "process-privacy-requests");
    expect(deliveredResult?.status).toBe("FAILED");
    expect(reconResult?.status).toBe("COMPLETED");
    expect(privacyResult?.status).toBe("COMPLETED");

    const cycleReadiness = summarizeProductionCycleReadiness(cycleResults, [
      "COMMERCIAL_GATE_BLOCKED_SUBSCRIPTIONS_PRODUCTION_LOCKED",
    ]);
    expect(cycleReadiness.healthy).toBe(false);
    expect(cycleReadiness.readinessBlockers).toEqual(
      expect.arrayContaining([
        "COMMERCIAL_GATE_BLOCKED_SUBSCRIPTIONS_PRODUCTION_LOCKED",
        "PROCESSOR_FAILED_DELIVER_NOTIFICATIONS",
        "PROCESSOR_RETRY_BACKLOG_SCAN_PAYMENT_RECONCILIATION",
      ]),
    );

    // Cadence tracker enforces bounded execution intervals
    let now = 100_000_000;
    const tracker = createProcessorCadenceTracker(undefined, () => now);
    expect(tracker.isDue("process-data-retention")).toBe(true);
    tracker.markChecked("process-data-retention");
    expect(tracker.isDue("process-data-retention")).toBe(false);
    now += 86_400_001;
    expect(tracker.isDue("process-data-retention")).toBe(true);
  });

  it("F08 & CR-165: persists processor heartbeat in PostgreSQL and builds an honest 17-entry read-only capability matrix without faking live clearance", async () => {
    const heartbeatValue = {
      observedAt: new Date().toISOString(),
      healthy: true,
      readinessBlockers: ["COMMERCIAL_GATE_BLOCKED_SUBSCRIPTIONS_PRODUCTION_LOCKED"],
      commercialActivationSummary: "PARTIAL_ACTIVATION_GATED",
      activationGatedProcessors: ["process-subscription-renewals"],
      registryCoverage: { totalRegistered: 29, scheduledCount: 26, delegatedCompositeCount: 3 },
      results: [
        { name: "process-earning-lifecycle", status: "COMPLETED", itemsCompleted: 0, itemsRetried: 0 },
      ],
    } satisfies Prisma.InputJsonValue;

    await prisma.systemSetting.upsert({
      where: { key: "production_processor_heartbeat" },
      create: {
        key: "production_processor_heartbeat",
        label: "Operations processor heartbeat",
        type: "JSON",
        value: heartbeatValue,
      },
      update: { value: heartbeatValue },
    });

    const readiness = await getProductionReadiness();
    expect(readiness.capabilityMatrix).toHaveLength(17);

    const eftEntry = readiness.capabilityMatrix.find((c) => c.key === "PAYSTACK_EFT");
    const subscriptionsEntry = readiness.capabilityMatrix.find((c) => c.key === "SUBSCRIPTIONS");
    const processorLoopEntry = readiness.capabilityMatrix.find((c) => c.key === "PROCESSOR_LOOP");
    expect(eftEntry?.eligibleForLiveUse).toBe(false);
    expect(subscriptionsEntry?.eligibleForLiveUse).toBe(false);
    expect(subscriptionsEntry?.sourceImplemented).toBe(true);
    expect(processorLoopEntry?.schedulerRegisteredAndHealthy).toBe(false);

    // Explicitly verify CR-165 unconfigured email & Paystack surfaces clear external blockers
    const matrix = buildCapabilityMatrix({
      now: new Date(),
      releaseSha: "phase-d-test-sha",
      capabilities: [
        capability("email_delivery", "BLOCKED_CONFIGURATION", "EMAIL_PROVIDER_UNCONFIGURED", "Email provider missing", "OPERATIONS"),
        capability("google_maps_browser", "BLOCKED_CONFIGURATION", "GOOGLE_MAPS_BROWSER_KEY_MISSING", "Browser key missing", "OPERATIONS"),
        capability("google_maps_server", "BLOCKED_CONFIGURATION", "GOOGLE_MAPS_SERVER_KEY_MISSING", "Server key missing", "OPERATIONS"),
      ],
      paystack: {
        code: "PAYSTACK",
        configured: false,
        active: false,
        credentialVersionConfigured: false,
        sourceAddressTrustConfigured: true,
        itnVerificationImplemented: true,
        productionValidationApproved: false,
        environment: "not-configured",
        errorCategory: "NOT_CONFIGURED",
        blockReason: "PAYSTACK_DISABLED",
      },
      acceptanceRecords: [],
      heartbeat: null,
      storeOrderPolicyActive: false,
      activePrivacyPolicyCount: 0,
      referralRewardIssuingEnabled: false,
      env: { NODE_ENV: "production" },
    });

    const card = matrix.find((c) => c.key === "PAYSTACK_CARD");
    const email = matrix.find((c) => c.key === "NOTIFICATIONS_AND_EMAIL");
    const maps = matrix.find((c) => c.key === "GOOGLE_MAPS");
    expect(card?.runtimeConfigured).toBe(false);
    expect(card?.eligibleForLiveUse).toBe(false);
    expect(card?.lastBlockerCode).toBeTruthy();
    expect(email?.runtimeConfigured).toBe(false);
    expect(email?.lastBlockerCode).toBeTruthy();
    expect(maps?.runtimeConfigured).toBe(false);
    expect(maps?.lastBlockerCode).toBeTruthy();
  });

  it("F07: verifies governance coverage register and processor execution matrix completeness", () => {
    expect(Object.keys(PROCESSOR_EXECUTION_MATRIX).sort()).toEqual(Object.keys(PROCESSOR_HANDLERS).sort());
    const ids = new Set(DIRECTIVE_REQUIREMENT_COVERAGE_REGISTER.map((entry) => entry.id));
    for (let i = 1; i <= 38; i += 1) {
      expect(ids.has(`SYS-${String(i).padStart(2, "0")}`)).toBe(true);
    }
    for (let i = 1; i <= 60; i += 1) {
      expect(ids.has(`PAR-${String(i).padStart(2, "0")}`)).toBe(true);
    }
    for (let i = 61; i <= 165; i += 1) {
      expect(ids.has(`CR-${String(i).padStart(3, "0")}`)).toBe(true);
    }
  });
});
