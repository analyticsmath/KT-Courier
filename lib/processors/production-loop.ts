import { randomUUID } from "node:crypto";
import type { ImplementedProcessorName } from "./processor-registry";

// Canonical payment, marketplace settlement and notification queues run automatically.
// External payout execution and commercial programmes retain their separate approval gates.
export const productionProcessors = [
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
  // Live operations must scan unresolved money movements, not merely
  // register their processors in a separate unused scheduler executable.
  "scan-payment-reconciliation",
  "scan-refund-reconciliation",
  "scan-withdrawal-reconciliation",
  "scan-paystack-transfer-reconciliation",
  // Scheduled compliance, loyalty backfill, and activation-gated commercial jobs
  "process-managed-marketing-lifecycle",
  "process-privacy-requests",
  "process-data-retention",
  "reconcile-customer-parcel-loyalty",
  "process-subscription-renewals",
  "process-promoter-qualifications",
  "process-valid-click-charges",
  "deliver-developer-webhooks",
] as const satisfies readonly ImplementedProcessorName[];

/** Composite canonical consumers already execute these registered processor paths
 * inside one authoritative queue pass without duplicate polling loops. */
export const DELEGATED_COMPOSITE_PROCESSORS = {
  "finalize-paid-marketplace-checkouts": "consume-verified-payment-events",
  "release-mature-store-earnings": "process-earning-lifecycle",
  "release-mature-driver-earnings": "process-earning-lifecycle",
} as const satisfies Readonly<Partial<Record<ImplementedProcessorName, (typeof productionProcessors)[number]>>>;

export type ProcessorActivationState = "ACTIVE" | "ACTIVATION_GATED" | "DISABLED_BY_FLAG";

export type ProductionCycleResult = Readonly<{
  name: ProductionProcessor;
  status: "COMPLETED" | "PEER_LEASE" | "FAILED" | "IDLE";
  itemsCompleted: number;
  itemsRetried: number;
  activationState?: ProcessorActivationState;
  blockerCode?: string | null;
  backlogCount?: number | null;
}>;

export function summarizeProductionCycleReadiness(results: readonly ProductionCycleResult[], blockers: readonly string[] = []) {
  const automaticBlockers: string[] = [];
  for (const result of results) {
    const normalizedName = result.name.replaceAll("-", "_").toUpperCase();
    if (result.status === "FAILED") {
      automaticBlockers.push(`PROCESSOR_FAILED_${normalizedName}`);
    } else if (result.itemsRetried > 0) {
      automaticBlockers.push(`PROCESSOR_RETRY_BACKLOG_${normalizedName}`);
    }
  }
  const readinessBlockers = [...new Set([...blockers, ...automaticBlockers])].sort();
  return {
    healthy: results.length === productionProcessors.length &&
      results.every((result) => result.status !== "FAILED" && result.itemsRetried === 0) &&
      readinessBlockers.length === 0,
    readinessBlockers,
  };
}

export type ProductionProcessor = typeof productionProcessors[number];
type Executor = (input: { name: ProductionProcessor; mode: "APPLY"; operationId: string }) => Promise<{ itemsCompleted: number; itemsRetried: number }>;
type WorkCheck = (name: ProductionProcessor) => Promise<boolean>;

export const DEFAULT_PRODUCTION_PROCESSOR_CADENCE_MS: Readonly<Partial<Record<ProductionProcessor, number>>> = {
  "process-ordinary-referral-awards": 300_000,
  "end-expired-promotions": 300_000,
  "expire-report-artifacts": 3_600_000,
  "generate-report-jobs": 60_000,
  "expire-developer-api-credentials": 3_600_000,
  "reconcile-expired-dispatch": 60_000,
  "escalate-unassigned-courier-orders": 300_000,
  "expire-unpaid-courier-orders": 300_000,
  "monitor-overdue-driver-cash": 900_000,
  "dispatch-marketplace-orders": 60_000,
  "scan-payment-reconciliation": 900_000,
  "scan-refund-reconciliation": 900_000,
  "scan-withdrawal-reconciliation": 900_000,
  "scan-paystack-transfer-reconciliation": 900_000,
  "process-managed-marketing-lifecycle": 300_000,
  "process-privacy-requests": 300_000,
  "process-data-retention": 86_400_000,
  "reconcile-customer-parcel-loyalty": 300_000,
  "process-subscription-renewals": 300_000,
  "process-promoter-qualifications": 300_000,
  "process-valid-click-charges": 300_000,
  "deliver-developer-webhooks": 60_000,
};

