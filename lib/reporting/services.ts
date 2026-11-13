import crypto from "node:crypto";
import { db } from "@/lib/db";
import { logApplicationEvent } from "@/lib/observability/logger";
import { recordTelemetry } from "@/lib/observability/telemetry";
import { assertReportStorageReady, getReportArtifactStorage, type ReportArtifactStorage } from "./artifact-storage";
import { authorizeReportDefinition, getApprovedReportDefinition, normalizeReportRequest, type ReportActor } from "./authorization";
import { ReportingError } from "./contracts";
import { formatCsvReport, formatJsonReport } from "./csv-sanitizer";
import { generateReportData, type ReportQueryContext } from "./report-generator";
import { resolveReportOwnerScope } from "./owner-scope";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import type { UserRole } from "@/types/db";

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`);
  return `{${entries.join(",")}}`;
}

export function computeFilterHash(filters: Record<string, unknown>): string {
  return crypto.createHash("sha256").update(stableJson(filters)).digest("hex");
}

export function computeRequestHash(definitionKey: string, requesterUserId: string, filterHash: string, format: string): string {
  return crypto.createHash("sha256").update(`${definitionKey}:${requesterUserId}:${filterHash}:${format}`).digest("hex");
}

function publicReference(prefix: "REP" | "ART" | "RPTAUD"): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
}

export interface CreateReportJobInput {
  definitionKey: string;
  requesterUserId: string;
  requesterRole: string;
  ownerScope: Record<string, unknown>;
  permissionSnapshot: string[];
  filters: unknown;
  executionMode: "SYNCHRONOUS_SUMMARY" | "ASYNCHRONOUS_REPORT" | "ASYNCHRONOUS_EXPORT";
  outputFormat: unknown;
}

export class ReportJobService {
  constructor(private readonly storage: ReportArtifactStorage = getReportArtifactStorage()) {}

  async createJob(input: CreateReportJobInput) {
    assertReportStorageReady(this.storage.provider);
    const definition = getApprovedReportDefinition(input.definitionKey);
    const actor: ReportActor = { id: input.requesterUserId, role: input.requesterRole };
    await authorizeReportDefinition(actor, definition, "GENERATE");
    const normalized = normalizeReportRequest({ definition, filters: input.filters, outputFormat: input.outputFormat });
    const filterHash = computeFilterHash(normalized.filters);
    const requestHash = computeRequestHash(definition.key, input.requesterUserId, filterHash, normalized.outputFormat);

    const existing = await db.reportJob.findFirst({
      where: { requestHash, requesterUserId: input.requesterUserId, status: { notIn: ["CANCELLED", "EXPIRED"] } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;

    const expiresAt = new Date(Date.now() + definition.retentionDays * 86_400_000);
    try {
      const job = await db.reportJob.create({
        data: {
          publicReference: publicReference("REP"),
          definitionKey: definition.key,
          definitionVersion: definition.version,
          requesterUserId: input.requesterUserId,
          requesterRole: input.requesterRole,
          ownerScope: input.ownerScope as never,
          permissionSnapshot: Array.from(new Set([...input.permissionSnapshot, definition.requiredPermission])) as never,
          normalizedFilters: normalized.filters as never,
          filterHash,
          executionMode: input.executionMode === "SYNCHRONOUS_SUMMARY" ? "ASYNCHRONOUS_REPORT" : input.executionMode,
          outputFormat: normalized.outputFormat,
          rowCountLimit: definition.maximumRowCount,
          status: "QUEUED",
          requestHash,
          expiresAt,
        },
      });

      await this.recordAudit(input.requesterUserId, "REPORT_JOB_REQUESTED", job.publicReference, { definitionKey: definition.key, outputFormat: normalized.outputFormat });
      if (input.executionMode === "SYNCHRONOUS_SUMMARY") return this.processJob(job.publicReference);
      return job;
    } catch (error: unknown) {
      if ((error as { code?: string }).code === "P2002") {
        const duplicate = await db.reportJob.findFirst({ where: { requestHash, requesterUserId: input.requesterUserId }, orderBy: { createdAt: "desc" } });
        if (duplicate) return duplicate;
      }
      throw error;
    }
  }

  async processJob(publicReferenceValue: string) {
    assertReportStorageReady(this.storage.provider);
    const job = await db.reportJob.findUnique({ where: { publicReference: publicReferenceValue } });
    if (!job) throw new ReportingError("REPORT_JOB_NOT_FOUND", 404, "Report job not found.");
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(job.status)) return job;

    const claimToken = crypto.randomBytes(16).toString("hex").toUpperCase();
    const claimed = await db.reportJob.updateMany({
      where: { id: job.id, status: { in: ["REQUESTED", "QUEUED", "FAILED_RETRYABLE"] } },
      data: { status: "RUNNING", startedAt: new Date(), claimToken, claimExpiresAt: new Date(Date.now() + 30 * 60_000), errorMessage: null },
    });
    if (claimed.count !== 1) return db.reportJob.findUnique({ where: { id: job.id } });

    const startedAt = Date.now();
    let storedKey: string | null = null;
    try {
      const definition = getApprovedReportDefinition(job.definitionKey);
      const requester = await db.user.findUnique({ where: { id: job.requesterUserId }, select: { role: true, status: true } });
      if (!requester || requester.status !== "ACTIVE" || requester.role !== job.requesterRole) {
        throw new ReportingError("REPORT_REQUESTER_INACTIVE", 403, "The report requester is no longer eligible.");
      }
      await authorizeReportDefinition({ id: job.requesterUserId, role: requester.role }, definition, "GENERATE");
      const currentScope = await resolveReportOwnerScope({ id: job.requesterUserId, role: requester.role });
      if (stableJson(currentScope) !== stableJson(job.ownerScope)) {
        throw new ReportingError("REPORT_OWNER_SCOPE_MISMATCH", 403, "The report owner scope has changed.");
      }
      const queryContext: ReportQueryContext = {
        definitionKey: job.definitionKey,
        requesterUserId: job.requesterUserId,
        requesterRole: job.requesterRole,
        ownerScope: job.ownerScope as ReportQueryContext["ownerScope"],
        filters: job.normalizedFilters as Record<string, unknown>,
        limit: Math.min(job.rowCountLimit, definition.maximumRowCount),
      };
      const data = await generateReportData(queryContext);
      const content = job.outputFormat === "JSON" ? formatJsonReport(data.rows) : formatCsvReport(data.headers, data.rows);
      const contentType = job.outputFormat === "JSON" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8";
      const storageKey = this.storage.createStorageKey(`${job.publicReference}-${claimToken}`, job.outputFormat, content);
      storedKey = storageKey;
      await this.storage.store(storageKey, content);
      const checksum = crypto.createHash("sha256").update(content).digest("hex");

      const completed = await db.$transaction(async (tx) => {
        const changed = await tx.reportJob.updateMany({ where: { id: job.id, status: "RUNNING", claimToken, claimExpiresAt: { gt: new Date() } }, data: { status: "COMPLETED", claimToken: null, claimExpiresAt: null, rowCount: data.rows.length, completedAt: new Date() } });
        if (changed.count !== 1) return null;
        await tx.reportExportArtifact.create({ data: {
          publicReference: publicReference("ART"),
          jobId: job.id,
          format: job.outputFormat,
          storageProvider: this.storage.provider,
          storageKey,
          contentType,
          byteSize: Buffer.byteLength(content, "utf8"),
          checksum,
          expiresAt: job.expiresAt ?? new Date(Date.now() + definition.retentionDays * 86_400_000),
        } });
        await tx.reportAuditEvent.create({ data: {
          publicReference: publicReference("RPTAUD"), actorUserId: job.requesterUserId,
          eventType: "REPORT_JOB_COMPLETED", entityReference: job.publicReference,
          safeEvidence: { rowCount: data.rows.length },
        } });
        return tx.reportJob.findUnique({ where: { id: job.id } });
      });
      if (!completed) {
        await this.storage.delete(storageKey);
        storedKey = null;
        return db.reportJob.findUnique({ where: { id: job.id } });
      }
      // Once the artifact and job have committed, a later telemetry failure must
      // not delete the file backing the committed report.
      storedKey = null;
      await recordTelemetry({ name: "report.generation.duration", value: Date.now() - startedAt, outcome: "SUCCESS" }).catch(() => {
        logApplicationEvent({ level: "ERROR", event: "report.telemetry_write_failed", message: "Report completion telemetry could not be recorded.", operation: "report_generation", resourceReference: job.publicReference, outcome: "FAILURE", errorCategory: "REPORT_TELEMETRY_WRITE_FAILED" });
      });
      return completed;
    } catch {
      if (storedKey) await this.storage.delete(storedKey).catch(() => undefined);
      await db.reportJob.updateMany({
        where: { id: job.id, status: "RUNNING", claimToken },
        data: { status: "FAILED_RETRYABLE", claimToken: null, claimExpiresAt: null, errorMessage: "REPORT_GENERATION_FAILED", failedAt: new Date() },
      });
      await recordTelemetry({ name: "report.generation.duration", value: Date.now() - startedAt, outcome: "FAILURE" });
      logApplicationEvent({ level: "ERROR", event: "report.generation_failed", message: "Report generation failed.", operation: "report_generation", resourceReference: job.publicReference, outcome: "FAILURE", errorCategory: "REPORT_GENERATION_FAILED" });
      throw new ReportingError("REPORT_GENERATION_FAILED", 503, "Report generation could not be completed.");
    }
  }

  async cancelJob(publicReferenceValue: string, requesterUserId: string, isAdmin = false) {
    const job = await db.reportJob.findUnique({ where: { publicReference: publicReferenceValue } });
    if (!job) throw new ReportingError("REPORT_JOB_NOT_FOUND", 404, "Report job not found.");
    if (!isAdmin && job.requesterUserId !== requesterUserId) throw new ReportingError("FORBIDDEN", 403, "You do not own this report job.");
    if (["COMPLETED", "EXPIRED"].includes(job.status)) throw new ReportingError("CANNOT_CANCEL_REPORT_JOB", 409, "This report job cannot be cancelled.");
    const cancelled = await db.reportJob.updateMany({ where: { id: job.id, status: { in: ["REQUESTED", "QUEUED", "RUNNING", "FAILED_RETRYABLE", "FAILED_PERMANENT"] } }, data: { status: "CANCELLED" } });
    if (cancelled.count !== 1) {
      const current = await db.reportJob.findUnique({ where: { id: job.id } });
      if (current?.status === "CANCELLED") return current;
      throw new ReportingError("CANNOT_CANCEL_REPORT_JOB", 409, "This report job cannot be cancelled.");
    }
    const updated = await db.reportJob.findUnique({ where: { id: job.id } });
    await this.recordAudit(requesterUserId, "REPORT_JOB_CANCELLED", job.publicReference, {});
    return updated;
  }

  async retryJob(publicReferenceValue: string, requesterUserId: string, isAdmin = false) {
    const job = await db.reportJob.findUnique({ where: { publicReference: publicReferenceValue } });
    if (!job) throw new ReportingError("REPORT_JOB_NOT_FOUND", 404, "Report job not found.");
    if (!isAdmin && job.requesterUserId !== requesterUserId) throw new ReportingError("FORBIDDEN", 403, "You do not own this report job.");
    if (!['FAILED_RETRYABLE', 'FAILED_PERMANENT'].includes(job.status)) throw new ReportingError("REPORT_JOB_NOT_RETRYABLE", 409, "This report job is not retryable.");
    const queued = await db.reportJob.updateMany({ where: { id: job.id, status: { in: ["FAILED_RETRYABLE", "FAILED_PERMANENT"] } }, data: { status: "QUEUED", errorMessage: null, failedAt: null } });
    if (queued.count !== 1) throw new ReportingError("REPORT_JOB_NOT_RETRYABLE", 409, "This report job cannot be retried in its current state.");
    return this.processJob(publicReferenceValue);
  }

  private async recordAudit(actorUserId: string, eventType: string, entityReference: string, safeEvidence: Record<string, unknown>): Promise<void> {
    await db.reportAuditEvent.create({
      data: { publicReference: publicReference("RPTAUD"), actorUserId, eventType, entityReference, safeEvidence: safeEvidence as never },
    }).catch(() => {
      logApplicationEvent({ level: "ERROR", event: "report.audit_write_failed", message: "Required report audit evidence could not be written.", operation: "report_audit", actorReference: actorUserId, resourceReference: entityReference, outcome: "FAILURE", errorCategory: "REPORT_AUDIT_WRITE_FAILED" });
      throw new ReportingError("REPORT_AUDIT_WRITE_FAILED", 503, "Report operation could not be recorded safely.");
    });
  }
}

export class ReportDownloadService {
  constructor(private readonly storage: ReportArtifactStorage = getReportArtifactStorage()) {}

  async getArtifactFile(artifactId: string, userId: string, role: string, ipAddress?: string, userAgent?: string) {
    assertReportStorageReady(this.storage.provider);
    const artifact = await db.reportExportArtifact.findUnique({ where: { id: artifactId } });
    if (!artifact) throw new ReportingError("ARTIFACT_NOT_FOUND", 404, "Export artifact not found.");
    if (new Date() >= artifact.expiresAt) throw new ReportingError("ARTIFACT_EXPIRED", 410, "Export artifact has expired.");
    const job = await db.reportJob.findUnique({ where: { id: artifact.jobId } });
    if (!job || job.status !== "COMPLETED") throw new ReportingError("ARTIFACT_NOT_AVAILABLE", 404, "Export artifact is unavailable.");
    const definition = getApprovedReportDefinition(job.definitionKey);
    const actor = { id: userId, role };
    if (job.requesterUserId === userId) {
      await authorizeReportDefinition(actor, definition, "DOWNLOAD");
    } else {
      if (role !== "ADMIN" && role !== "SUPER_ADMIN") throw new ReportingError("FORBIDDEN", 403, "You do not have access to this export artifact.");
      await authorizeReportDefinition(actor, definition, "READ");
      if (!await hasPermission({ userId, role: role as UserRole, permissionKey: PERMISSIONS.REPORT_ARTIFACT_READ })) {
        throw new ReportingError("FORBIDDEN", 403, "You do not have access to this export artifact.");
      }
    }

    const content = await this.storage.open(artifact.storageKey);
    await db.$transaction([
      db.reportDownloadAudit.create({
        data: {
          publicReference: publicReference("RPTAUD"), artifactId: artifact.id,
          downloadTokenHash: crypto.createHash("sha256").update(`${artifactId}:${userId}:${Date.now()}`).digest("hex"),
          authenticatedUserId: userId, authenticatedRole: role,
          ipAddress: ipAddress?.slice(0, 64), userAgent: userAgent?.replace(/[\r\n\0]/g, " ").slice(0, 512),
        },
      }),
      db.reportExportArtifact.update({ where: { id: artifact.id }, data: { downloadCount: { increment: 1 } } }),
    ]);

    const extension = artifact.format === "JSON" ? "json" : "csv";
    return { content, contentType: artifact.contentType, filename: `kt-couriers-report-${artifact.publicReference}.${extension}` };
  }
}

/** Permission enforcement remains at the route boundary; this is the canonical read authority. */
export class ReportAdministrationService {
  async listJobs() {
    return db.reportJob.findMany({
      orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, publicReference: true, definitionKey: true, requesterRole: true, status: true, outputFormat: true, rowCount: true, createdAt: true },
    });
  }

  async listArtifacts() {
    return db.reportExportArtifact.findMany({
      orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, publicReference: true, format: true, byteSize: true, checksum: true, downloadCount: true, expiresAt: true },
    });
  }

  async listReconciliationCases() {
    return db.reportReconciliationCase.findMany({
      orderBy: { createdAt: "desc" }, take: 100,
      select: { id: true, publicReference: true, reason: true, status: true, safeSummary: true, openedAt: true },
    });
  }
}
