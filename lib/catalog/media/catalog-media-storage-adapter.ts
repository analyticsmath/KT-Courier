import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CatalogPolicyError } from "@/lib/catalog/errors";

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
  readonly code = "LOCAL_CATALOG_MEDIA";
  readonly productionReady = false;
  private readonly root: string;

  constructor(root = process.env.CATALOG_MEDIA_LOCAL_DIR ?? path.join(process.cwd(), "var", "catalog-media")) {
    this.root = path.resolve(root);
  }

  private resolve(key: string): string {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(`${this.root}${path.sep}`)) {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog media storage key escapes root.");
    }
    return target;
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
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Media object exceeds upload limit.", 413);
    }
    const target = this.resolve(input.storageKey);
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, input.bytes);
      return { byteSize: input.bytes.byteLength };
    } catch {
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Failed to persist local catalog media.");
    }
  }

  async openForValidation(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<Uint8Array> {
    try {
      const bytes = await readFile(this.resolve(input.storageKey));
      if (bytes.byteLength > input.maximumBytes) {
        throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Stored catalog media exceeds limit.", 413);
      }
      return new Uint8Array(bytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_MISSING", "Catalog media object not found.", 404);
      }
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Could not read local catalog media.");
    }
  }

  async deleteUncommittedObject(input: Readonly<{ storageKey: string }>): Promise<{ deleted: boolean }> {
    try {
      await rm(this.resolve(input.storageKey), { force: true });
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

type S3Config = Readonly<{ endpoint: URL; bucket: string; region: string; accessKeyId: string; secretAccessKey: string }>;

function configuredS3(): S3Config | null {
  const endpoint = process.env.CATALOG_MEDIA_S3_ENDPOINT ?? process.env.PRIVATE_MEDIA_S3_ENDPOINT;
  const bucket = process.env.CATALOG_MEDIA_S3_BUCKET ?? process.env.PRIVATE_MEDIA_S3_BUCKET;
  const region = process.env.CATALOG_MEDIA_S3_REGION ?? process.env.PRIVATE_MEDIA_S3_REGION;
  const accessKeyId = process.env.CATALOG_MEDIA_S3_ACCESS_KEY_ID ?? process.env.PRIVATE_MEDIA_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CATALOG_MEDIA_S3_SECRET_ACCESS_KEY ?? process.env.PRIVATE_MEDIA_S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !region || !accessKeyId || !secretAccessKey) return null;
  try {
    return { endpoint: new URL(endpoint), bucket, region, accessKeyId, secretAccessKey };
  } catch {
    return null;
  }
}

function hmac(key: string | Buffer, value: string): Buffer { return createHmac("sha256", key).update(value, "utf8").digest(); }
function sha256(value: string | Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }
function awsDate(now: Date): { stamp: string; timestamp: string } {
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { stamp: timestamp.slice(0, 8), timestamp };
}

export class S3CatalogMediaStorageAdapter implements CatalogMediaStorageAdapter {
  readonly code = "S3_CATALOG_MEDIA";
  readonly productionReady = true;
  constructor(private readonly config: S3Config) {}

  private async request(method: "GET" | "PUT" | "DELETE", key: string, body?: Uint8Array): Promise<Response> {
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    const base = this.config.endpoint.pathname.replace(/\/$/, "");
    const canonicalUri = `${base}/${encodeURIComponent(this.config.bucket)}/${encodedKey}`.replace(/\/+/g, "/");
    const url = new URL(this.config.endpoint.toString());
    url.pathname = canonicalUri;
    const payloadHash = sha256(body ?? new Uint8Array());
    const { stamp, timestamp } = awsDate(new Date());
    const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${timestamp}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const credentialScope = `${stamp}/${this.config.region}/s3/aws4_request`;
    const canonicalRequest = `${method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const stringToSign = `AWS4-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${sha256(canonicalRequest)}`;
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${this.config.secretAccessKey}`, stamp), this.config.region), "s3"), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
    const headers = {
      authorization: `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": timestamp,
    };
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(url, { method, headers, body: body ? Buffer.from(body) : undefined, signal: AbortSignal.timeout(10_000) });
        if (response.status < 500 || attempt === 2) return response;
      } catch {
        if (attempt === 2) throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog object storage is unavailable.");
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
    throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog object storage is unavailable.");
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
      throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Media object exceeds upload limit.", 413);
    }
    const response = await this.request("PUT", input.storageKey, input.bytes);
    if (!response.ok) throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog object storage rejected the upload.");
    return { byteSize: input.bytes.byteLength };
  }

  async openForValidation(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<Uint8Array> {
    const response = await this.request("GET", input.storageKey);
    if (response.status === 404) throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_MISSING", "Catalog media object is unavailable.", 404);
    if (!response.ok) throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Catalog object storage could not retrieve the object.");
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > input.maximumBytes) throw new CatalogMediaStorageError("CATALOG_MEDIA_STORAGE_FAILURE", "Stored catalog media exceeds validation limit.", 413);
    return body;
  }

  async deleteUncommittedObject(input: Readonly<{ storageKey: string }>): Promise<{ deleted: boolean }> {
    const response = await this.request("DELETE", input.storageKey);
    return { deleted: response.ok || response.status === 404 };
  }

  async createReadTarget(input: Readonly<{ storageKey: string; maximumBytes: number }>): Promise<CatalogMediaReadTarget> {
    const body = await this.openForValidation(input);
    return { body, byteSize: body.byteLength };
  }
}

export function createProductionCatalogMediaStorageAdapter(): CatalogMediaStorageAdapter {
  const mode = (process.env.CATALOG_MEDIA_STORAGE ?? process.env.PRIVATE_MEDIA_STORAGE)?.trim().toLowerCase();
  const s3 = configuredS3();
  if (mode === "s3" && s3) return new S3CatalogMediaStorageAdapter(s3);
  if (process.env.NODE_ENV !== "production" && (mode === "local" || !mode)) return new LocalCatalogMediaStorageAdapter();
  return new LockedCatalogMediaStorageAdapter();
}
