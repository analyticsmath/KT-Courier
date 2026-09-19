import { createHash, createHmac } from "node:crypto";
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
    const rawRoot = rootDir ?? env.CATALOG_MEDIA_LOCAL_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), "var", "catalog-media");
    this.rootDir = path.resolve(/*turbopackIgnore: true*/ rawRoot);

    const publicDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), "public");
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


type CatalogS3Config = Readonly<{
  endpoint: URL;
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}>;

function configuredCatalogS3(env: Record<string, string | undefined>): CatalogS3Config | null {
  const endpoint = env.CATALOG_MEDIA_S3_ENDPOINT;
  const bucket = env.CATALOG_MEDIA_S3_BUCKET;
  const region = env.CATALOG_MEDIA_S3_REGION;
  const accessKeyId = env.CATALOG_MEDIA_S3_ACCESS_KEY_ID;
  const secretAccessKey = env.CATALOG_MEDIA_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !region || !accessKeyId || !secretAccessKey) return null;
  try {
    return { endpoint: new URL(endpoint), bucket, region, accessKeyId, secretAccessKey };
  } catch {
    return null;
  }
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function awsDate(now: Date): { stamp: string; timestamp: string } {
  const timestamp = now.toISOString().replace(/[:-]|\\.\\d{3}/g, "");
  return { stamp: timestamp.slice(0, 8), timestamp };
}

/**
 * Server-side S3-compatible catalog storage adapter.
 * Browser clients never receive bucket credentials or raw object keys.
 */
export class S3CatalogMediaStorageAdapter implements CatalogMediaStorageAdapter {
  readonly code = "S3_COMPATIBLE_CATALOG";
  readonly productionReady = true;

  constructor(private readonly config: CatalogS3Config) {}

  private sanitizeKey(rawKey: string): string {
    if (!rawKey || typeof rawKey !== "string" || rawKey.includes("\\0") || rawKey.includes("..")) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Invalid catalog storage key.", 400);
    }
    if (rawKey.startsWith("/") || /^[a-zA-Z]:/.test(rawKey)) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Absolute catalog storage keys are forbidden.", 400);
    }
    return rawKey.replace(/\\\\/g, "/").replace(/^\\/+/, "");
  }

  private async request(method: "GET" | "PUT" | "DELETE", rawKey: string, body?: Uint8Array): Promise<Response> {
    const key = this.sanitizeKey(rawKey);
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const base = this.config.endpoint.pathname.replace(/\\/$/, "");
    const canonicalUri = `${base}/${encodeURIComponent(this.config.bucket)}/${encodedKey}`.replace(/\\/+/g, "/");
    const url = new URL(this.config.endpoint.toString());
    url.pathname = canonicalUri;

    const payloadHash = sha256(body ?? new Uint8Array());
    const { stamp, timestamp } = awsDate(new Date());
    const canonicalHeaders = `host:${url.host}\\nx-amz-content-sha256:${payloadHash}\\nx-amz-date:${timestamp}\\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const credentialScope = `${stamp}/${this.config.region}/s3/aws4_request`;
    const canonicalRequest = `${method}\\n${canonicalUri}\\n\\n${canonicalHeaders}\\n${signedHeaders}\\n${payloadHash}`;
    const stringToSign = `AWS4-HMAC-SHA256\\n${timestamp}\\n${credentialScope}\\n${sha256(canonicalRequest)}`;
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${this.config.secretAccessKey}`, stamp), this.config.region), "s3"), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
    const headers = {
      authorization: `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": timestamp,
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? Buffer.from(body) : undefined,
          signal: AbortSignal.timeout(20_000),
        });
        if (response.status < 500 || attempt === 2) return response;
      } catch {
        if (attempt === 2) {
          throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog object storage is unavailable.");
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }

    throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog object storage is unavailable.");
  }

  async createUploadTarget(input: Readonly<{ intentReference: string; storageKey: string; maximumBytes: number; expiresAt: Date }>): Promise<CatalogMediaUploadTarget> {
    void input.storageKey;
    void input.maximumBytes;
    return Object.freeze({
      mode: "APPLICATION",
      uploadPath: `/api/store/catalog/media/uploads/${encodeURIComponent(input.intentReference)}/content`,
      expiresAt: input.expiresAt.toISOString(),
      requiredHeaders: Object.freeze({ "content-type": "application/octet-stream" }),
    });
  }

  async confirmUpload(input: Readonly<{ storageKey: string; bytes: Uint8Array; maximumBytes: number }>): Promise<{ byteSize: number }> {
    if (input.bytes.byteLength < 1 || input.bytes.byteLength > input.maximumBytes) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog media exceeds its upload target.", 413);
    }
    const response = await this.request("PUT", input.storageKey, input.bytes);
    if (!response.ok) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog object storage rejected the upload.");
    }
    return { byteSize: input.bytes.byteLength };
  }

  async openForValidation(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<Uint8Array> {
    const response = await this.request("GET", input.storageKey);
    if (response.status === 404) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_MISSING", "Catalog media object is unavailable.", 404);
    }
    if (!response.ok) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog object storage could not retrieve the object.");
    }
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > input.maximumBytes) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Stored catalog media exceeds its validation limit.", 413);
    }
    return body;
  }

  async deleteUncommittedObject(input: Readonly<{ storageKey: string }>): Promise<{ deleted: boolean }> {
    const response = await this.request("DELETE", input.storageKey);
    if (!response.ok && response.status !== 404) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog object storage could not delete the object.");
    }
    return { deleted: response.status !== 404 };
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
  const mode = env.CATALOG_MEDIA_STORAGE?.trim().toLowerCase();
  const s3 = configuredCatalogS3(env);
  if ((mode === "s3" || mode === "s3-compatible") && s3) {
    return new S3CatalogMediaStorageAdapter(s3);
  }
  if (isLocalCatalogMediaStorageEnabled(env)) {
    return new LocalCatalogMediaStorageAdapter();
  }
  return new LockedCatalogMediaStorageAdapter();
}

export function createCatalogMediaStorageAdapter(): CatalogMediaStorageAdapter {
  return createProductionCatalogMediaStorageAdapter();
}


