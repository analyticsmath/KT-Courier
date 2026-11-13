import { db } from "@/lib/db";
import { logApplicationEvent } from "@/lib/observability/logger";
import { assertReportStorageReady, getReportArtifactStorage, type ReportArtifactStorage } from "./artifact-storage";

/** Expiry revokes access before deleting private bytes. Metadata is retained. */
export async function expireReportArtifacts({ limit = 100, now = new Date(), storage = getReportArtifactStorage() }: { limit?: number; now?: Date; storage?: ReportArtifactStorage } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isFinite(now.getTime())) throw new Error("Invalid report expiry batch parameters.");
  assertReportStorageReady(storage.provider);
  const candidates = await db.reportExportArtifact.findMany({
    where: { storageDeletedAt: null, expiresAt: { lte: now } },
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }], take: limit,
  });
  const result = { examined: candidates.length, deleted: 0, alreadyAbsent: 0, skipped: 0, failed: 0 };
  for (const candidate of candidates) {
    try {
      const current = await db.reportExportArtifact.findUnique({ where: { id: candidate.id } });
      if (!current || current.storageKey !== candidate.storageKey || current.expiresAt > now || current.storageDeletedAt || current.storageProvider !== storage.provider) {
        result.skipped++;
        continue;
      }
      await db.reportJob.updateMany({ where: { id: current.jobId, status: "COMPLETED" }, data: { status: "EXPIRED" } });
      const job = await db.reportJob.findUnique({ where: { id: current.jobId }, select: { status: true } });
      if (job?.status !== "EXPIRED") { result.skipped++; continue; }
      const deleted = await storage.delete(current.storageKey);
      await db.reportExportArtifact.updateMany({
        where: { id: current.id, storageKey: current.storageKey, storageDeletedAt: null, expiresAt: { lte: now } },
        data: { storageDeletedAt: new Date() },
      });
      if (deleted) result.deleted++;
      else result.alreadyAbsent++;
    } catch {
      result.failed++;
      logApplicationEvent({ level: "ERROR", event: "report.expiry_failed", message: "Expired report artifact cleanup failed.", operation: "report_expiry", resourceReference: candidate.publicReference, outcome: "FAILURE", errorCategory: "REPORT_STORAGE_FAILURE" });
    }
  }
  return result;
}