/** Keep automatic financial work closed until its operator authorization and issuing switch are both present. */
export async function hasEnabledOrdinaryReferralWork(checks: { isAuthorized: boolean; isEnabled: () => Promise<boolean>; hasPending: () => Promise<boolean> }): Promise<boolean> {
  return checks.isAuthorized && await checks.isEnabled() && await checks.hasPending();
}

export async function hasEnabledPromotionExpiryWork(checks: { enabled: boolean; approved: boolean; hasPending: () => Promise<boolean> }): Promise<boolean> {
  return checks.enabled && checks.approved && await checks.hasPending();
}

export function evaluateCommercialGateState(input: { enabled: boolean; approved: boolean; blockerCode: string }): {
  activationState: ProcessorActivationState;
  blockerCode: string | null;
} {
  if (!input.approved) return { activationState: "ACTIVATION_GATED", blockerCode: input.blockerCode };
  if (!input.enabled) return { activationState: "DISABLED_BY_FLAG", blockerCode: `${input.blockerCode}_WORKER_DISABLED` };
  return { activationState: "ACTIVE", blockerCode: null };
}

export function evaluateOperationalWorkerGateState(input: { enabled: boolean; blockerCode: string }): {
  activationState: ProcessorActivationState;
  blockerCode: string | null;
} {
  if (!input.enabled) return { activationState: "DISABLED_BY_FLAG", blockerCode: `${input.blockerCode}_WORKER_DISABLED` };
  return { activationState: "ACTIVE", blockerCode: null };
}

export async function hasEnabledCommercialProcessorWork(checks: {
  enabled: boolean;
  approved: boolean;
  hasPending: () => Promise<boolean>;
}): Promise<boolean> {
  return checks.enabled && checks.approved && await checks.hasPending();
}

export interface ProcessorCadenceTracker {
  isDue(name: ProductionProcessor, now?: number): boolean;
  markChecked(name: ProductionProcessor, now?: number): void;
  reset(): void;
}

export function createProcessorCadenceTracker(
  cadences: Partial<Record<ProductionProcessor, number>> = DEFAULT_PRODUCTION_PROCESSOR_CADENCE_MS,
  nowFn: () => number = () => Date.now(),
): ProcessorCadenceTracker {
  const lastCheckedAt = new Map<ProductionProcessor, number>();
  return {
    isDue(name: ProductionProcessor, now = nowFn()): boolean {
      const minInterval = cadences[name];
      if (!minInterval) return true;
      const last = lastCheckedAt.get(name) ?? 0;
      return now - last >= minInterval;
    },
    markChecked(name: ProductionProcessor, now = nowFn()): void {
      lastCheckedAt.set(name, now);
    },
    reset(): void {
      lastCheckedAt.clear();
    },
  };
}

/** Avoid a full empty-queue sweep during worker startup, but let the earning
 * lifecycle make its first cursor pass so persisted cursors can wrap safely.
 * Cadence-configured processors can be throttled via an optional cadence tracker.
 * `expire-unpaid-courier-orders` only marks its cadence window when eligible
 * expired work is actually found, so an empty check right before a 24h deadline
 * never postpones deadline cancellation by 5 minutes. */
export function createProductionCycleWorkCheck(
  hasWork: WorkCheck,
  firstCycle: boolean,
  cadenceTracker?: ProcessorCadenceTracker,
): WorkCheck {
  return async (name) => {
    if (cadenceTracker && !cadenceTracker.isDue(name)) return false;
    if (firstCycle && name === "process-earning-lifecycle") {
      cadenceTracker?.markChecked(name);
      return true;
    }
    if (name === "expire-unpaid-courier-orders") {
      const workFound = await hasWork(name);
      if (workFound && cadenceTracker) {
        cadenceTracker.markChecked(name);
      }
      return workFound;
    }
    if (cadenceTracker) cadenceTracker.markChecked(name);
    return hasWork(name);
  };
}

export type ProcessorHeartbeatEntry = Readonly<{
  name: ProductionProcessor;
  status: "COMPLETED" | "PEER_LEASE" | "FAILED" | "IDLE";
  itemsCompleted: number;
  itemsRetried: number;
  activationState: ProcessorActivationState;
  blockerCode: string | null;
  lastSuccessAt: string | null;
}>;

