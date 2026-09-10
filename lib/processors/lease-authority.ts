import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { phase5Reference, safeOperationalText } from "@/lib/operations/phase5-repository";
import { getRegisteredProcessor } from "./processor-registry";

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
  leaseDurationSeconds?: number;
  operationId?: string;
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

/**
 * Acquires an atomic, distributed lease for a processor run.
 * Uses PostgreSQL transaction-scoped advisory locks to ensure that concurrent
 * workers or schedulers cannot race to acquire the same singleton workload.
 */
export async function acquireProcessorLease(params: AcquireLeaseParams): Promise<AcquireLeaseResult> {
  const processor = getRegisteredProcessor(params.jobName);
  const partition = params.partition ?? processor?.defaultPartition ?? "default";
  const leaseOwner = safeOperationalText(params.leaseOwner, 80);
  const now = new Date();
  const duration = params.leaseDurationSeconds ?? processor?.maxExecutionDurationSeconds ?? 180;
  const leaseExpiresAt = new Date(now.getTime() + duration * 1000);
  const operationId = params.operationId ?? phase5Reference("RUN");
  const lockKey = `processor_lease:${params.jobName}:${partition}`;

  try {
    return await prisma.$transaction(async (tx) => {
      // Acquire PostgreSQL advisory transaction lock to serialize lease attempts for this job+partition
      const lockRows = await tx.$queryRaw<{ locked: boolean }[]>(
        Prisma.sql`SELECT pg_try_advisory_xact_lock(hashtext(${lockKey})) as "locked"`,
      );
      const isLocked = lockRows[0]?.locked ?? true;
      if (!isLocked) {
        return {
          acquired: false,
          jobName: params.jobName,
          partition,
          leaseOwner,
          reason: `Concurrent lease acquisition in progress for ${params.jobName}:${partition}`,
        };
      }

      // Check existing active lease for jobName + partition
      const activeRuns = await tx.operationalProcessorRun.findMany({
        where: {
          jobName: params.jobName,
          partition,
          status: { in: ["LEASE_ACQUIRED", "RUNNING"] },
        },
        orderBy: { startedAt: "desc" },
        take: 5,
      });

      for (const activeRun of activeRuns) {
        const expiresAt = activeRun.leaseExpiresAt ? new Date(String(activeRun.leaseExpiresAt)) : null;
        if (expiresAt && expiresAt > now) {
          return {
            acquired: false,
            jobName: params.jobName,
            partition,
            leaseOwner,
            reason: `Active unexpired lease held by ${activeRun.leaseOwner} until ${expiresAt.toISOString()}`,
          };
        } else if (activeRun.id) {
          // Expired lease - reclaim it atomically
          await tx.operationalProcessorRun.update({
            where: { id: String(activeRun.id) },
            data: { status: "LEASE_LOST", safeSummary: "Lease expired and was reclaimed" },
          });
        }
      }

      // Create new lease run record
      const newRun = await tx.operationalProcessorRun.create({
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
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  } catch (err) {
    return {
      acquired: false,
      jobName: params.jobName,
      partition,
      leaseOwner,
      reason: err instanceof Error ? err.message : "Database transaction failure during lease acquisition",
    };
  }
}

export async function heartbeatProcessorLease(operationId: string, leaseOwner: string, extendSeconds = 120): Promise<boolean> {
  const run = await prisma.operationalProcessorRun.findUnique({ where: { operationId } });
  if (!run || run.leaseOwner !== leaseOwner || !["LEASE_ACQUIRED", "RUNNING"].includes(String(run.status))) {
    return false;
  }

  const newExpiry = new Date(Date.now() + extendSeconds * 1000);
  await prisma.operationalProcessorRun.update({
    where: { id: String(run.id) },
    data: { leaseExpiresAt: newExpiry, status: "RUNNING" },
  });
  return true;
}

export async function completeProcessorRun(params: CompleteRunParams): Promise<boolean> {
  const run = await prisma.operationalProcessorRun.findUnique({ where: { operationId: params.operationId } });
  if (!run) return false;

  // Stale owner safety check
  if (run.leaseOwner && run.leaseOwner !== params.leaseOwner) {
    throw new Error(`Stale lease owner '${params.leaseOwner}' cannot complete run owned by '${run.leaseOwner}'.`);
  }

  await prisma.operationalProcessorRun.update({
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
  return prisma.operationalProcessorRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: Math.min(limit, 100),
  });
}
