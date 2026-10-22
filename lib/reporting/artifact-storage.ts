import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ReportingError, type ReportExportFormat } from "./contracts";
import { CloudinaryImageStorage, CloudinaryImageStorageError, cloudinaryImageConfig } from "../media/cloudinary-image-storage";

const STORAGE_KEY_PATTERN = /^reports\/[A-Z0-9-]+\/[a-f0-9]{64}\.(csv|json)$/;

export interface ReportArtifactStorage {
  readonly provider: "LOCAL_SECURE" | "CLOUDINARY_AUTHENTICATED_RAW";
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

export class CloudinaryReportArtifactStorage implements ReportArtifactStorage {
  readonly provider = "CLOUDINARY_AUTHENTICATED_RAW" as const;
  readonly root = "cloudinary://authenticated-reports";
  private readonly keys = new LocalSecureReportArtifactStorage();
  constructor(private readonly storage: CloudinaryImageStorage) {}
  createStorageKey(reference: string, format: ReportExportFormat, content: string) { return this.keys.createStorageKey(reference, format, content); }
  private assertContent(key: string, bytes: Uint8Array) {
    if (!STORAGE_KEY_PATTERN.test(key) || key.split("/")[2].split(".")[0] !== crypto.createHash("sha256").update(bytes).digest("hex")) throw new ReportingError("ARTIFACT_STORAGE_CONFLICT", 409, "Report artifact identity does not match its content.");
  }
  async store(key: string, content: string) {
    const bytes = Buffer.from(content, "utf8"); this.assertContent(key, bytes);
    try { await this.storage.write(key, bytes, 10 * 1024 * 1024); }
    catch { throw new ReportingError("ARTIFACT_STORAGE_FAILURE", 503, "Private report storage is unavailable."); }
  }
  async open(key: string): Promise<Buffer> {
    if (!STORAGE_KEY_PATTERN.test(key)) throw new ReportingError("INVALID_ARTIFACT_STORAGE_KEY", 400, "Invalid report artifact storage key.");
    try { const bytes = Buffer.from(await this.storage.read(key, 10 * 1024 * 1024)); this.assertContent(key, bytes); return bytes; }
    catch (error) {
      if (error instanceof ReportingError) throw error;
      throw new ReportingError(error instanceof CloudinaryImageStorageError && error.code === "MISSING" ? "ARTIFACT_NOT_AVAILABLE" : "ARTIFACT_STORAGE_FAILURE", error instanceof CloudinaryImageStorageError && error.code === "MISSING" ? 404 : 503, "Private report artifact is unavailable.");
    }
  }
  async exists(key: string) {
    try { await this.open(key); return true; } catch (error) { if (error instanceof ReportingError && error.code === "ARTIFACT_NOT_AVAILABLE") return false; throw error; }
  }
  async delete(key: string) {
    if (!STORAGE_KEY_PATTERN.test(key)) throw new ReportingError("INVALID_ARTIFACT_STORAGE_KEY", 400, "Invalid report artifact storage key.");
    try { return await this.storage.delete(key); } catch { throw new ReportingError("ARTIFACT_STORAGE_FAILURE", 503, "Private report storage is unavailable."); }
  }
}

export function getReportArtifactStorage(): ReportArtifactStorage {
  if (!defaultStorage && process.env.REPORT_ARTIFACT_STORAGE === "cloudinary") {
    const config = cloudinaryImageConfig();
    if (!config) throw new ReportingError("ARTIFACT_STORAGE_FAILURE", 503, "Private report storage is not configured.");
    defaultStorage = new CloudinaryReportArtifactStorage(new CloudinaryImageStorage(config, fetch, "raw"));
  }
  defaultStorage ??= new LocalSecureReportArtifactStorage();
  return defaultStorage;
}
