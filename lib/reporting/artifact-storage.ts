import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ReportingError, type ReportExportFormat } from "./contracts";

const STORAGE_KEY_PATTERN = /^reports\/[A-Z0-9-]+\/[a-f0-9]{64}\.(csv|json)$/;

export interface ReportArtifactStorage {
  readonly provider: "LOCAL_SECURE";
  readonly root: string;
  createStorageKey(reference: string, format: ReportExportFormat, content: string): string;
  store(storageKey: string, content: string): Promise<void>;
  open(storageKey: string): Promise<Buffer>;
  exists(storageKey: string): Promise<boolean>;
  delete(storageKey: string): Promise<boolean>;
}

function extensionFor(format: ReportExportFormat): "csv" | "json" {
  if (format === "CSV") return "csv";
  if (format === "JSON") return "json";
  throw new ReportingError("REPORT_FORMAT_UNAVAILABLE", 422, "The requested report format is not available.");
}

function normalizeReference(reference: string): string {
  const normalized = reference.trim().toUpperCase();
  if (!/^REP-[A-Z0-9-]{8,120}$/.test(normalized)) {
    throw new ReportingError("INVALID_ARTIFACT_REFERENCE", 400, "Invalid report artifact reference.");
  }
  return normalized;
}

export class LocalSecureReportArtifactStorage implements ReportArtifactStorage {
  readonly provider = "LOCAL_SECURE" as const;
  readonly root: string;

  constructor(root = process.env.REPORT_ARTIFACT_DIR || path.join(process.cwd(), "artifacts", "reports")) {
    this.root = path.resolve(root);
  }

  createStorageKey(reference: string, format: ReportExportFormat, content: string): string {
    const safeReference = normalizeReference(reference);
    const digest = crypto.createHash("sha256").update(content).digest("hex");
    return `reports/${safeReference}/${digest}.${extensionFor(format)}`;
  }

  async store(storageKey: string, content: string): Promise<void> {
    const target = this.resolve(storageKey);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, { encoding: "utf8", flag: "wx" }).catch(async (error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
      const existing = await fs.readFile(target, "utf8");
      if (existing !== content) throw new ReportingError("ARTIFACT_STORAGE_CONFLICT", 409, "Report artifact storage conflict.");
    });
  }

  async open(storageKey: string): Promise<Buffer> {
    const target = this.resolve(storageKey);
    try {
      return await fs.readFile(target);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new ReportingError("ARTIFACT_NOT_AVAILABLE", 404, "Report artifact is unavailable.");
      }
      throw new ReportingError("ARTIFACT_STORAGE_FAILURE", 503, "Report artifact storage is unavailable.");
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    const target = this.resolve(storageKey);
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  async delete(storageKey: string): Promise<boolean> {
    const target = this.resolve(storageKey);
    try {
      await fs.unlink(target);
      return true;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw new ReportingError("ARTIFACT_STORAGE_FAILURE", 503, "Report artifact storage is unavailable.");
    }
  }

  private resolve(storageKey: string): string {
    if (!STORAGE_KEY_PATTERN.test(storageKey) || path.isAbsolute(storageKey)) {
      throw new ReportingError("INVALID_ARTIFACT_STORAGE_KEY", 400, "Invalid report artifact storage key.");
    }

    const target = path.resolve(this.root, ...storageKey.split("/"));
    const relative = path.relative(this.root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new ReportingError("INVALID_ARTIFACT_STORAGE_KEY", 400, "Invalid report artifact storage key.");
    }
    return target;
  }
}

let defaultStorage: ReportArtifactStorage | undefined;

export function getReportArtifactStorage(): ReportArtifactStorage {
  defaultStorage ??= new LocalSecureReportArtifactStorage();
  return defaultStorage;
}