export type WorkerProcessorHeartbeatSnapshot = Readonly<{
  workerId: string;
  observedAt: string;
  healthy: boolean;
  readinessBlockers: readonly string[];
  releaseSha: string | null;
  activationGatedProcessors: readonly ImplementedProcessorName[];
  processors: readonly ProcessorHeartbeatEntry[];
}>;

export type ClusterProcessorHeartbeatValue = Readonly<{
  observedAt: string;
  healthy: boolean;
  readinessBlockers: readonly string[];
  releaseSha: string | null;
  commercialActivationSummary: "PARTIAL_ACTIVATION_GATED" | "ALL_PROGRAMS_ACTIVE";
  activationGatedProcessors: readonly ImplementedProcessorName[];
  activeWorkerIds: readonly string[];
  workerDiscrepancies: readonly string[];
  workers: Readonly<Record<string, WorkerProcessorHeartbeatSnapshot>>;
  registryCoverage: Readonly<{
    totalRegistered: number;
    scheduledInLoop: number;
    delegatedComposite: typeof DELEGATED_COMPOSITE_PROCESSORS;
  }>;
  processors: readonly ProcessorHeartbeatEntry[];
}>;

export function resolveProcessorWorkerIdentity(
  source: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const raw =
    source.KT_PROCESSOR_WORKER_ID?.trim() ||
    source.RAILWAY_SERVICE_NAME?.trim() ||
    source.RAILWAY_REPLICA_ID?.trim() ||
    `worker-${process.pid}`;
  return raw.replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 80) || "worker-default";
}

const STATUS_PRIORITY: Readonly<Record<ProcessorHeartbeatEntry["status"], number>> = {
  FAILED: 4,
  COMPLETED: 3,
  PEER_LEASE: 2,
  IDLE: 1,
};

/**
 * Merges a worker's cycle heartbeat into the shared cluster heartbeat without
 * letting competing workers (e.g. `operations` vs `query-storefront-categories`)
 * clobber each other's monotonic `lastSuccessAt`, completed counts, retry
 * backlogs, or readiness blockers.
 */
