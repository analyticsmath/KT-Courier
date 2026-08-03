import crypto from "crypto";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { ReportJobService } from "./services";

const ARTIFACT_STORAGE_DIR = process.env.REPORT_ARTIFACT_DIR || path.join(process.cwd(), "artifacts", "reports");

export interface ReconciliationScanResult {
  casesOpened: number;
  casesResolved: number;
  details: string[];
}

export class ReportReconciliationService {
  private jobService = new ReportJobService();

  async scanReconciliation(dryRun = true): Promise<ReconciliationScanResult> {
    const details: string[] = [];
    let casesOpened = 0;
    let casesResolved = 0;

    // 1. Check for stuck running jobs (> 30 minutes in RUNNING state)
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const stuckJobs = await db.reportJob.findMany({
      where: {
        status: "RUNNING",
        startedAt: { lt: thirtyMinsAgo },
      },
    });

    for (const job of stuckJobs) {
      details.push(`Found stuck job ${job.publicReference} in RUNNING state since ${job.startedAt}`);
      if (!dryRun) {
        const publicReference = `REP-REC-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
        await db.reportReconciliationCase.create({
          data: {
            publicReference,
            reason: "REPORT_JOB_STUCK_RUNNING",
            status: "OPEN",
            jobId: job.id,
            safeSummary: `Job ${job.publicReference} stuck in RUNNING state.`,
            safeEvidence: { jobReference: job.publicReference, startedAt: job.startedAt },
          },
        });
        casesOpened++;
      }
    }

    // 2. Check for COMPLETED jobs missing export artifacts
    const completedJobs = await db.reportJob.findMany({
      where: { status: "COMPLETED" },
      take: 100,
      orderBy: { completedAt: "desc" },
    });

    for (const job of completedJobs) {
      const artifact = await db.reportExportArtifact.findUnique({
        where: { jobId: job.id },
      });
      if (!artifact) {
        details.push(`Completed job ${job.publicReference} has no export artifact.`);
        if (!dryRun) {
          const publicReference = `REP-REC-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
          await db.reportReconciliationCase.create({
            data: {
              publicReference,
              reason: "REPORT_JOB_WITHOUT_ARTIFACT",
              status: "OPEN",
              jobId: job.id,
              safeSummary: `Completed job ${job.publicReference} missing artifact.`,
              safeEvidence: { jobReference: job.publicReference },
            },
          });
          casesOpened++;
        }
      }
    }

    // 3. Check for expired artifacts still on disk or status not updated
    const expiredArtifacts = await db.reportExportArtifact.findMany({
      where: { expiresAt: { lt: new Date() } },
    });

    for (const artifact of expiredArtifacts) {
      const filePath = path.join(ARTIFACT_STORAGE_DIR, artifact.storageKey);
      if (fs.existsSync(filePath)) {
        details.push(`Expired artifact ${artifact.publicReference} still exists on disk.`);
        if (!dryRun) {
          fs.unlinkSync(filePath);
          casesResolved++;
        }
      }
    }

    return { casesOpened, casesResolved, details };
  }

  async cancelStuckJob(jobId: string) {
    const job = await db.reportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error(`Job ${jobId} not found`);

    await db.reportJob.update({
      where: { id: jobId },
      data: { status: "CANCELLED", errorMessage: "Cancelled by reconciliation" },
    });

    // Close any open case
    await db.reportReconciliationCase.updateMany({
      where: { jobId, status: "OPEN" },
      data: { status: "CONVERGED", convergedAt: new Date() },
    });
  }

  async retryGeneration(jobId: string) {
    const job = await db.reportJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error(`Job ${jobId} not found`);

    await this.jobService.retryJob(job.publicReference, job.requesterUserId, true);

    await db.reportReconciliationCase.updateMany({
      where: { jobId, status: "OPEN" },
      data: { status: "CONVERGED", convergedAt: new Date() },
    });
  }
}
