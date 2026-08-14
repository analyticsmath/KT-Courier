import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export class PrivateMediaStorageError extends Error {
  constructor(
    public readonly code: "PRIVATE_MEDIA_STORAGE_NOT_CONFIGURED" | "PRIVATE_MEDIA_STORAGE_FAILURE" | "PRIVATE_MEDIA_STORAGE_MISSING",
    message: string,
  ) {
    super(message);
    this.name = "PrivateMediaStorageError";
  }
}

export interface PrivateMediaStorageAdapter {
  readonly code: string;
  write(input: Readonly<{ key: string; bytes: Uint8Array; mimeType: string }>): Promise<void>;
  read(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}

function validKey(key: string): boolean {
  return /^private-media\/[a-f0-9-]{36}$/.test(key);
}

export class LocalPrivateMediaStorageAdapter implements PrivateMediaStorageAdapter {
  readonly code = "LOCAL_PRIVATE";
  private readonly root: string;

  constructor(root = process.env.PRIVATE_MEDIA_LOCAL_DIR ?? path.join(process.cwd(), "var", "private-media")) {
    this.root = path.resolve(root);
    if (this.root === path.resolve(process.cwd(), "public") || this.root.startsWith(`${path.resolve(process.cwd(), "public")}${path.sep}`)) {
      throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_NOT_CONFIGURED", "Private media may not use the public static directory.");
    }
  }

  private resolve(key: string): string {
    if (!validKey(key)) throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Invalid private storage key.");
    const target = path.resolve(this.root, key);
    if (!target.startsWith(`${this.root}${path.sep}`)) throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Private storage key escapes its configured root.");
    return target;
  }

  async write(input: Readonly<{ key: string; bytes: Uint8Array }>): Promise<void> {
    const target = this.resolve(input.key);
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, input.bytes, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return;
      throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Private media storage could not persist the upload.");
    }
  }

  async read(key: string): Promise<Uint8Array> {
    try {
      return await readFile(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_MISSING", "Private media object is unavailable.");
      throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Private media storage could not read the object.");
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await rm(this.resolve(key), { force: true });
    } catch {
      throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Private media storage could not delete the object.");
    }
  }
}

type S3Config = Readonly<{ endpoint: URL; bucket: string; region: string; accessKeyId: string; secretAccessKey: string }>;

function configuredS3(): S3Config | null {
  const endpoint = process.env.PRIVATE_MEDIA_S3_ENDPOINT;
  const bucket = process.env.PRIVATE_MEDIA_S3_BUCKET;
  const region = process.env.PRIVATE_MEDIA_S3_REGION;
  const accessKeyId = process.env.PRIVATE_MEDIA_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.PRIVATE_MEDIA_S3_SECRET_ACCESS_KEY;
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

/** A credential-only S3-compatible adapter. It keeps all object operations server-side. */
export class S3PrivateMediaStorageAdapter implements PrivateMediaStorageAdapter {
  readonly code = "S3_COMPATIBLE_PRIVATE";
  constructor(private readonly config: S3Config) {}

  private async request(method: "GET" | "PUT" | "DELETE", key: string, body?: Uint8Array): Promise<Response> {
    if (!validKey(key)) throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Invalid private storage key.");
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
        if (attempt === 2) throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Private object storage is unavailable.");
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
    throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Private object storage is unavailable.");
  }

  async write(input: Readonly<{ key: string; bytes: Uint8Array; mimeType: string }>): Promise<void> {
    const response = await this.request("PUT", input.key, input.bytes);
    if (!response.ok) throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Private object storage rejected the upload.");
  }

  async read(key: string): Promise<Uint8Array> {
    const response = await this.request("GET", key);
    if (response.status === 404) throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_MISSING", "Private media object is unavailable.");
    if (!response.ok) throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Private object storage could not retrieve the object.");
    return new Uint8Array(await response.arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    const response = await this.request("DELETE", key);
    if (!response.ok && response.status !== 404) throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_FAILURE", "Private object storage could not delete the object.");
  }
}

export class LockedPrivateMediaStorageAdapter implements PrivateMediaStorageAdapter {
  readonly code = "UNCONFIGURED";
  private unavailable(): never { throw new PrivateMediaStorageError("PRIVATE_MEDIA_STORAGE_NOT_CONFIGURED", "Private media storage is not configured."); }
  async write(): Promise<void> { return this.unavailable(); }
  async read(): Promise<Uint8Array> { return this.unavailable(); }
  async delete(): Promise<void> { return this.unavailable(); }
}

export function createPrivateMediaStorageAdapter(): PrivateMediaStorageAdapter {
  const mode = process.env.PRIVATE_MEDIA_STORAGE?.trim().toLowerCase();
  const s3 = configuredS3();
  if (mode === "s3" && s3) return new S3PrivateMediaStorageAdapter(s3);
  if (process.env.NODE_ENV !== "production" && (mode === "local" || !mode)) return new LocalPrivateMediaStorageAdapter();
  return new LockedPrivateMediaStorageAdapter();
}
