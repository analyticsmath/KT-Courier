import * as fs from "node:fs";
import * as path from "node:path";
import { CatalogPolicyError } from "@/lib/catalog/errors";
import { isDemoMediaDeliveryAllowed } from "@/lib/runtime/deployment-classification";

export type CatalogMediaUploadTarget = Readonly<{
  mode: "APPLICATION";
  uploadPath: string;
  expiresAt: string;
  requiredHeaders: Readonly<Record<string, string>>;
}>;

export type CatalogMediaReadTarget = Readonly<{
  body: Uint8Array;
  byteSize: number;
}>;

export interface CatalogMediaStorageAdapter {
  readonly code: string;
  readonly productionReady: boolean;
  createUploadTarget(input: Readonly<{ intentReference: string; storageKey: string; maximumBytes: number; expiresAt: Date }>): Promise<CatalogMediaUploadTarget>;
  confirmUpload(input: Readonly<{ storageKey: string; bytes: Uint8Array; maximumBytes: number }>): Promise<{ byteSize: number }>;
  openForValidation(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<Uint8Array>;
  deleteUncommittedObject(input: Readonly<{ storageKey: string }>): Promise<{ deleted: boolean }>;
  createReadTarget(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<CatalogMediaReadTarget>;
}

export class CatalogMediaStorageError extends CatalogPolicyError {
  constructor(code: "CATALOG_MEDIA_STORAGE_NOT_READY" | "CATALOG_MEDIA_STORAGE_MISSING" | "CATALOG_MEDIA_STORAGE_FAILURE", message: string, status = 503) {
    super(code, message, status);
  }
}

export class LockedCatalogMediaStorageAdapter implements CatalogMediaStorageAdapter {
  readonly code = "UNCONFIGURED";
  readonly productionReady = false;

  private unavailable(): never {
    throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_NOT_READY", "Catalog media storage is not configured for production.");
  }

  async createUploadTarget(): Promise<CatalogMediaUploadTarget> { return this.unavailable(); }
  async confirmUpload(): Promise<{ byteSize: number }> { return this.unavailable(); }
  async openForValidation(): Promise<Uint8Array> { return this.unavailable(); }
  async deleteUncommittedObject(): Promise<{ deleted: boolean }> { return this.unavailable(); }
  async createReadTarget(): Promise<CatalogMediaReadTarget> { return this.unavailable(); }
}

export class LocalCatalogMediaStorageAdapter implements CatalogMediaStorageAdapter {
  readonly code = "LOCAL_FILESYSTEM";
  readonly productionReady = false;
  readonly rootDir: string;

  constructor(rootDir?: string) {
    const env = process["env"];
    const rawRoot = rootDir ?? env.CATALOG_MEDIA_LOCAL_DIR ?? path.join(process.cwd(), "var", "catalog-media");
    this.rootDir = path.resolve(rawRoot);

    const publicDir = path.resolve(process.cwd(), "public");
    const relToPublic = path.relative(publicDir, this.rootDir);
    if (this.rootDir === publicDir || (!relToPublic.startsWith("..") && !path.isAbsolute(relToPublic))) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog media directory must not be located inside the public directory.", 500);
    }
  }

  private sanitizeKey(rawKey: string): string {
    if (!rawKey || typeof rawKey !== "string") {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Invalid storage key.", 400);
    }
    if (rawKey.includes("\0") || rawKey.includes("..")) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Directory traversal is forbidden.", 400);
    }
    if (path.isAbsolute(rawKey) || /^[a-zA-Z]:/.test(rawKey)) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Absolute storage keys are forbidden.", 400);
    }
    return rawKey.replace(/\\/g, "/").replace(/^\/+/, "");
  }

  private resolveSafeCandidate(subPath: string): string {
    const resolved = path.resolve(this.rootDir, subPath);
    const rel = path.relative(this.rootDir, resolved);
    if (rel.startsWith("..") || path.isAbsolute(rel)) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Directory traversal detected.", 400);
    }
    return resolved;
  }

  private resolveExistingPath(storageKey: string): string | null {
    const clean = this.sanitizeKey(storageKey);
    const candidates: string[] = [];

    if (clean.startsWith("catalog-media/")) {
      const stripped = clean.slice("catalog-media/".length);
      candidates.push(this.resolveSafeCandidate(stripped));
      candidates.push(this.resolveSafeCandidate(stripped + ".webp"));
    }

    candidates.push(this.resolveSafeCandidate(clean));
    candidates.push(this.resolveSafeCandidate(clean + ".webp"));

    if (!clean.startsWith("catalog-media/")) {
      candidates.push(this.resolveSafeCandidate(`catalog-media/${clean}`));
      candidates.push(this.resolveSafeCandidate(`catalog-media/${clean}.webp`));
    }

    for (const cand of candidates) {
      try {
        if (fs.existsSync(cand)) {
          const stat = fs.statSync(cand);
          if (stat.isFile()) return cand;
        }
      } catch {
        // Ignore filesystem check errors
      }
    }
    return null;
  }

  private resolveSafePathForWrite(storageKey: string): string {
    const clean = this.sanitizeKey(storageKey);
    const effective = clean.startsWith("catalog-media/") ? clean.slice("catalog-media/".length) : clean;
    return this.resolveSafeCandidate(effective);
  }

  async createUploadTarget(input: Readonly<{ intentReference: string; storageKey: string; maximumBytes: number; expiresAt: Date }>): Promise<CatalogMediaUploadTarget> {
    return Object.freeze({
      mode: "APPLICATION",
      uploadPath: `/api/store/catalog/media/uploads/${encodeURIComponent(input.intentReference)}/content`,
      expiresAt: input.expiresAt.toISOString(),
      requiredHeaders: Object.freeze({ "content-type": "application/octet-stream" }),
    });
  }

  async confirmUpload(input: Readonly<{ storageKey: string; bytes: Uint8Array; maximumBytes: number }>): Promise<{ byteSize: number }> {
    if (input.bytes.byteLength < 1 || input.bytes.byteLength > input.maximumBytes) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Injected media object exceeds its upload target.", 413);
    }
    const filePath = this.resolveSafePathForWrite(input.storageKey);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, Buffer.from(input.bytes));
    return { byteSize: input.bytes.byteLength };
  }

  async openForValidation(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<Uint8Array> {
    const filePath = this.resolveExistingPath(input.storageKey);
    if (!filePath) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_MISSING", "Uploaded catalog media bytes are missing.", 409);
    }
    const stats = await fs.promises.stat(filePath);
    if (stats.size > input.maximumBytes) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Stored catalog media exceeds its validation limit.", 413);
    }
    const buffer = await fs.promises.readFile(filePath);
    return new Uint8Array(buffer);
  }

  async deleteUncommittedObject(input: Readonly<{ storageKey: string }>): Promise<{ deleted: boolean }> {
    const filePath = this.resolveExistingPath(input.storageKey);
    if (!filePath) return { deleted: false };
    try {
      await fs.promises.unlink(filePath);
      return { deleted: true };
    } catch {
      return { deleted: false };
    }
  }

  async createReadTarget(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<CatalogMediaReadTarget> {
    const body = await this.openForValidation(input);
    return { body, byteSize: body.byteLength };
  }
}

export function isLocalCatalogMediaStorageEnabled(env: Record<string, string | undefined> = process["env"]): boolean {
  return isDemoMediaDeliveryAllowed(env);
}

export function createProductionCatalogMediaStorageAdapter(env: Record<string, string | undefined> = process["env"]): CatalogMediaStorageAdapter {
  if (isLocalCatalogMediaStorageEnabled(env)) {
    return new LocalCatalogMediaStorageAdapter();
  }
  return new LockedCatalogMediaStorageAdapter();
}

export function createCatalogMediaStorageAdapter(): CatalogMediaStorageAdapter {
  return createProductionCatalogMediaStorageAdapter();
}


