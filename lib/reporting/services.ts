import crypto from "crypto";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { REPORT_DEFINITIONS, ReportExportFormat, ReportingError } from "./contracts";
import { formatCsvReport, formatJsonReport } from "./csv-sanitizer";
import { generateReportData, ReportQueryContext } from "./report-generator";

const DOWNLOAD_SECRET_KEY = process.env.REPORTING_DOWNLOAD_HMAC_KEY || "kt_courier_reporting_download_secret_key_32bytes_min!";
const ARTIFACT_STORAGE_DIR = process.env.REPORT_ARTIFACT_DIR || path.join(process.cwd(), "artifacts", "reports");

function ensureStorageDirExists(): void {
  if (!fs.existsSync(ARTIFACT_STORAGE_DIR)) {
    fs.mkdirSync(ARTIFACT_STORAGE_DIR, { recursive: true });
  }
}

export function computeFilterHash(filters: Record<string, unknown>): string {
  const sorted = Object.keys(filters)
    .sort()
    .reduce((acc, key) => {
      acc[key] = filters[key];
      return acc;
    }, {} as Record<string, unknown>);
  return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

export function computeRequestHash(
  definitionKey: string,
  requesterUserId: string,
  filterHash: string,
  format: string
): string {
  return crypto
    .createHash("sha256")
    .update(`${definitionKey}:${requesterUserId}:${filterHash}:${format}`)
    .digest("hex");
}

export class ReportJobService {
  async createJob(input: {
    definitionKey: string;
    requesterUserId: string;
    requesterRole: string;
    ownerScope: Record<string, unknown>;
    permissionSnapshot: string[];
    filters: Record<string, unknown>;
    executionMode: "SYNCHRONOUS_SUMMARY" | "ASYNCHRONOUS_REPORT" | "ASYNCHRONOUS_EXPORT";
    outputFormat: ReportExportFormat;
  }) {
    const definition = REPORT_DEFINITIONS[input.definitionKey];
    if (!definition) {
      throw new ReportingError("REPORT_DEFINITION_NOT_FOUND", 404, `Unknown report definition: ${input.definitionKey}`);
    }

    const filterHash = computeFilterHash(input.filters);
    const requestHash = computeRequestHash(input.definitionKey, input.requesterUserId, filterHash, input.outputFormat);

    // Check for recent completed identical job within 5 minutes for idempotency
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingJob = await db.reportJob.findFirst({
      where: {
        requestHash,
        requesterUserId: input.requesterUserId,
        status: "COMPLETED",
        createdAt: { gte: fiveMinsAgo },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existingJob) {
      return existingJob;
    }

    const publicReference = `REP-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const expiresAt = new Date(Date.now() + definition.retentionDays * 86400 * 1000);

    const job = await db.reportJob.create({
      data: {
        publicReference,
        definitionKey: input.definitionKey,
        definitionVersion: definition.version,
        requesterUserId: input.requesterUserId,
        requesterRole: input.requesterRole,
        ownerScope: input.ownerScope as any,
        permissionSnapshot: input.permissionSnapshot as any,
        normalizedFilters: input.filters as any,
        filterHash,
        executionMode: input.executionMode,
        outputFormat: input.outputFormat,
        rowCountLimit: definition.maximumRowCount,
        status: input.executionMode === "SYNCHRONOUS_SUMMARY" ? "RUNNING" : "QUEUED",
        requestHash,
        expiresAt,
      },
    });

    // If synchronous, execute inline immediately
    if (input.executionMode === "SYNCHRONOUS_SUMMARY") {
      await this.processJob(job.publicReference);
      return db.reportJob.findUnique({ where: { id: job.id } });
    }

    return job;
  }

  async processJob(publicReference: string) {
    const job = await db.reportJob.findUnique({ where: { publicReference } });
    if (!job) {
      throw new ReportingError("REPORT_JOB_NOT_FOUND", 404, `Job ${publicReference} not found`);
    }

    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(job.status)) {
      return job;
    }

    await db.reportJob.update({
      where: { id: job.id },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    try {
      const queryContext: ReportQueryContext = {
        definitionKey: job.definitionKey,
        requesterUserId: job.requesterUserId,
        requesterRole: job.requesterRole,
        ownerScope: job.ownerScope as any,
        filters: job.normalizedFilters as any,
        limit: job.rowCountLimit,
      };

      const data = await generateReportData(queryContext);

      // Generate content based on format
      let contentString: string;
      let contentType: string;

      if (job.outputFormat === "JSON") {
        contentString = formatJsonReport(data.rows);
        contentType = "application/json";
      } else {
        contentString = formatCsvReport(data.headers, data.rows);
        contentType = "text/csv";
      }

      ensureStorageDirExists();
      const storageKey = `report_${job.publicReference}.${job.outputFormat.toLowerCase()}`;
      const filePath = path.join(ARTIFACT_STORAGE_DIR, storageKey);
      fs.writeFileSync(filePath, contentString, "utf8");

      const checksum = crypto.createHash("sha256").update(contentString).digest("hex");
      const byteSize = Buffer.byteLength(contentString, "utf8");
      const artifactExpiresAt = job.expiresAt || new Date(Date.now() + 30 * 86400 * 1000);

      const artifactRef = `ART-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

      await db.reportExportArtifact.create({
        data: {
          publicReference: artifactRef,
          jobId: job.id,
          format: job.outputFormat,
          storageProvider: "LOCAL_SECURE",
          storageKey,
          contentType,
          byteSize,
          checksum,
          expiresAt: artifactExpiresAt,
        },
      });

      await db.reportJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          rowCount: data.rows.length,
          completedAt: new Date(),
        },
      });

      return db.reportJob.findUnique({ where: { id: job.id } });
    } catch (err: any) {
      await db.reportJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED_PERMANENT",
          errorMessage: err.message || "Failed to generate report",
          failedAt: new Date(),
        },
      });
      throw err;
    }
  }

  async cancelJob(publicReference: string, requesterUserId: string, isAdmin = false) {
    const job = await db.reportJob.findUnique({ where: { publicReference } });
    if (!job) throw new ReportingError("REPORT_JOB_NOT_FOUND", 404, "Report job not found.");

    if (!isAdmin && job.requesterUserId !== requesterUserId) {
      throw new ReportingError("FORBIDDEN", 403, "You do not own this report job.");
    }

    if (job.status === "COMPLETED") {
      throw new ReportingError("CANNOT_CANCEL_COMPLETED", 400, "Completed report jobs cannot be cancelled.");
    }

    return db.reportJob.update({
      where: { id: job.id },
      data: { status: "CANCELLED" },
    });
  }

  async retryJob(publicReference: string, requesterUserId: string, isAdmin = false) {
    const job = await db.reportJob.findUnique({ where: { publicReference } });
    if (!job) throw new ReportingError("REPORT_JOB_NOT_FOUND", 404, "Report job not found.");

    if (!isAdmin && job.requesterUserId !== requesterUserId) {
      throw new ReportingError("FORBIDDEN", 403, "You do not own this report job.");
    }

    await db.reportJob.update({
      where: { id: job.id },
      data: { status: "QUEUED", errorMessage: null },
    });

    return this.processJob(publicReference);
  }
}

