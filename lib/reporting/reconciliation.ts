import { db } from "@/lib/db";
import { getReportArtifactStorage, type ReportArtifactStorage } from "./artifact-storage";
import { ReportJobService } from "./services";

export interface ReconciliationScanResult {
  casesOpened: number;
  casesResolved: number;
  artifactsExpired: number;
  details: string[];
}

function reconciliationReference(): string {
  return `REP-REC-${Date.now()}-${Math.random().toString(16).slice(2, 10).toUpperCase()}`;
}

export class ReportReconciliationService {
  private readonly jobService: ReportJobService;

  constructor(private readonly storage: ReportArtifactStorage = getReportArtifactStorage()) {
    this.jobService = new ReportJobService(storage);
  }

  async scanReconciliation(dryRun = true): Promise<ReconciliationScanResult> {
    const details: string[] = [];
    let casesOpened = 0;
    let casesResolved = 0;
    let artifactsExpired = 0;
    const now = new Date();
    const staleBefore = new Date(now.getTime() - 30 * 60 * 1000);

    const [stuckJobs, completedJobs, artifacts] = await Promise.all([
      db.reportJob.findMany({ where: { status: "RUNNING", startedAt: { lt: staleBefore } }, take: 100, orderBy: { startedAt: "asc" } }),
      db.reportJob.findMany({ where: { status: "COMPLETED" }, take: 100, orderBy: { completedAt: "desc" } }),
      db.reportExportArtifact.findMany({ where: { expiresAt: { lte: now }, storageDeletedAt: null }, take: 100, orderBy: [{ expiresAt: "asc" }, { id: "asc" }] }),
    ]);

    for (const job of stuckJobs) {
      details.push(`RUNNING job ${job.publicReference} exceeded the bounded execution window.`);
      casesOpened += await this.openCase("REPORT_JOB_STUCK_RUNNING", job.id, undefined, `Report job ${job.publicReference} exceeded the bounded execution window.`, dryRun);
    }

    for (const job of completedJobs) {
      const artifact = await db.reportExportArtifact.findUnique({ where: { jobId: job.id } });
      if (!artifact) {
        details.push(`Completed job ${job.publicReference} has no artifact.`);
        casesOpened += await this.openCase("REPORT_JOB_WITHOUT_ARTIFACT", job.id, undefined, `Completed report job ${job.publicReference} has no artifact.`, dryRun);
        continue;
      }
      if (!(await this.storage.exists(artifact.storageKey))) {
        details.push(`Completed job ${job.publicReference} has an unavailable artifact.`);
        casesOpened += await this.openCase("REPORT_STORAGE_FAILURE", job.id, artifact.id, `Completed report job ${job.publicReference} has an unavailable artifact.`, dryRun);
      }
    }

    for (const artifact of artifacts) {
      if (artifact.storageProvider !== this.storage.provider) {
        details.push(`Expired artifact ${artifact.publicReference} uses a different storage provider.`);
        continue;
      }
      const exists = await this.storage.exists(artifact.storageKey);
      if (exists) {
        details.push(`Expired artifact ${artifact.publicReference} remains in storage.`);
      }
      if (!dryRun) {
        const updated = await db.reportJob.updateMany({ where: { id: artifact.jobId, status: "COMPLETED" }, data: { status: "EXPIRED" } });
        casesResolved += updated.count;
        const job = await db.reportJob.findUnique({ where: { id: artifact.jobId }, select: { status: true } });
        if (job?.status !== "EXPIRED") continue;
        if (exists) { await this.storage.delete(artifact.storageKey); artifactsExpired += 1; }
        await db.reportExportArtifact.updateMany({ where: { id: artifact.id, storageKey: artifact.storageKey, expiresAt: { lte: now }, storageDeletedAt: null }, data: { storageDeletedAt: new Date() } });
      }
    }

    const orphanArtifacts = await db.reportExportArtifact.findMany({ take: 100, orderBy: { createdAt: "desc" } });
    for (const artifact of orphanArtifacts) {
      const job = await db.reportJob.findUnique({ where: { id: artifact.jobId }, select: { id: true } });
      if (!job) {
        details.push(`Artifact ${artifact.publicReference} has no report job.`);
        casesOpened += await this.openCase("REPORT_ARTIFACT_WITHOUT_JOB", undefined, artifact.id, `Report artifact ${artifact.publicReference} has no report job.`, dryRun);
      }
    }

    return { casesOpened, casesResolved, artifactsExpired, details };
  }

  async cancelStuckJob(jobId: string): Promise<void> {
    const job = await db.reportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Report job not found.");
    if (job.status !== "RUNNING") throw new Error("Only running report jobs can be cancelled by reconciliation.");
    await db.$transaction(async (tx) => {
      const cancelled = await tx.reportJob.updateMany({ where: { id: job.id, status: "RUNNING" }, data: { status: "CANCELLED", errorMessage: "RECONCILIATION_CANCELLED" } });
      if (cancelled.count !== 1) throw new Error("Report job is no longer running.");
      await tx.reportReconciliationCase.updateMany({ where: { jobId: job.id, status: { in: ["OPEN", "IN_PROGRESS"] } }, data: { status: "CONVERGED", convergedAt: new Date() } });
    });
  }

  async retryGeneration(jobId: string): Promise<void> {
    const job = await db.reportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error("Report job not found.");
    const retried = await this.jobService.retryJob(job.publicReference, job.requesterUserId, true);
    if (retried?.status !== "COMPLETED") throw new Error("Report retry did not complete; reconciliation remains open.");
    await db.reportReconciliationCase.updateMany({ where: { jobId: job.id, status: { in: ["OPEN", "IN_PROGRESS"] } }, data: { status: "CONVERGED", convergedAt: new Date() } });
  }

  private async openCase(
    reason: "REPORT_JOB_STUCK_RUNNING" | "REPORT_JOB_WITHOUT_ARTIFACT" | "REPORT_STORAGE_FAILURE" | "REPORT_ARTIFACT_WITHOUT_JOB",
    jobId: string | undefined,
    artifactId: string | undefined,
    safeSummary: string,
    dryRun: boolean
  ): Promise<number> {
    if (dryRun) return 0;
    const existing = await db.reportReconciliationCase.findFirst({ where: { reason, jobId: jobId ?? null, artifactId: artifactId ?? null, status: { in: ["OPEN", "IN_PROGRESS"] } } });
    if (existing) return 0;
    await db.reportReconciliationCase.create({
      data: { publicReference: reconciliationReference(), reason, status: "OPEN", jobId, artifactId, safeSummary, safeEvidence: { source: "report_reconciliation" } },
    });
    return 1;
  }
}
