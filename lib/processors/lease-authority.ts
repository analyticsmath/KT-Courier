import { phase5Reference, phase5Repository, safeOperationalText } from "@/lib/operations/phase5-repository";
import { PROCESSOR_REGISTRY } from "./processor-registry";

export type ProcessorRunStatus =
  | "REQUESTED"
  | "LEASE_ACQUIRED"
  | "RUNNING"
  | "DRY_RUN_COMPLETED"
  | "APPLY_COMPLETED"
  | "APPLY_PARTIAL"
  | "FAILED"
  | "CANCELLED"
  | "LEASE_LOST";

export interface AcquireLeaseParams {
  jobName: string;
  partition?: string;
  leaseOwner: string;
  operationId?: string;
  leaseDurationSeconds?: number;
  mode?: "DRY_RUN" | "APPLY";
}

export interface AcquireLeaseResult {
  acquired: boolean;
  runId?: string;
  operationId?: string;
  jobName: string;
  partition: string;
  leaseOwner: string;
  leaseExpiresAt?: string;
  reason?: string;
}

export interface CompleteRunParams {
  operationId: string;
  leaseOwner: string;
  status: "DRY_RUN_COMPLETED" | "APPLY_COMPLETED" | "APPLY_PARTIAL" | "FAILED" | "CANCELLED";
  itemsClaimed?: number;
  itemsCompleted?: number;
  itemsRetried?: number;
  itemsReconciled?: number;
  safeErrorCategory?: string;
  safeSummary?: string;
}

export async function acquireProcessorLease(params: AcquireLeaseParams): Promise<AcquireLeaseResult> {
  const processor = PROCESSOR_REGISTRY[params.jobName];
  const partition = params.partition ?? processor?.defaultPartition ?? "default";
  const leaseOwner = safeOperationalText(params.leaseOwner, 80);
  const now = new Date();
  const duration = params.leaseDurationSeconds ?? processor?.maxExecutionDurationSeconds ?? 180;
  const leaseExpiresAt = new Date(now.getTime() + duration * 1000);
  const operationId = params.operationId ?? phase5Reference("RUN");

  // Check existing active lease for jobName + partition
  const activeRuns = await phase5Repository.operationalProcessorRun.findMany({
    where: {
      jobName: params.jobName,
      partition,
      status: { in: ["LEASE_ACQUIRED", "RUNNING"] },
    },
    take: 5,
  }).catch(() => []);

  for (const activeRun of activeRuns) {
    const expiresAt = activeRun.leaseExpiresAt ? new Date(String(activeRun.leaseExpiresAt)) : null;
    if (expiresAt && expiresAt > now) {
      // Lease is active and unexpired - cannot acquire
      return {
        acquired: false,
        jobName: params.jobName,
        partition,
        leaseOwner,
        reason: `Active unexpired lease held by ${activeRun.leaseOwner} until ${expiresAt.toISOString()}`,
      };
    } else if (activeRun.id) {
      // Expired lease - mark LEASE_LOST/EXPIRED
      await phase5Repository.operationalProcessorRun.update({
        where: { id: String(activeRun.id) },
        data: { status: "LEASE_LOST", safeSummary: "Lease expired and was reclaimed" },
      }).catch(() => null);
    }
  }

  // Create new lease run
  const newRun = await phase5Repository.operationalProcessorRun.create({
    data: {
      jobName: params.jobName,
      partition,
      version: processor?.version ?? "1.0.0",
      operationId,
      status: "LEASE_ACQUIRED",
      leaseOwner,
      leaseExpiresAt,
      startedAt: now,
      itemsClaimed: 0,
      itemsCompleted: 0,
      itemsRetried: 0,
      itemsReconciled: 0,
      safeSummary: `Acquired lease for ${params.mode ?? "APPLY"} mode`,
    },
  });

  return {
    acquired: true,
    runId: String(newRun.id),
    operationId: String(newRun.operationId),
    jobName: params.jobName,
    partition,
    leaseOwner,
    leaseExpiresAt: leaseExpiresAt.toISOString(),
  };
}

export async function heartbeatProcessorLease(operationId: string, leaseOwner: string, extendSeconds = 120): Promise<boolean> {
  const run = await phase5Repository.operationalProcessorRun.findUnique({ where: { operationId } });
  if (!run || run.leaseOwner !== leaseOwner || !["LEASE_ACQUIRED", "RUNNING"].includes(String(run.status))) {
    return false;
  }

  const newExpiry = new Date(Date.now() + extendSeconds * 1000);
  await phase5Repository.operationalProcessorRun.update({
    where: { id: String(run.id) },
    data: { leaseExpiresAt: newExpiry, status: "RUNNING" },
  });
  return true;
}

export async function completeProcessorRun(params: CompleteRunParams): Promise<boolean> {
  const run = await phase5Repository.operationalProcessorRun.findUnique({ where: { operationId: params.operationId } });
  if (!run) return false;

  // Stale owner safety check
  if (run.leaseOwner && run.leaseOwner !== params.leaseOwner) {
    throw new Error(`Stale lease owner '${params.leaseOwner}' cannot complete run owned by '${run.leaseOwner}'.`);
  }

  await phase5Repository.operationalProcessorRun.update({
    where: { id: String(run.id) },
    data: {
      status: params.status,
      completedAt: new Date(),
      itemsClaimed: params.itemsClaimed ?? Number(run.itemsClaimed ?? 0),
      itemsCompleted: params.itemsCompleted ?? Number(run.itemsCompleted ?? 0),
      itemsRetried: params.itemsRetried ?? Number(run.itemsRetried ?? 0),
      itemsReconciled: params.itemsReconciled ?? Number(run.itemsReconciled ?? 0),
      safeErrorCategory: params.safeErrorCategory ? safeOperationalText(params.safeErrorCategory, 80) : null,
      safeSummary: params.safeSummary ? safeOperationalText(params.safeSummary, 256) : null,
      leaseExpiresAt: null, // release lease
    },
  });
  return true;
}

export async function listProcessorRuns(jobName?: string, limit = 50) {
  const where = jobName ? { jobName } : {};
  return phase5Repository.operationalProcessorRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: Math.min(limit, 100),
  });
}