export class ReportDownloadService {
  generateDownloadToken(artifactId: string, userId: string, role: string, ttlSeconds = 900): string {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const payload = `${artifactId}:${userId}:${role}:${expiresAt}`;
    const hmac = crypto.createHmac("sha256", DOWNLOAD_SECRET_KEY).update(payload).digest("hex");
    return Buffer.from(`${payload}:${hmac}`).toString("base64url");
  }

  verifyDownloadToken(token: string) {
    try {
      const decoded = Buffer.from(token, "base64url").toString("utf8");
      const parts = decoded.split(":");
      if (parts.length !== 5) throw new Error("Invalid token structure");

      const [artifactId, userId, role, expiresAtStr, hmac] = parts;
      const expiresAt = parseInt(expiresAtStr!, 10);

      if (Date.now() / 1000 > expiresAt) {
        throw new ReportingError("DOWNLOAD_TOKEN_EXPIRED", 410, "Download link has expired.");
      }

      const expectedPayload = `${artifactId}:${userId}:${role}:${expiresAt}`;
      const expectedHmac = crypto.createHmac("sha256", DOWNLOAD_SECRET_KEY).update(expectedPayload).digest("hex");

      if (!crypto.timingSafeEqual(Buffer.from(hmac!), Buffer.from(expectedHmac))) {
        throw new ReportingError("INVALID_DOWNLOAD_TOKEN", 403, "Invalid download signature.");
      }

      return { artifactId: artifactId!, userId: userId!, role: role! };
    } catch (err: any) {
      if (err instanceof ReportingError) throw err;
      throw new ReportingError("INVALID_DOWNLOAD_TOKEN", 403, "Invalid download token.");
    }
  }

  async getArtifactFile(artifactId: string, userId: string, role: string, ipAddress?: string, userAgent?: string) {
    const artifact = await db.reportExportArtifact.findUnique({
      where: { id: artifactId },
    });

    if (!artifact) throw new ReportingError("ARTIFACT_NOT_FOUND", 404, "Export artifact not found.");

    if (new Date() > artifact.expiresAt) {
      throw new ReportingError("ARTIFACT_EXPIRED", 410, "Export artifact has expired.");
    }

    const filePath = path.join(ARTIFACT_STORAGE_DIR, artifact.storageKey);
    if (!fs.existsSync(filePath)) {
      throw new ReportingError("FILE_NOT_FOUND", 404, "Artifact file is missing from storage.");
    }

    // Record audit
    const downloadTokenHash = crypto.createHash("sha256").update(`${artifactId}:${userId}:${Date.now()}`).digest("hex");
    const publicReference = `AUD-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    await db.reportDownloadAudit.create({
      data: {
        publicReference,
        artifactId: artifact.id,
        downloadTokenHash,
        authenticatedUserId: userId,
        authenticatedRole: role,
        ipAddress,
        userAgent,
      },
    });

    await db.reportExportArtifact.update({
      where: { id: artifact.id },
      data: { downloadCount: { increment: 1 } },
    });

    const content = fs.readFileSync(filePath, "utf8");
    return {
      content,
      contentType: artifact.contentType,
      filename: artifact.storageKey,
    };
  }
}