export function mergeClusterProcessorHeartbeats(input: {
  workerSnapshot: WorkerProcessorHeartbeatSnapshot;
  existingClusterHeartbeat?: unknown;
  totalRegistered: number;
  staleWorkerTtlMs?: number;
}): ClusterProcessorHeartbeatValue {
  const staleTtlMs = input.staleWorkerTtlMs ?? 420_000;
  const nowMs = new Date(input.workerSnapshot.observedAt).getTime();
  const priorObj =
    input.existingClusterHeartbeat &&
    typeof input.existingClusterHeartbeat === "object" &&
    !Array.isArray(input.existingClusterHeartbeat)
      ? (input.existingClusterHeartbeat as Record<string, unknown>)
      : {};

  const priorWorkersRaw =
    priorObj.workers && typeof priorObj.workers === "object" && !Array.isArray(priorObj.workers)
      ? (priorObj.workers as Record<string, WorkerProcessorHeartbeatSnapshot>)
      : {};

  const priorLastSuccess = new Map<string, string>();
  if (Array.isArray(priorObj.processors)) {
    for (const p of priorObj.processors as Array<{ name?: string; lastSuccessAt?: string | null }>) {
      if (p?.name && typeof p.lastSuccessAt === "string") {
        priorLastSuccess.set(p.name, p.lastSuccessAt);
      }
    }
  }

  const freshWorkers: Record<string, WorkerProcessorHeartbeatSnapshot> = {};
  for (const [id, snapshot] of Object.entries(priorWorkersRaw)) {
    if (!snapshot || typeof snapshot.observedAt !== "string") continue;
    const age = nowMs - new Date(snapshot.observedAt).getTime();
    if (Number.isFinite(age) && age >= 0 && age < staleTtlMs) {
      freshWorkers[id] = snapshot;
    }
    if (Array.isArray(snapshot?.processors)) {
      for (const p of snapshot.processors) {
        if (p?.name && typeof p.lastSuccessAt === "string") {
          const prev = priorLastSuccess.get(p.name);
          if (!prev || p.lastSuccessAt > prev) priorLastSuccess.set(p.name, p.lastSuccessAt);
        }
      }
    }
  }
  freshWorkers[input.workerSnapshot.workerId] = input.workerSnapshot;

  const activeWorkerList = Object.values(freshWorkers).sort((a, b) =>
    a.workerId.localeCompare(b.workerId),
  );
  const activeWorkerIds = activeWorkerList.map((w) => w.workerId);
  const workerDiscrepancies: string[] = [];

  const mergedProcessors: ProcessorHeartbeatEntry[] = productionProcessors.map((name) => {
    const entries = activeWorkerList
      .map((w) => w.processors.find((p) => p.name === name))
      .filter((p): p is ProcessorHeartbeatEntry => Boolean(p));

    let bestStatus: ProcessorHeartbeatEntry["status"] = "IDLE";
    let itemsCompleted = 0;
    let itemsRetried = 0;
    let lastSuccessAt: string | null = priorLastSuccess.get(name) ?? null;

    const states = new Set<ProcessorActivationState>();
    for (const entry of entries) {
      if (STATUS_PRIORITY[entry.status] > STATUS_PRIORITY[bestStatus]) {
        bestStatus = entry.status;
      }
      itemsCompleted += entry.itemsCompleted;
      if (entry.itemsRetried > itemsRetried) {
        itemsRetried = entry.itemsRetried;
      }
      if (entry.lastSuccessAt && (!lastSuccessAt || entry.lastSuccessAt > lastSuccessAt)) {
        lastSuccessAt = entry.lastSuccessAt;
      }
      states.add(entry.activationState);
    }

    if (states.size > 1) {
      workerDiscrepancies.push(`WORKER_ACTIVATION_DRIFT_${name.replaceAll("-", "_").toUpperCase()}`);
    }

    // Prefer ACTIVE if any active worker has the capability enabled, else latest worker's state
    const activeEntry =
      entries.find((e) => e.activationState === "ACTIVE") ??
      input.workerSnapshot.processors.find((p) => p.name === name) ??
      entries[0];

    return {
      name,
      status: bestStatus,
      itemsCompleted,
      itemsRetried,
      activationState: activeEntry?.activationState ?? "ACTIVE",
      blockerCode: activeEntry?.activationState === "ACTIVE" ? null : (activeEntry?.blockerCode ?? null),
      lastSuccessAt,
    };
  });

  const allExplicitBlockers = activeWorkerList.flatMap((w) =>
    w.readinessBlockers.filter(
      (code) => !code.startsWith("PROCESSOR_FAILED_") && !code.startsWith("PROCESSOR_RETRY_BACKLOG_"),
    ),
  );
  const clusterReadiness = summarizeProductionCycleReadiness(mergedProcessors, allExplicitBlockers);
  const activationGatedProcessors = mergedProcessors
    .filter((entry) => entry.activationState === "ACTIVATION_GATED")
    .map((entry) => entry.name);

  return {
    observedAt: input.workerSnapshot.observedAt,
    healthy: clusterReadiness.healthy,
    readinessBlockers: clusterReadiness.readinessBlockers,
    releaseSha: input.workerSnapshot.releaseSha,
    commercialActivationSummary:
      activationGatedProcessors.length > 0 ? "PARTIAL_ACTIVATION_GATED" : "ALL_PROGRAMS_ACTIVE",
    activationGatedProcessors,
    activeWorkerIds,
    workerDiscrepancies: [...new Set(workerDiscrepancies)].sort(),
    workers: freshWorkers,
    registryCoverage: {
      totalRegistered: input.totalRegistered,
      scheduledInLoop: productionProcessors.length,
      delegatedComposite: DELEGATED_COMPOSITE_PROCESSORS,
    },
    processors: mergedProcessors,
  };
}

export async function runProductionCycle(execute: Executor, stopping: () => boolean = () => false, hasWork?: (name: ProductionProcessor) => Promise<boolean>) {
  const results: { name: ProductionProcessor; status: "COMPLETED" | "PEER_LEASE" | "FAILED" | "IDLE"; itemsCompleted: number; itemsRetried: number }[] = [];
  for (const name of productionProcessors) {
    if (stopping()) break;
    try {
      if (hasWork && !await hasWork(name)) {
        results.push({ name, status: "IDLE", itemsCompleted: 0, itemsRetried: 0 });
        continue;
      }
      const result = await execute({ name, mode: "APPLY", operationId: `PROD-${randomUUID()}` });
      results.push({ name, status: "COMPLETED", itemsCompleted: result.itemsCompleted, itemsRetried: result.itemsRetried });
    } catch (error) {
      const peerLease = error instanceof Error && /Active unexpired lease|Concurrent lease acquisition/.test(error.message);
      results.push({ name, status: peerLease ? "PEER_LEASE" : "FAILED", itemsCompleted: 0, itemsRetried: 0 });
    }
  }
  return results;
}
